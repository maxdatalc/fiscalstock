import type { StatusFiscal } from "@/lib/types";

const cfg: Record<StatusFiscal, { label: string; cls: string }> = {
  ok: { label: "Pode emitir", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" },
  atencao: { label: "Atenção", cls: "bg-[color:var(--warning)]/15 text-[color:oklch(0.5_0.15_70)] border-[color:var(--warning)]/40" },
  bloqueado: { label: "Bloqueado fiscalmente", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function FiscalPhysicalBadge({ status }: { status: StatusFiscal }) {
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  );
}