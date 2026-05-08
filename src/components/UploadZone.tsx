import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, ImageIcon, X } from "lucide-react";

interface Props {
  file: File | null;
  previewUrl: string | null;
  onFile: (file: File | null) => void;
  onAnalyze: () => void;
  loading: boolean;
}

export function UploadZone({ file, previewUrl, onFile, onAnalyze, loading }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  }, [onFile]);

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Input · Satellite Image
        </h2>
        {file && (
          <button
            onClick={() => onFile(null)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <div
        role="button"
        aria-label="Upload or drop satellite image"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan
          ${drag ? "border-neon-purple bg-neon-purple/5" : "border-border hover:border-neon-blue/60"}
          ${previewUrl ? "aspect-video" : "aspect-[2/1]"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {previewUrl ? (
          <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="p-4 rounded-full bg-primary/10 border border-primary/30">
              <Upload className="w-6 h-6 text-neon-cyan" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">Drop a satellite image</p>
              <p className="text-xs mt-1">PNG, JPG · or click to browse</p>
            </div>
          </div>
        )}
      </div>

      {file && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 truncate">
            <ImageIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{file.name}</span>
          </span>
          <span>{(file.size / 1024).toFixed(1)} KB</span>
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.98 }}
        disabled={!file || loading}
        onClick={onAnalyze}
        className="w-full py-3 rounded-xl font-semibold text-primary-foreground
                   bg-gradient-to-r from-neon-blue to-neon-purple
                   disabled:opacity-40 disabled:cursor-not-allowed
                   hover:shadow-[0_0_30px_-5px_var(--neon-purple)] transition-shadow"
      >
        {loading ? "Analyzing…" : "Run Inference"}
      </motion.button>
    </div>
  );
}
