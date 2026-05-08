import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Satellite, Activity, Cpu } from "lucide-react";
import { DEFAULT_MODEL_ID, predictImage } from "@/lib/predict.functions";
import type { ModelId } from "@/lib/predict.functions";
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
  const predict = useServerFn(predictImage);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL_ID);

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
    const fd = new FormData();
    fd.append("image", file);
    fd.append("model_name", modelId);
    try {
      const res = await predict({ data: fd });
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple grid place-items-center glow">
              <Satellite className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">OrbitVision</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Scene Classifier · v1.0</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs text-muted-foreground">
            <Stat icon={<Cpu className="w-3.5 h-3.5" />} label="Model" value="ResNet-18 Scratch" />
            <Stat icon={<Activity className="w-3.5 h-3.5" />} label="Status" value="Online" valueClass="text-success" />
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-border/60 bg-background/30 backdrop-blur-md sticky top-[65px] z-[9]">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <ModelSelector value={modelId} onChange={setModelId} disabled={loading} />
        </div>
      </div>

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
        </section>

        {/* Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input side */}
          <div className="space-y-6">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-1">Input</div>
            <UploadZone
              file={file}
              previewUrl={previewUrl}
              onFile={setFile}
              onAnalyze={onAnalyze}
              loading={loading}
            />
          </div>
          {/* Output side */}
          <div className="space-y-6">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-1">Output</div>
            <HeatmapPanel
              originalUrl={previewUrl}
              heatmap={result?.heatmap ?? ""}
              loading={loading}
            />
            <ResultCard result={result} />
          </div>
        </section>

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Backend: set <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">PREDICT_API_URL</code> to your FastAPI <code>/predict</code> endpoint.
        </footer>
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
