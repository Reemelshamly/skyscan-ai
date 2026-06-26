import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Cpu } from "lucide-react";

interface Props {
  result: {
    class: string;
    confidence: number;
    heatmap?: string;
    camError?: string;
    source: string;
    modelUsed?: string;
    error?: string;
  } | null;
}

export function ResultCard({ result }: Props) {
  if (!result) {
    return (
      <div className="glass rounded-2xl p-6 h-full flex items-center justify-center text-muted-foreground text-sm">
        Your prediction will appear here.
      </div>
    );
  }

  const pct = Math.round(result.confidence * 100);
  const tone = pct >= 85 ? "success" : pct >= 60 ? "warning" : "destructive";
  const toneColor = { success: "var(--success)", warning: "var(--warning)", destructive: "var(--destructive)" }[tone];

  function openHeatmap(url?: string) {
    if (!url) return;
    try {
      window.open(url, "_blank");
    } catch (e) {
      // eslint-disable-next-line no-restricted-globals
      (location as any).href = url;
    }
  }

  const pctWidth = pct + "%";
  const backgroundStyle = { background: "linear-gradient(90deg, var(--neon-blue), " + toneColor + ")" } as React.CSSProperties;
  const altText = "Heatmap for " + result!.class.replace(/_/g, " ");
  const explanation = result!.heatmap
    ? "This heatmap highlights regions the model considered most informative for predicting '" + result!.class.replace(/_/g, " ") + "'. Model: " + (result!.modelUsed || "unknown model") + ". Confidence: " + pct + "%"
    : result!.camError
    ? result!.camError
    : "No visual explanation is available for this prediction.";

  return (
    <div className="glass rounded-2xl p-6 space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Prediction summary
        </h2>
        <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full glass-strong">
          {result.source === "backend" ? "Live result" : result.source}
        </span>
      </div>

      {result.modelUsed && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Cpu className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="uppercase tracking-widest text-[10px]">Model</span>
          <span className="font-mono text-foreground">{result.modelUsed}</span>
        </div>
      )}

      <div>
        <div className="text-xs text-muted-foreground mb-1">Predicted Class</div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-gradient capitalize"
        >
          {result.class.replace(/_/g, " ")}
        </motion.div>
      </div>

      <div>
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: toneColor }}>
            {pct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            key={String(result.modelUsed) + "-" + pct}
            initial={{ width: 0 }}
            animate={{ width: pctWidth }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={backgroundStyle}
          />
        </div>
      </div>

      <div className="mt-auto">
        {result.error ? (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{result.error}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>Prediction finished successfully</span>
          </div>
        )}
      </div>

      
    </div>
  );
}
