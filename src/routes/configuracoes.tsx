import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, RefreshCw, ShieldAlert, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  listEmpresasAdmin, createEmpresa,
  listLojasAdmin, createLoja,
  listUserEmpresas,
  listAuditLogs,
} from "@/lib/api/admin.functions";
import {
  getIntegrationStatus,
  getIntegrationConfig,
  saveIntegrationConfig,
  testBridgeConnection,
  testMaxApiConnection,
} from "@/lib/api/integrations.functions";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — FiscalStock" }] }),
  component: Config,
});

function Config() {
  const { canManageActiveCompany, isGlobalAdmin } = useAuth();
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Empresas, lojas, integrações, usuários, logs e contrato de integração.
          </p>
        </div>

        {!canManageActiveCompany && (
          <div className="flex items-start gap-2 rounded-md border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/5 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-[color:oklch(0.45_0.15_70)]" />
            <p>Você está em modo somente leitura. Apenas owner/admin pode alterar configurações.</p>
          </div>
        )}

        <Tabs defaultValue="empresas">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="empresas">Empresas</TabsTrigger>
            <TabsTrigger value="lojas">Lojas</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="contrato">Contrato de Integração</TabsTrigger>
          </TabsList>

          <TabsContent value="empresas"><EmpresasTab canEdit={isGlobalAdmin} /></TabsContent>
          <TabsContent value="lojas"><LojasTab canEdit={canManageActiveCompany} /></TabsContent>
          <TabsContent value="integracoes"><IntegracoesTab canEdit={canManageActiveCompany} /></TabsContent>
          <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
          <TabsContent value="contrato"><ContratoTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────── Empresas

function EmpresasTab({ canEdit }: { canEdit: boolean }) {
  const list = useServerFn(listEmpresasAdmin);
  const create = useServerFn(createEmpresa);
  const [rows, setRows] = useState<Array<{ id: string; nome_fantasia: string; cnpj: string | null; ativo: boolean }>>([]);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(""); const [cnpj, setCnpj] = useState("");

  async function reload() { try { setRows(await list()); } catch (e) { console.error(e); } }
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, []);

  async function handleCreate() {
    try { await create({ data: { nome_fantasia: nome, cnpj: cnpj || null } });
      toast.success("Empresa criada"); setOpen(false); setNome(""); setCnpj(""); void reload();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Empresas</CardTitle>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nova empresa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome fantasia</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
              </div>
              <DialogFooter><Button onClick={handleCreate} disabled={!nome}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.nome_fantasia}</TableCell>
                <TableCell className="font-mono text-sm">{e.cnpj ?? "—"}</TableCell>
                <TableCell><Badge variant={e.ativo ? "default" : "outline"}>{e.ativo ? "Ativa" : "Inativa"}</Badge></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────── Lojas

function LojasTab({ canEdit }: { canEdit: boolean }) {
  const { empresaAtiva } = useAuth();
  const list = useServerFn(listLojasAdmin);
  const create = useServerFn(createLoja);
  const [rows, setRows] = useState<Array<{ id: string; nome: string; emp_id_maxdata: string; terminal_maxdata: string; ativo: boolean }>>([]);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(""); const [emp, setEmp] = useState(""); const [term, setTerm] = useState("");

  async function reload() {
    try { setRows(await list({ data: { empresa_id: empresaAtiva?.id } })); }
    catch (e) { console.error(e); }
  }
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [empresaAtiva?.id]);

  async function handleCreate() {
    if (!empresaAtiva) return;
    try {
      await create({ data: { empresa_id: empresaAtiva.id, nome, emp_id_maxdata: emp, terminal_maxdata: term } });
      toast.success("Loja criada"); setOpen(false); setNome(""); setEmp(""); setTerm(""); void reload();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Lojas {empresaAtiva ? `— ${empresaAtiva.nome_fantasia}` : ""}</CardTitle>
        {canEdit && empresaAtiva && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nova loja</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova loja</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>emp_id_maxdata</Label><Input value={emp} onChange={(e) => setEmp(e.target.value)} placeholder="ex.: 1" /></div>
                  <div><Label>terminal_maxdata</Label><Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="ex.: TERM-01" /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={handleCreate} disabled={!nome || !emp || !term}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>emp_id</TableHead><TableHead>terminal</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.nome}</TableCell>
                <TableCell className="font-mono text-sm">{l.emp_id_maxdata}</TableCell>
                <TableCell className="font-mono text-sm">{l.terminal_maxdata}</TableCell>
                <TableCell><Badge variant={l.ativo ? "default" : "outline"}>{l.ativo ? "Ativa" : "Inativa"}</Badge></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Nenhuma loja para esta empresa.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────── Integrações

function IntegracoesTab({ canEdit }: { canEdit: boolean }) {
  const { lojaAtiva, empresaAtiva } = useAuth();
  const fetchStatus = useServerFn(getIntegrationStatus);
  const fetchConfig = useServerFn(getIntegrationConfig);
  const save = useServerFn(saveIntegrationConfig);
  const testBridge = useServerFn(testBridgeConnection);
  const testMax = useServerFn(testMaxApiConnection);

  const [bridgeUrl, setBridgeUrl] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [tokenConfigurado, setTokenConfigurado] = useState(false);
  const [maxUrl, setMaxUrl] = useState("");
  const [empId, setEmpId] = useState("");
  const [terminal, setTerminal] = useState("");
  const [info, setInfo] = useState<Awaited<ReturnType<typeof fetchStatus>> | null>(null);
  const [saving, setSaving] = useState(false);
  const [bridgeResult, setBridgeResult] = useState<{ status: string; mensagem: string } | null>(null);
  const [maxResult, setMaxResult] = useState<{ status: string; mensagem: string } | null>(null);

  async function reload() {
    if (!lojaAtiva) return;
    try {
      const [status, cfg] = await Promise.all([
        fetchStatus({ data: { loja_id: lojaAtiva.id } }),
        fetchConfig({ data: { loja_id: lojaAtiva.id } }),
      ]);
      setInfo(status);
      setBridgeUrl(cfg?.bridge_url ?? "");
      setMaxUrl(cfg?.maxapi_url ?? "");
      setEmpId(cfg?.emp_id_maxdata ?? "");
      setTerminal(cfg?.terminal_maxdata ?? "");
      setTokenConfigurado(!!cfg?.bridge_token_configurado);
      setBridgeToken("");
    } catch (e) { console.error(e); }
  }
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [lojaAtiva?.id]);

  if (!lojaAtiva) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Selecione uma loja no topo para configurar integrações.</CardContent></Card>;
  }

  async function handleSave() {
    setSaving(true);
    setBridgeResult(null); setMaxResult(null);
    try {
      await save({ data: {
        loja_id: lojaAtiva!.id,
        bridge_url: bridgeUrl || undefined,
        bridge_token: bridgeToken || undefined,
        maxapi_url: maxUrl || undefined,
        emp_id_maxdata: empId || undefined,
        terminal_maxdata: terminal || undefined,
      } });
      toast.success("Configuração salva. Testando conexões…");
      const [b, m] = await Promise.all([
        testBridge({ data: { loja_id: lojaAtiva!.id } }).catch((e) => ({ status: "erro", mensagem: (e as Error).message })),
        testMax({ data: { loja_id: lojaAtiva!.id } }).catch((e) => ({ status: "erro", mensagem: (e as Error).message })),
      ]);
      setBridgeResult(b);
      setMaxResult(m);
      void reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }
  async function runBridge() {
    const r = await testBridge({ data: { loja_id: lojaAtiva!.id } });
    setBridgeResult(r);
    toast[r.status === "online" ? "success" : "error"](r.mensagem);
    void reload();
  }
  async function runMax() {
    const r = await testMax({ data: { loja_id: lojaAtiva!.id } });
    setMaxResult(r);
    toast[r.status === "online" ? "success" : "error"](r.mensagem);
    void reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Integrações — {empresaAtiva?.nome_fantasia} / {lojaAtiva.nome}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Tokens nunca aparecem no frontend. Para alterar o token da Bridge,
          digite um valor novo. Deixe vazio para preservar o atual.
        </p>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded border p-3">
            <p className="text-xs text-muted-foreground">Bridge SQL</p>
            <div className="flex items-center gap-2">
              <Badge variant={info?.status_bridge === "online" ? "default" : "outline"}>
                {info?.status_bridge ?? "—"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {info?.bridge_configurada ? "configurada" : "não configurada"}
              </span>
            </div>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs text-muted-foreground">MaxAPI</p>
            <div className="flex items-center gap-2">
              <Badge variant={info?.status_maxapi === "online" ? "default" : "outline"}>
                {info?.status_maxapi ?? "—"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {info?.maxapi_configurada ? "configurada" : "não configurada"}
              </span>
            </div>
          </div>
        </div>

        <fieldset disabled={!canEdit} className="space-y-3 disabled:opacity-60">
          <div>
            <Label>URL da Bridge SQL</Label>
            <Input value={bridgeUrl} onChange={(e) => setBridgeUrl(e.target.value)} placeholder="https://bridge.cliente.local" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Token da Bridge</Label>
              {tokenConfigurado && (
                <span className="text-xs font-medium text-[color:oklch(0.55_0.15_150)]">
                  ✓ Token já configurado
                </span>
              )}
            </div>
            <Input
              type="password"
              value={bridgeToken}
              onChange={(e) => setBridgeToken(e.target.value)}
              placeholder={tokenConfigurado ? "••••••• (deixe vazio para não alterar)" : "Cole o token"}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label>URL da MaxAPI</Label>
            <Input value={maxUrl} onChange={(e) => setMaxUrl(e.target.value)} placeholder="https://maxapi.cliente.local" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>EmpID MaxData</Label><Input value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="1" /></div>
            <div><Label>Terminal MaxData</Label><Input value={terminal} onChange={(e) => setTerminal(e.target.value)} placeholder="36E1123..." /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={!canEdit || saving}>
              {saving ? "Salvando…" : "Salvar e testar"}
            </Button>
            <Button variant="outline" onClick={runBridge} disabled={!canEdit}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Testar Bridge</Button>
            <Button variant="outline" onClick={runMax} disabled={!canEdit}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Testar MaxAPI</Button>
          </div>
          {(bridgeResult || maxResult) && (
            <div className="space-y-2 rounded border bg-muted/30 p-3 text-xs">
              {bridgeResult && (
                <p>
                  <span className="font-semibold">Bridge:</span>{" "}
                  <Badge variant={bridgeResult.status === "online" ? "default" : "outline"} className="mr-1">{bridgeResult.status}</Badge>
                  {bridgeResult.mensagem}
                </p>
              )}
              {maxResult && (
                <p>
                  <span className="font-semibold">MaxAPI:</span>{" "}
                  <Badge variant={maxResult.status === "online" ? "default" : "outline"} className="mr-1">{maxResult.status}</Badge>
                  {maxResult.mensagem}
                </p>
              )}
            </div>
          )}
        </fieldset>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────── Usuários

function UsuariosTab() {
  const { empresaAtiva } = useAuth();
  const list = useServerFn(listUserEmpresas);
  const [rows, setRows] = useState<Array<{ id: string; user_id: string; role_na_empresa: string; nome: string; email: string }>>([]);

  useEffect(() => {
    if (!empresaAtiva) return;
    list({ data: { empresa_id: empresaAtiva.id } }).then(setRows).catch((e) => { console.error(e); toast.error((e as Error).message); });
  }, [empresaAtiva?.id, list]);

  if (!empresaAtiva) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Selecione uma empresa.</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Usuários vinculados — {empresaAtiva.nome_fantasia}</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          TODO CLAUDE/Lovable: adicionar fluxo de convite por e-mail.
        </p>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papel</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.nome}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell><Badge variant="outline">{u.role_na_empresa}</Badge></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Nenhum usuário vinculado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────── Logs

function LogsTab() {
  const { empresaAtiva, lojaAtiva } = useAuth();
  const list = useServerFn(listAuditLogs);
  const [rows, setRows] = useState<Array<{ id: string; created_at: string; acao: string; entidade: string | null; loja_id: string | null; user_id: string | null }>>([]);

  async function reload() {
    try { setRows(await list({ data: { empresa_id: empresaAtiva?.id, loja_id: lojaAtiva?.id, limit: 200 } })); }
    catch (e) { console.error(e); }
  }
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [empresaAtiva?.id, lojaAtiva?.id]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Logs de auditoria</CardTitle>
        <Button variant="outline" size="sm" onClick={reload}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>Entidade</TableHead><TableHead>Loja</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="font-mono text-xs">{l.acao}</TableCell>
                <TableCell className="text-xs">{l.entidade ?? "—"}</TableCell>
                <TableCell className="text-xs">{l.loja_id?.slice(0, 8) ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Nenhum log.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────── Contrato de Integração

function ContratoTab() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Contrato de Integração (handoff Lovable → Claude Code)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Esta aba documenta o contrato entre o frontend (Lovable) e a camada
          de integração real (Claude Code). O documento completo vive em{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">docs/lovable-claude-handoff.md</code>.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Server functions são o único ponto de chamada do frontend.</li>
          <li>Bridge SQL é interna e só acessada pelo backend, via queries nomeadas.</li>
          <li>Escritas em O.S. devem ocorrer somente pela MaxAPI (nunca SQL direto).</li>
          <li>Tokens/segredos nunca trafegam pro frontend.</li>
          <li>O cálculo fiscal atual é simulado e aguarda validação contra o MaxManager.</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Quando o Claude conectar a Bridge/MaxAPI reais, basta trocar
          <code className="mx-1 rounded bg-muted px-1">MockStockService</code> /
          <code className="mx-1 rounded bg-muted px-1">MockServiceOrderService</code>
          por suas variantes <code className="mx-1 rounded bg-muted px-1">Server*</code>
          no arquivo de adapter — sem alterar nenhuma tela.
        </p>
      </CardContent>
    </Card>
  );
}