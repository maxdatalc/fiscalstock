import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { IntegrationStatusCard } from "@/components/IntegrationStatusCard";
import { AuditLogTable } from "@/components/AuditLogTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listarEmpresas, listarLogs, testarConexao } from "@/lib/services/integration.service";
import { toast } from "sonner";
import type { Empresa, LogIntegracao } from "@/lib/types";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — FiscalStock" }] }),
  component: Config,
});

function Config() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [logs, setLogs] = useState<LogIntegracao[]>([]);

  useEffect(() => {
    listarEmpresas().then(setEmpresas);
    listarLogs().then(setLogs);
  }, []);

  async function onTest(id: string) {
    const r = await testarConexao(id);
    if (r.ok) toast.success(`Conexão OK (${r.latenciaMs}ms)`);
    else toast.error("Falha na conexão");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Empresas, integrações e logs de auditoria.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Empresas / Lojas</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Tokens e segredos da Bridge SQL e MaxAPI nunca são exibidos no frontend. Configure-os no servidor.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {empresas.map((e) => (
                <IntegrationStatusCard key={e.id} empresa={e} onTest={onTest} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Logs de consulta e integração</CardTitle></CardHeader>
          <CardContent>
            <AuditLogTable logs={logs} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}