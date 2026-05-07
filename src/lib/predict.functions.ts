import { createServerFn } from "@tanstack/react-start";

const SCENE_CLASSES = [
  "industrial_area", "dense_residential", "forest", "river", "harbor",
  "airport", "beach", "farmland", "freeway", "golf_course",
  "parking_lot", "stadium", "storage_tank", "mountain", "desert",
];

function generateMockHeatmap(): string {
  // 1x1 transparent — replaced client-side with a CSS heatmap overlay when empty
  return "";
}

export const predictImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    const file = data.get("image");
    if (!(file instanceof File)) throw new Error("Missing image file");
    return { file };
  })
  .handler(async ({ data }) => {
    const apiUrl = process.env.PREDICT_API_URL;

    if (apiUrl) {
      try {
        const fd = new FormData();
        fd.append("image", data.file);
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/predict`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        const json = await res.json();
        return {
          class: String(json.class ?? "unknown"),
          confidence: Number(json.confidence ?? 0),
          heatmap: String(json.heatmap ?? ""),
          source: "backend" as const,
        };
      } catch (err) {
        console.error("Predict backend error:", err);
        return {
          class: "unknown",
          confidence: 0,
          heatmap: "",
          source: "error" as const,
          error: err instanceof Error ? err.message : "Backend unreachable",
        };
      }
    }

    // Mock inference (deterministic-ish from filename length)
    await new Promise((r) => setTimeout(r, 1200));
    const idx = (data.file.name.length + data.file.size) % SCENE_CLASSES.length;
    const confidence = 0.72 + ((data.file.size % 25) / 100);
    return {
      class: SCENE_CLASSES[idx],
      confidence: Math.min(0.99, confidence),
      heatmap: generateMockHeatmap(),
      source: "mock" as const,
    };
  });
