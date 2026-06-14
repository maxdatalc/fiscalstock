import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Empresa } from "@/lib/types";
import { Activity, Wifi, WifiOff, AlertTriangle } from "lucide-react";

export function IntegrationStatusCard({ empresa, onTest }: { empresa: Empresa; onTest?: (id: string) => void }) {
  const statusMap = {
    online: { icon: <Wifi className="h-4 w-4" />, label: "Online", cls: "text-[color:var(--success)]" },
    instavel: { icon: <AlertTriangle className="h-4 w-4" />, label: "Instável", cls: "text-[color:oklch(0.55_0.17_70)]" },
    offline: { icon: <WifiOff className="h-4 w-4" />, label: "Offline", cls: "text-destructive" },
  }[empresa.statusConexao];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{empresa.nome}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">empId: {empresa.empId} • Terminal: {empresa.terminal}</p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>Bridge SQL: <span className="font-mono text-foreground/80">{empresa.bridgeUrl}</span></p>
              <p>MaxAPI: <span className="font-mono text-foreground/80">{empresa.maxApiUrl}</span></p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${statusMap.cls}`}>
            {statusMap.icon}
            {statusMap.label}
          </div>
        </div>
        {onTest && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onTest(empresa.id)}>
              <Activity className="mr-1.5 h-4 w-4" /> Testar conexão
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}