import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Wifi, WifiOff, AlertTriangle, Database, Server, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFiscalAuth } from "@/lib/fiscal-auth-context";
import { getIntegrationStatus, type IntegrationStatusInfo } from "@/lib/api/integrations.functions";

function StatusPill({ label, status, icon }: { label: string; status: string; icon: React.ReactNode }) {
  const map: Record<string, { cls: string; text: string; Icon: typeof Wifi }> = {
    online: { cls: "text-[color:var(--success)]", text: "Online", Icon: Wifi },
    offline: { cls: "text-destructive", text: "Offline", Icon: WifiOff },
    erro: { cls: "text-destructive", text: "Erro", Icon: AlertTriangle },
    nao_configurado: { cls: "text-muted-foreground", text: "NÃ£o configurada", Icon: AlertTriangle },
  };
  const m = map[status] ?? map.nao_configurado;
  const Ico = m.Icon;
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`flex items-center gap-1 text-sm font-medium ${m.cls}`}>
          <Ico className="h-3.5 w-3.5" /> {m.text}
        </p>
      </div>
    </div>
  );
}

export function IntegrationStatusBanner() {
  const { lojaAtiva, empresaAtiva } = useFiscalAuth();
  const fetchStatus = useServerFn(getIntegrationStatus);
  const [info, setInfo] = useState<IntegrationStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!lojaAtiva) return;
    setLoading(true);
    try {
      const r = await fetchStatus({ data: { loja_id: lojaAtiva.id } });
      setInfo(r);
    } catch (e) {
      console.error(e);
      setInfo(null);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lojaAtiva?.id]);

  if (!lojaAtiva) return null;

  const naoConfigurada = !info || (!info.bridge_configurada && !info.maxapi_configurada);
  const lastBridge = info?.ultimo_teste_bridge ? new Date(info.ultimo_teste_bridge).toLocaleString("pt-BR") : "â€”";
  const lastMax = info?.ultimo_teste_maxapi ? new Date(info.ultimo_teste_maxapi).toLocaleString("pt-BR") : "â€”";

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label="Bridge SQL" status={info?.status_bridge ?? "nao_configurado"} icon={<Database className="h-4 w-4" />} />
          <StatusPill label="MaxAPI" status={info?.status_maxapi ?? "nao_configurado"} icon={<Server className="h-4 w-4" />} />
          <div className="rounded-md border bg-card px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Loja ativa</p>
            <p className="text-sm font-medium">{lojaAtiva.nome}</p>
            <p className="text-[11px] text-muted-foreground">
              empId {lojaAtiva.emp_id_maxdata} â€¢ term {lojaAtiva.terminal_maxdata} â€¢ {empresaAtiva?.nome_fantasia}
            </p>
          </div>
          <div className="rounded-md border bg-card px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ãšltimo teste</p>
            <p className="text-xs">Bridge: {lastBridge}</p>
            <p className="text-xs">MaxAPI: {lastMax}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {naoConfigurada && (
            <span className="flex items-center gap-1 text-xs text-[color:oklch(0.55_0.17_70)]">
              <AlertTriangle className="h-4 w-4" /> IntegraÃ§Ã£o ainda nÃ£o configurada.
            </span>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
