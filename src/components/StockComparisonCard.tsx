import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

export function StockComparisonCard({
  label, value, hint, tone = "default", icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  icon?: ReactNode;
}) {
  const toneCls = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-[color:var(--success)]",
    warning: "text-[color:oklch(0.55_0.17_70)]",
    danger: "text-destructive",
  }[tone];
  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums ${toneCls}`}>{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {icon && <div className="rounded-md bg-secondary p-2 text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}