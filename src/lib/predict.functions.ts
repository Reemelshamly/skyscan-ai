import { createServerFn } from "@tanstack/react-start";

export const AVAILABLE_MODELS = [
  { id: "resnet_scratch" as const, label: "ResNet-18 Scratch", tag: "ResNet-18" },
  { id: "mobilenet_v2" as const, label: "MobileNet V2", tag: "MobileNet V2" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];
export const DEFAULT_MODEL_ID: ModelId = AVAILABLE_MODELS[0].id;

export const AVAILABLE_MODELS = [
  { id: "resnet_finetuned", label: "ResNet18 · Fine-tuned", tag: "Accurate", enabled: true },
  { id: "resnet_scratch", label: "ResNet18 · From Scratch", tag: "Baseline", enabled: true },
  { id: "mobilenet_v2", label: "MobileNetV2", tag: "Fast", enabled: true },
  { id: "mobilenet_v2_kd", label: "MobileNetV2 · Knowledge Distillation", tag: "Fast+", enabled: true },
  { id: "efficientnet_b0", label: "EfficientNet-B0", tag: "Balanced", enabled: true },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

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

export const predictImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    const file = data.get("image");
    const modelName = String(data.get("model_name") ?? DEFAULT_MODEL_ID);
    if (!(file instanceof File)) throw new Error("Missing image file");
    return { file, modelName };
  })
  .handler(async ({ data }: { data: { file: File; modelName: string } }) => {
    const apiUrl = import.meta.env.VITE_PREDICT_API_URL as string | undefined;

    if (apiUrl) {
      try {
        const fd = new FormData();
        fd.append("image", data.file);
        fd.append("model_name", data.modelName);
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/predict`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        const json = await res.json();
        return {
          modelUsed: String(json.model_used ?? data.modelName),
          class: String(json.class ?? "unknown"),
          confidence: Number(json.confidence ?? 0),
          heatmap: String(json.heatmap ?? ""),
          source: "backend" as const,
        };
      } catch (err) {
        console.error("Predict backend error:", err);
        return {
          modelUsed: data.modelName,
          class: "unknown",
          confidence: 0,
          heatmap: "",
          source: "error" as const,
          error: err instanceof Error ? err.message : "Backend unreachable",
        };
      }
    }

    // Mock inference — varies slightly by model so the UI feels alive
    await new Promise((r) => setTimeout(r, 900));
    const idx = (data.file.name.length + data.file.size) % SCENE_CLASSES.length;
    const base = 0.62 + ((data.file.size % 25) / 100);
    const confidence = Math.min(0.99, base + 0.08);
    return {
      modelUsed: data.modelName,
      class: SCENE_CLASSES[idx],
      confidence,
      heatmap: "",
      source: "mock" as const,
    };
  });
