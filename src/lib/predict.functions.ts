export const AVAILABLE_MODELS = [
  { id: "resnet_finetuned", label: "ResNet18 · Fine-tuned", tag: "Accurate", enabled: true },
  { id: "resnet_scratch", label: "ResNet18 · From Scratch", tag: "Baseline", enabled: true },
  { id: "mobilenet_v2", label: "MobileNetV2", tag: "Fast", enabled: true },
  { id: "mobilenet_v2_kd", label: "MobileNetV2 · Knowledge Distillation", tag: "Fast+", enabled: true },
  { id: "efficientnet_b0", label: "EfficientNet-B0", tag: "Balanced", enabled: true },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];
export const DEFAULT_MODEL_ID: ModelId = AVAILABLE_MODELS[0].id;

const BACKEND_TIMEOUT_MS = 25_000;

const SCENE_CLASSES = [
  "airplane", "airport", "baseball_diamond", "basketball_court", "beach",
  "bridge", "chaparral", "church", "circular_farmland", "cloud",
  "commercial_area", "dense_residential", "desert", "forest", "freeway",
  "golf_course", "ground_track_field", "harbor", "industrial_area", "intersection",
  "island", "lake", "meadow", "medium_residential", "mobile_home_park",
  "mountain", "overpass", "palace", "parking_lot", "railway",
  "railway_station", "rectangular_farmland", "river", "roundabout", "runway",
  "sea_ice", "ship", "snowberg", "sparse_residential", "stadium",
  "storage_tank", "tennis_court", "terrace", "thermal_power_station", "wetland",
];

type PredictInput = {
  file: File;
  modelName?: string;
};

async function sendPrediction(apiUrl: string, file: File, modelName: string, signal: AbortSignal) {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("model_name", modelName);

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/predict`, {
    method: "POST",
    body: fd,
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = new Error(body || `Backend ${res.status}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  const json = await res.json();
  return {
    modelUsed: String(json.model_used ?? modelName),
    class: String(json.class ?? "unknown"),
    confidence: Number(json.confidence ?? 0),
    heatmap: String(json.heatmap ?? ""),
    camError: String(json.cam_error ?? ""),
    source: "backend" as const,
  };
}

export async function predictImage({ file, modelName = DEFAULT_MODEL_ID }: PredictInput) {
  const apiUrl = import.meta.env.VITE_PREDICT_API_URL as string | undefined;

  if (apiUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

    try {
      try {
        return await sendPrediction(apiUrl, file, modelName, controller.signal);
      } catch (err) {
        const status = err instanceof Error ? (err as Error & { status?: number }).status : undefined;
        if (status === 400 && modelName !== "resnet_scratch") {
          return await sendPrediction(apiUrl, file, "resnet_scratch", controller.signal);
        }
        throw err;
      }
    } catch (err) {
      console.error("Predict backend error:", err);
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? `Backend timed out after ${Math.round(BACKEND_TIMEOUT_MS / 1000)}s`
          : err instanceof Error
            ? err.message
            : "Backend unreachable";
      return {
        modelUsed: modelName,
        class: "unknown",
        confidence: 0,
        heatmap: "",
        source: "error" as const,
        error: message,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Mock inference — varies slightly by model so the UI feels alive
  await new Promise((r) => setTimeout(r, 900));
  const idx = (file.name.length + file.size) % SCENE_CLASSES.length;
  const base = 0.62 + ((file.size % 25) / 100);
  const confidence = Math.min(0.99, base + 0.08);
  return {
    modelUsed: modelName,
    class: SCENE_CLASSES[idx],
    confidence,
    heatmap: "",
    source: "mock" as const,
  };
}
