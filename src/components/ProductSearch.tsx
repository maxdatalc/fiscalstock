import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function ProductSearch({
  value, onChange, placeholder = "Buscar por nome, código ou EAN...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 pl-9"
      />
    </div>
  );
}