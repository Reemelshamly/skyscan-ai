# FastAPI backend for OrbitVision — multi-model inference + Grad-CAM
# Run: uvicorn main:app --reload --port 8000
# Then set PREDICT_API_URL=http://localhost:8000 in your Lovable Cloud env.

import io, base64
import numpy as np
import cv2
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import torchvision.transforms as T
import torchvision.models as tvm

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

CLASSES = ["industrial_area", "dense_residential", "forest", "river", "harbor",
           "airport", "beach", "farmland", "freeway", "golf_course"]
NUM_CLASSES = len(CLASSES)

preprocess = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


# ---------- Model registry ----------
def _build_resnet18(pretrained: bool):
    weights = tvm.ResNet18_Weights.DEFAULT if pretrained else None
    m = tvm.resnet18(weights=weights)
    m.fc = torch.nn.Linear(m.fc.in_features, NUM_CLASSES)
    return m


def _build_mobilenet_v2():
    weights = tvm.MobileNet_V2_Weights.DEFAULT
    m = tvm.mobilenet_v2(weights=weights)
    m.classifier[-1] = torch.nn.Linear(m.classifier[-1].in_features, NUM_CLASSES)
    return m


def _build_efficientnet_b0():
    weights = tvm.EfficientNet_B0_Weights.DEFAULT
    m = tvm.efficientnet_b0(weights=weights)
    m.classifier[-1] = torch.nn.Linear(m.classifier[-1].in_features, NUM_CLASSES)
    return m


def _last_conv_layer(model: torch.nn.Module):
    """Return the deepest Conv2d module — used as Grad-CAM target."""
    last = None
    for module in model.modules():
        if isinstance(module, torch.nn.Conv2d):
            last = module
    return last


REGISTRY_SPECS = {
    "resnet_scratch":    ("ResNet18 (scratch)",        lambda: _build_resnet18(False), True),
    "resnet_pretrained": ("ResNet18 (ImageNet FT)",    lambda: _build_resnet18(True),  True),
    "mobilenet_v2":      ("MobileNetV2",               _build_mobilenet_v2,            True),
    "efficientnet_b0":   ("EfficientNet-B0",           _build_efficientnet_b0,         True),
}

MODELS: dict = {}


def load_models():
    for key, (label, builder, supports_cam) in REGISTRY_SPECS.items():
        try:
            m = builder().eval().to(DEVICE)
            MODELS[key] = {
                "model": m,
                "label": label,
                "supports_cam": supports_cam,
                "target_layer": _last_conv_layer(m) if supports_cam else None,
            }
            print(f"[registry] loaded {key}: {label}")
        except Exception as e:
            print(f"[registry] FAILED to load {key}: {e}")


# ---------- Grad-CAM ----------
def gradcam(model: torch.nn.Module, target_layer: torch.nn.Module,
            x: torch.Tensor, class_idx: int) -> np.ndarray:
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


# ---------- App ----------
app = FastAPI(title="OrbitVision Inference")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


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
    model_name: str = Form("resnet_pretrained"),
):
    if model_name not in MODELS:
        raise HTTPException(400, f"Unknown model '{model_name}'. Available: {list(MODELS)}")

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
