import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VALOR_UF, formatCLP, formatUF, ufToCLP } from "@/data/mock-data";

type Moneda = "CLP" | "UF";

interface Props {
  label: string;
  /** Value always stored/returned in CLP */
  value: number;
  onChange: (clpValue: number) => void;
  id?: string;
}

export default function MontoInput({ label, value, onChange, id }: Props) {
  const [moneda, setMoneda] = useState<Moneda>("CLP");
  // Display value tracks what the user sees in the input
  const [displayValue, setDisplayValue] = useState<string>(value ? String(value) : "");

  const handleMonedaToggle = () => {
    const next: Moneda = moneda === "CLP" ? "UF" : "CLP";
    // Convert current CLP value to display in the new currency
    if (next === "UF") {
      setDisplayValue(value ? (value / VALOR_UF).toFixed(2) : "");
    } else {
      setDisplayValue(value ? String(value) : "");
    }
    setMoneda(next);
  };

  const handleChange = (raw: string) => {
    setDisplayValue(raw);
    const num = parseFloat(raw) || 0;
    if (moneda === "UF") {
      onChange(Math.round(num * VALOR_UF));
    } else {
      onChange(num);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "0") {
      setDisplayValue("");
    }
  };

  const handleBlur = () => {
    if (displayValue === "") {
      if (moneda === "UF") {
        setDisplayValue(value ? (value / VALOR_UF).toFixed(2) : "");
      } else {
        setDisplayValue(value ? String(value) : "");
      }
    }
  };

  // Reference line
  const ref = moneda === "CLP" && value > 0
    ? `≈ ${formatUF(value / VALOR_UF)}`
    : moneda === "UF" && value > 0
      ? `≈ ${formatCLP(value)}`
      : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <button
          type="button"
          onClick={handleMonedaToggle}
          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary transition-colors"
        >
          {moneda === "CLP" ? "$" : "UF"}
        </button>
      </div>
      <Input
        id={id}
        type="number"
        min={0}
        step={moneda === "UF" ? 0.01 : 1}
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={moneda === "CLP" ? "Monto en $" : "Monto en UF"}
      />
      {ref && <p className="text-[10px] text-muted-foreground">{ref}</p>}
    </div>
  );
}
