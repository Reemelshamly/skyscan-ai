# OrbitVision Backend - Hugging Face Spaces

This is the FastAPI backend for the OrbitVision satellite scene classifier, deployed on Hugging Face Spaces.

## Endpoints

- **GET `/`** - Health check
  ```bash
  curl https://YOUR_USERNAME-orbitvision-backend.hf.space/
  ```

- **GET `/models`** - List available models and scene classes
  ```bash
  curl https://YOUR_USERNAME-orbitvision-backend.hf.space/models
  ```

- **POST `/predict`** - Run inference on an image
  ```bash
  curl -F "image=@image.jpg" \
       -F "model_name=resnet_scratch" \
       https://YOUR_USERNAME-orbitvision-backend.hf.space/predict
  ```

## Models

Available models:
- `resnet_scratch` - ResNet-18 trained from scratch
- `resnet_finetuned` - ResNet-18 fine-tuned on NWPU-RESISC45
- `mobilenet_v2` - MobileNet V2 pretrained
- `efficientnet_b0` - EfficientNet-B0 pretrained
- `mobilenet_v2_kd` - MobileNet V2 with Knowledge Distillation

## Response Format

```json
{
  "model_used": "resnet_scratch",
  "class": "airport",
  "confidence": 0.95,
  "heatmap": "data:image/png;base64,..."
}
```

## Deployment Instructions

1. Create a Hugging Face Space with Docker SDK
2. Clone the space repository
3. Copy `main.py`, `requirements.txt`, `Dockerfile`, and checkpoint files (`*.pth`)
4. Push to HF
5. HF will auto-build and deploy

## Notes

- Models are loaded at startup (slow first load)
- Checkpoints must be present in the space (requires Git LFS for large files)
- CORS is enabled for all origins
