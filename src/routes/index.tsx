import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Satellite, Cpu } from "lucide-react";
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, predictImage, type ModelId } from "@/lib/predict.functions";
import { UploadZone } from "@/components/UploadZone";
import { ModelSelector } from "@/components/ModelSelector";
import { ResultCard } from "@/components/ResultCard";
import { HeatmapPanel } from "@/components/HeatmapPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OrbitVision · Satellite Scene Classifier" },
      { name: "description", content: "AI-powered satellite imagery classification with Grad-CAM visual explanations." },
    ],
  }),
  component: Dashboard,
});

type PredictResult = Awaited<ReturnType<typeof predictImage>>;

function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL_ID);
  const activeModelLabel = AVAILABLE_MODELS.find((model) => model.id === modelId)?.label ?? modelId;

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await predictImage({ file, modelName: modelId });
      setResult(res);
    } catch (err) {
      setResult({ modelUsed: modelId, class: "error", confidence: 0, heatmap: "", source: "error", error: String(err) } as PredictResult);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/60 backdrop-blur-md sticky top-0 z-10 bg-background/40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Satellite className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-base font-bold tracking-tight">OrbitVision</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Scene Classifier · v1.0</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs text-muted-foreground">
            <Stat icon={<Cpu className="w-3.5 h-3.5" />} label="Active model" value={activeModelLabel} />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
        {/* Hero */}
        <section className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full glass-strong">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-muted-foreground">Inference engine ready</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            <span className="text-gradient">Classify</span> aerial scenes in real time.
          </h2>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground leading-relaxed">
            Choose a model, drop in one satellite image, and we’ll show the best guess plus a
            heatmap that highlights what the model paid attention to.
          </p>
        </section>

        {/* Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          {/* LEFT: Controls */}
          <div className="space-y-6 lg:sticky lg:top-24 self-start">
            <ModelSelector value={modelId} onChange={setModelId} disabled={loading} />
            <UploadZone
              file={file}
              previewUrl={previewUrl}
              onFile={setFile}
              onAnalyze={onAnalyze}
              loading={loading}
            />
          </div>
          
          {/* CENTER: Image & GradCAM */}
          <div className="lg:col-span-2 min-h-[420px]">
            <HeatmapPanel
              originalUrl={previewUrl}
              heatmap={result?.heatmap ?? ""}
              loading={loading}
            />
          </div>
          
          {/* RIGHT: Prediction Insights */}
          <div className="h-full">
            <ResultCard result={result} />
          </div>
        </section>

        
      </main>
    </div>
  );
}

function Stat({ icon, label, value, valueClass = "" }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="uppercase tracking-widest text-[10px]">{label}</span>
      <span className={`font-semibold text-foreground ${valueClass}`}>{value}</span>
    </div>
  );
}
