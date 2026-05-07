# FastAPI backend for OrbitVision — single-model inference + Grad-CAM
# Run: uvicorn main:app --reload --port 8000
# Then set PREDICT_API_URL=http://localhost:8000 in your Lovable Cloud env.

import base64
import io
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as T
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
BACKEND_DIR = Path(__file__).resolve().parent
CHECKPOINT_PATH = BACKEND_DIR / "resnet18_scratch_best.pth"

CLASSES = [
    "airplane",
    "airport",
    "baseball_diamond",
    "basketball_court",
    "beach",
    "bridge",
    "chaparral",
    "church",
    "circular_farmland",
    "cloud",
    "commercial_area",
    "dense_residential",
    "desert",
    "forest",
    "freeway",
    "golf_course",
    "ground_track_field",
    "harbor",
    "industrial_area",
    "intersection",
    "island",
    "lake",
    "meadow",
    "medium_residential",
    "mobile_home_park",
    "mountain",
    "overpass",
    "palace",
    "parking_lot",
    "railway",
    "railway_station",
    "rectangular_farmland",
    "river",
    "roundabout",
    "runway",
    "sea_ice",
    "ship",
    "snowberg",
    "sparse_residential",
    "stadium",
    "storage_tank",
    "tennis_court",
    "terrace",
    "thermal_power_station",
    "wetland",
]
NUM_CLASSES = len(CLASSES)

preprocess = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


class BasicBlock(nn.Module):
    expansion = 1

    def __init__(self, in_channels: int, out_channels: int, stride: int = 1):
        super().__init__()

        self.conv1 = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=3,
            stride=stride,
            padding=1,
            bias=False,
        )
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv2d(
            out_channels,
            out_channels,
            kernel_size=3,
            stride=1,
            padding=1,
            bias=False,
        )
        self.bn2 = nn.BatchNorm2d(out_channels)

        self.downsample = None
        if stride != 1 or in_channels != out_channels:
            self.downsample = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(out_channels),
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x

        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))

        if self.downsample is not None:
            identity = self.downsample(x)

        out = self.relu(out + identity)
        return out


class ResNet18(nn.Module):
    def __init__(self, num_classes: int = 45, in_channels: int = 3, dropout_p: float = 0.3):
        super().__init__()

        self.in_channels = 64

        self.stem = nn.Sequential(
            nn.Conv2d(in_channels, 64, kernel_size=7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
        )

        self.layer1 = self._make_layer(64, 2, stride=1)
        self.layer2 = self._make_layer(128, 2, stride=2)
        self.layer3 = self._make_layer(256, 2, stride=2)
        self.layer4 = self._make_layer(512, 2, stride=2)

        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.dropout = nn.Dropout(p=dropout_p)
        self.classifier = nn.Linear(512, num_classes)

        self._init_weights()

    def _make_layer(self, out_channels, num_blocks, stride):
        blocks = [BasicBlock(self.in_channels, out_channels, stride)]
        self.in_channels = out_channels
        for _ in range(1, num_blocks):
            blocks.append(BasicBlock(self.in_channels, out_channels))
        return nn.Sequential(*blocks)

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def forward(self, x):
        x = self.stem(x)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)
        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.dropout(x)
        return self.classifier(x)


def _load_state_dict_from_checkpoint(checkpoint_path: Path):
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    if isinstance(checkpoint, dict) and "model_state" in checkpoint:
        return checkpoint["model_state"]
    if isinstance(checkpoint, dict):
        return checkpoint
    raise RuntimeError("Unsupported checkpoint format")


def build_resnet_scratch() -> torch.nn.Module:
    model = ResNet18(num_classes=NUM_CLASSES)
    state_dict = _load_state_dict_from_checkpoint(CHECKPOINT_PATH)
    model.load_state_dict(state_dict)
    return model.eval().to(DEVICE)


def _last_conv_layer(model: torch.nn.Module):
    last = None
    for module in model.modules():
        if isinstance(module, torch.nn.Conv2d):
            last = module
    return last


def gradcam(model: torch.nn.Module, target_layer: torch.nn.Module, x: torch.Tensor, class_idx: int) -> np.ndarray:
    feats: dict = {}
    grads: dict = {}

    h1 = target_layer.register_forward_hook(lambda m, i, o: feats.setdefault("v", o))
    h2 = target_layer.register_full_backward_hook(lambda m, gi, go: grads.setdefault("v", go[0]))
    try:
        x = x.clone().requires_grad_(True)
        out = model(x)
        model.zero_grad()
        out[0, class_idx].backward()
        g = grads["v"][0].mean(dim=(1, 2))
        f = feats["v"][0]
        cam = torch.relu((g[:, None, None] * f).sum(dim=0)).detach().cpu().numpy()
    finally:
        h1.remove()
        h2.remove()

    cam = cv2.resize(cam, (224, 224))
    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
    return cam


def overlay_heatmap(pil_img: Image.Image, cam: np.ndarray) -> str:
    img = np.array(pil_img.resize((224, 224)))[:, :, ::-1]
    heat = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
    blended = cv2.addWeighted(img, 0.5, heat, 0.5, 0)
    _, buf = cv2.imencode(".png", blended)
    return base64.b64encode(buf.tobytes()).decode()


MODELS: dict = {}


def load_models():
    try:
        model = build_resnet_scratch()
        MODELS["resnet_scratch"] = {
            "model": model,
            "label": "ResNet18 (scratch)",
            "supports_cam": True,
            "target_layer": _last_conv_layer(model),
        }
        print("[registry] loaded resnet_scratch: ResNet18 (scratch)")
    except Exception as e:
        print(f"[registry] FAILED to load resnet_scratch: {e}")


app = FastAPI(title="OrbitVision Inference")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def _startup():
    load_models()


@app.get("/models")
def list_models():
    return {
        "models": [
            {"id": k, "label": v["label"], "supports_cam": v["supports_cam"]}
            for k, v in MODELS.items()
        ],
        "classes": CLASSES,
    }


@app.post("/predict")
async def predict(
    image: UploadFile = File(...),
    model_name: str = Form("resnet_scratch"),
):
    if model_name != "resnet_scratch" or model_name not in MODELS:
        raise HTTPException(400, "Only 'resnet_scratch' is available right now.")

    entry = MODELS[model_name]
    model = entry["model"]

    pil = Image.open(io.BytesIO(await image.read())).convert("RGB")
    x = preprocess(pil).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = model(x)
        probs = F.softmax(logits, dim=1)[0]
        idx = int(probs.argmax())
        conf = float(probs[idx])

    heatmap_b64 = ""
    if entry["supports_cam"] and entry["target_layer"] is not None:
        try:
            cam = gradcam(model, entry["target_layer"], x, idx)
            heatmap_b64 = overlay_heatmap(pil, cam)
        except Exception as e:
            print(f"[gradcam] failed for {model_name}: {e}")

    return {
        "model_used": model_name,
        "class": CLASSES[idx],
        "confidence": conf,
        "heatmap": heatmap_b64,
    }
