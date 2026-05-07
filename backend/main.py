# FastAPI backend reference for OrbitVision
# Save as backend/main.py and run with: uvicorn main:app --reload --port 8000
# Then set PREDICT_API_URL=http://localhost:8000 in your Lovable Cloud env.

import io, base64, numpy as np, cv2, torch
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import torchvision.transforms as T
import torchvision.models as models

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# --- Load your pretrained model once at startup ---
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CLASSES = ["industrial_area","dense_residential","forest","river","harbor",
           "airport","beach","farmland","freeway","golf_course"]

model = models.resnet50(num_classes=len(CLASSES))
# model.load_state_dict(torch.load("weights.pth", map_location=DEVICE))
model.eval().to(DEVICE)

preprocess = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# --- Grad-CAM ---
target_layer = model.layer4[-1]
_features, _gradients = {}, {}
target_layer.register_forward_hook(lambda m,i,o: _features.setdefault("v", o))
target_layer.register_full_backward_hook(lambda m,gi,go: _gradients.setdefault("v", go[0]))

def gradcam(input_tensor, class_idx):
    _features.clear(); _gradients.clear()
    out = model(input_tensor)
    model.zero_grad()
    out[0, class_idx].backward()
    grads = _gradients["v"][0].mean(dim=(1,2))
    fmap = _features["v"][0]
    cam = torch.relu((grads[:,None,None] * fmap).sum(dim=0)).cpu().numpy()
    cam = cv2.resize(cam, (224,224))
    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
    return cam

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    img = Image.open(io.BytesIO(await image.read())).convert("RGB").resize((224,224))
    x = preprocess(img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1)[0]
        idx = int(probs.argmax()); conf = float(probs[idx])

    cam = gradcam(x.requires_grad_(), idx)
    heatmap = cv2.applyColorMap(np.uint8(255*cam), cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(np.array(img)[:,:,::-1], 0.5, heatmap, 0.5, 0)
    _, buf = cv2.imencode(".png", overlay)
    b64 = base64.b64encode(buf.tobytes()).decode()

    return {"class": CLASSES[idx], "confidence": conf, "heatmap": b64}
