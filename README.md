**Project Overview**
- **Description:** OrbitVision — an image classification and visualization project for the NWPU-RESISC45 dataset. Provides trained models (ResNet18, MobileNetV2, EfficientNet-B0), evaluation notebooks, ONNX exports, and a Vite + FastAPI web app for inference and Grad-CAM heatmaps.

Detailed Description:

Project Purpose: OrbitVision is an end-to-end image classification and visualization toolkit for high-resolution aerial imagery (NWPU-RESISC45). It provides trained models, evaluation notebooks, and a web application to perform single-image inference and visualize model attention via Grad-CAM.

What it does (high level): Given an input aerial image, the system returns a predicted scene class (one of 45 categories), a confidence score, and an optional Grad-CAM heatmap that highlights spatial regions contributing most to the prediction. It supports multiple model backbones so you can compare accuracy, latency, and interpretability.

Data and classes: Built for the NWPU-RESISC45 dataset (45 scene categories such as airplane, beach, stadium, railway_station, etc.). The class list is embedded in the backend; predictions return a class name plus probability.


Model family included:
ResNet-18 (trained from scratch and fine-tuned variants).
MobileNetV2 (standard and knowledge-distilled student).
EfficientNet-B0.
Checkpoints and ONNX exports are included in project folders (ResNet18_Scratch, ResNet18_Finetuned, MobileNet, EfficientB0).


Inference backend:
Implemented with FastAPI in main.py.
Loads available checkpoints (searches backend and project-level paths).
Exposes endpoints: GET / (health), GET /models (available models + classes), POST /predict (multipart form: image file and optional model_name).
Performs preprocessing (resize to 224×224, normalization), model forward pass, softmax for confidences, and Grad-CAM generation when supported.


Frontend web app:
Built with Vite + React in skyscan-ai (see package.json scripts).
Calls the backend POST /predict endpoint (frontend config can point to backend via PREDICT_API_URL).
Displays predicted label, confidence, and overlays heatmap on the image when available.




**Contents**
- **Model Checkpoints:** Contains trained PyTorch checkpoints 
ONNX files: [EfficientB0](EfficientB0), [MobileNet](MobileNet), [ResNet18_Finetuned](ResNet18_Finetuned), [ResNet18_Scratch](ResNet18_Scratch).
- **Evaluation:** Jupyter notebooks and benchmarking utilities in [evaluation](evaluation).
- **Notebooks:** Per-model training and analysis notebooks at the top-level (e.g., `efficientnet_pretrained.ipynb`, `mobilenetv2_pretrained.ipynb`).
- **Web App:** Interactive frontend and backend in `skyscan-ai` — frontend powered by Vite/React and backend by FastAPI (see [skyscan-ai/package.json](skyscan-ai/package.json#L1) and [skyscan-ai/backend/main.py](skyscan-ai/backend/main.py#L1)).

**Models Included**
- **ResNet18 (scratch)**: [ResNet18_Scratch/resnet18_scratch_best.pth](ResNet18_Scratch/resnet18_scratch_best.pth#L1)
- **ResNet18 (fine-tuned)**: [ResNet18_Finetuned/resnet18_finetuned_best.pth](ResNet18_Finetuned/resnet18_finetuned_best.pth#L1)
- **MobileNetV2 (pretrained / KD)**: [MobileNet/mobilenetv2_best.pth](MobileNet/mobilenetv2_best.pth#L1) and KD student [MobileNet/mobilenetv2_kd_best.pth](MobileNet/mobilenetv2_kd_best.pth#L1)
- **EfficientNet-B0**: [EfficientB0/efficientnet_b0_best.pth](EfficientB0/efficientnet_b0_best.pth#L1)

**Evaluation & Benchmarks**
- See the notebooks in [evaluation](evaluation) for metrics, benchmarking, and visual analysis. Notable files: `benchmark.ipynb`, `evaluator.ipynb`, `metrics.ipynb`.

**Web App (Architecture)**
- **Backend:** FastAPI app at [skyscan-ai/backend/main.py](skyscan-ai/backend/main.py#L1). It loads available model checkpoints, exposes a small inference API, and provides Grad-CAM heatmaps.
- **Frontend:** Vite + React app at `skyscan-ai/` (scripts in [skyscan-ai/package.json](skyscan-ai/package.json#L1)). Frontend calls the backend `/predict` endpoint to run inference and display results.

**API Endpoints**
- **GET /**: health check and list of loaded models.
- **GET /models**: returns available models and class labels.
- **POST /predict**: multipart form with fields:
  - `image` (file): image to classify.
  - `model_name` (form string, optional): model id to use (e.g., `resnet_scratch`, `resnet_finetuned`, `mobilenet_v2`, `efficientnet_b0`, `mobilenet_v2_kd`).
  Response: JSON with `model_used`, `class`, `confidence`, and `heatmap` (base64 PNG string, empty if CAM failed).

**How to Run the Web App (Local)**
1) Start the backend (Python / FastAPI)

   - Create and activate a virtual environment.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1    # PowerShell
# or: .\.venv\Scripts\activate  # cmd
```

   - Install dependencies. PyTorch installation may require the official selector (CUDA vs CPU). A minimal set is shown below; adapt per your platform:

```powershell
pip install fastapi uvicorn pillow opencv-python torchvision torch
```

   - Run the backend from `skyscan-ai/backend`:

```powershell
cd skyscan-ai/backend
uvicorn main:app --reload --port 8000

or 

python -m uvicorn main:app --reload --port 8000
```

   - Confirm backend is running: open `http://localhost:8000/`.

2) Start the frontend (Node / Vite)

```bash
cd skyscan-ai
npm install
npm run dev
```

   - By default Vite runs on `http://localhost:5173` (or a nearby port). The frontend expects the backend API at `http://localhost:8000` — if needed set `PREDICT_API_URL` in your environment to point to the backend.

3) Quick curl test for the API

```bash
curl -X POST "http://localhost:8000/predict" -F "image=@/path/to/image.jpg" -F "model_name=resnet_finetuned"
```

**Notes & Tips**
- Device: the backend autodetects CUDA (`DEVICE = "cuda" if torch.cuda.is_available() else "cpu"`). Running on GPU requires a CUDA-enabled PyTorch build.
- Checkpoint resolution: the backend looks for checkpoints in `skyscan-ai/backend/` and project-level locations (see `skyscan-ai/backend/main.py` for candidates).
- If you modify the frontend to run in a different host/port, set `PREDICT_API_URL` to the backend base URL.

**Where to Look Next**
- Training notebooks: explore the model training notebooks in each model folder to reproduce or fine-tune models.
- Evaluation: open `evaluation/benchmark.ipynb` to reproduce benchmarking results.

**Acknowledgements**
- Built around NWPU-RESISC45 dataset and standard torchvision model backbones.
