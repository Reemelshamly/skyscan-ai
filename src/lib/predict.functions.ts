import { createServerFn } from "@tanstack/react-start";

export const AVAILABLE_MODELS = [
  { id: "resnet_pretrained", label: "ResNet18 · ImageNet FT", supportsCam: true, tag: "Accurate" },
  { id: "resnet_scratch",    label: "ResNet18 · From Scratch", supportsCam: true, tag: "Baseline" },
  { id: "mobilenet_v2",      label: "MobileNetV2",             supportsCam: true, tag: "Fast" },
  { id: "efficientnet_b0",   label: "EfficientNet-B0",         supportsCam: true, tag: "Optional" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

const SCENE_CLASSES = [
  "industrial_area", "dense_residential", "forest", "river", "harbor",
  "airport", "beach", "farmland", "freeway", "golf_course",
];

export const predictImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    const file = data.get("image");
    const modelName = String(data.get("model_name") ?? "resnet_pretrained");
    if (!(file instanceof File)) throw new Error("Missing image file");
    return { file, modelName };
  })
  .handler(async ({ data }) => {
    const apiUrl = process.env.PREDICT_API_URL;

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
    const modelBias: Record<string, number> = {
      resnet_pretrained: 0.18,
      resnet_scratch: 0.05,
      mobilenet_v2: 0.10,
      efficientnet_b0: 0.15,
    };
    const delay = data.modelName === "mobilenet_v2" ? 600 : 1200;
    await new Promise((r) => setTimeout(r, delay));
    const idx = (data.file.name.length + data.file.size) % SCENE_CLASSES.length;
    const base = 0.62 + ((data.file.size % 25) / 100);
    const confidence = Math.min(0.99, base + (modelBias[data.modelName] ?? 0));
    return {
      modelUsed: data.modelName,
      class: SCENE_CLASSES[idx],
      confidence,
      heatmap: "",
      source: "mock" as const,
    };
  });
