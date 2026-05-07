interface Props {
  originalUrl: string | null;
  heatmap: string;
  loading: boolean;
}

export function HeatmapPanel({ originalUrl, heatmap, loading }: Props) {
  const heatmapSrc = heatmap
    ? (heatmap.startsWith("data:") || heatmap.startsWith("http") ? heatmap : `data:image/png;base64,${heatmap}`)
    : null;

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        Visualization · Grad-CAM
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Frame label="Original" loading={loading}>
          {originalUrl ? (
            <img src={originalUrl} alt="original" className="w-full h-full object-cover" />
          ) : <Empty />}
        </Frame>

        <Frame label="Activation" loading={loading}>
          {originalUrl ? (
            <>
              <img src={originalUrl} alt="base" className="absolute inset-0 w-full h-full object-cover" />
              {heatmapSrc ? (
                <img src={heatmapSrc} alt="heatmap" className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-90" />
              ) : (
                <div className="absolute inset-0 mix-blend-screen opacity-70"
                  style={{
                    background: "radial-gradient(circle at 60% 40%, oklch(0.75 0.25 25 / 90%) 0%, oklch(0.7 0.25 60 / 60%) 25%, oklch(0.6 0.25 280 / 30%) 55%, transparent 75%)",
                  }}
                />
              )}
            </>
          ) : <Empty />}
        </Frame>
      </div>
    </div>
  );
}

function Frame({ label, loading, children }: { label: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
        {children}
        {loading && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-x-0 h-1 bg-gradient-to-b from-transparent via-neon-cyan to-transparent animate-scan" />
            <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-neon-purple animate-pulse-ring" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty() {
  return <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">No image</div>;
}
