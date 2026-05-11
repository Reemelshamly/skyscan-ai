import { Cpu } from "lucide-react";
import { AVAILABLE_MODELS, type ModelId } from "@/lib/predict.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value: ModelId;
  onChange: (id: ModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-muted-foreground" />
        <label className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Model
        </label>
      </div>

      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_MODELS.map((m) => (
            <SelectItem key={m.id} value={m.id} disabled={!m.enabled}>
              <div className="flex items-center gap-2">
                <span>{m.label}</span>
                {!m.enabled && (
                  <span className="text-[10px] text-muted-foreground">(Coming soon)</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}