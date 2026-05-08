import { Cpu, Zap } from "lucide-react";
import { AVAILABLE_MODELS, type ModelId } from "@/lib/predict.functions";

interface Props {
  value: ModelId;
  onChange: (id: ModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Model · Registry
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {AVAILABLE_MODELS.length} loaded
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AVAILABLE_MODELS.map((m) => {
          const active = value === m.id;
          const locked = disabled || !m.enabled;

          return (
            <button
              key={m.id}
              disabled={locked}
              onClick={() => onChange(m.id)}
              className={`text-left rounded-xl border p-3 transition-all relative overflow-hidden
                ${active
                  ? "border-neon-purple bg-neon-purple/10 shadow-[0_0_20px_-8px_var(--neon-purple)]"
                  : "border-border hover:border-neon-blue/60 bg-card/40"}
                ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {m.id === "mobilenet_v2" ? (
                  <Zap className={`w-3.5 h-3.5 ${active ? "text-neon-purple" : "text-neon-cyan"}`} />
                ) : (
                  <Cpu className={`w-3.5 h-3.5 ${active ? "text-neon-purple" : "text-neon-cyan"}`} />
                )}
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {m.tag}
                </span>
                {!m.enabled && (
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                    Coming soon
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-foreground">{m.label}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate">
                {m.id}
              </div>
              {active && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}