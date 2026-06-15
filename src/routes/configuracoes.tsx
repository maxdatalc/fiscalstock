import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, RefreshCw, Settings2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  listEmpresasAdmin,
  createEmpresa,
  listLojasAdmin,
  createLoja,
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
import type { IntegrationStatusInfo } from "@/lib/api/integrations.functions";

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
            <TabsTrigger value="empresas">Empresas & Lojas</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="contrato">Contrato de Integração</TabsTrigger>
          </TabsList>

          <TabsContent value="empresas">
            <EmpresasLojasTab canEditGlobal={isGlobalAdmin} canEditLoja={canManageActiveCompany || isGlobalAdmin} />
          </TabsContent>
          <TabsContent value="logs">
            <LogsTab />
          </TabsContent>
          <TabsContent value="contrato">
            <ContratoTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────── Local types

type Empresa = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  ativo: boolean;
  created_at: string;
};

type Loja = {
  id: string;
  empresa_id: string;
  nome: string;
  emp_id_maxdata: string;
  terminal_maxdata: string;
  ativo: boolean;
  created_at: string;
};

type UserVinculo = {
  id: string;
  user_id: string;
  role_na_empresa: string;
  nome: string;
  email: string;
};

// ──────────────────────────────────────── EmpresasLojasTab

function EmpresasLojasTab({ canEditGlobal, canEditLoja }: { canEditGlobal: boolean; canEditLoja: boolean }) {
  const listEmpresas = useServerFn(listEmpresasAdmin);
  const doCreate = useServerFn(createEmpresa);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");

  async function reload() {
    try {
      setEmpresas((await listEmpresas()) as Empresa[]);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    void reload(); /* eslint-disable-next-line */
  }, []);

  async function handleCreate() {
    try {
      await doCreate({ data: { nome_fantasia: nome, cnpj: cnpj || null } });
      toast.success("Empresa criada");
      setDialogOpen(false);
      setNome("");
      setCnpj("");
      void reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Empresas</CardTitle>
        {canEditGlobal && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova empresa</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome fantasia</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!nome}>
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {empresas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
        ) : (
          <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
            {empresas.map((empresa) => (
              <EmpresaAccordionItem
                key={empresa.id}
                empresa={empresa}
                isOpen={openItems.includes(empresa.id)}
                canEditGlobal={canEditGlobal}
                canEditLoja={canEditLoja}
                onReloadEmpresas={reload}
              />
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────── EmpresaAccordionItem

function EmpresaAccordionItem({
  empresa,
  isOpen,
  canEditGlobal,
  canEditLoja,
  onReloadEmpresas,
}: {
  empresa: Empresa;
  isOpen: boolean;
  canEditGlobal: boolean;
  canEditLoja: boolean;
  onReloadEmpresas: () => void;
}) {
  const listLojas = useServerFn(listLojasAdmin);
  const listUsers = useServerFn(listUserEmpresas);
  const doCreateLoja = useServerFn(createLoja);

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [users, setUsers] = useState<UserVinculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lojaDialogOpen, setLojaDialogOpen] = useState(false);
  const [nomeL, setNomeL] = useState("");
  const [empIdL, setEmpIdL] = useState("");
  const [termL, setTermL] = useState("");
  const [configAberta, setConfigAberta] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || loaded) return;
    setLoading(true);
    Promise.all([
      listLojas({ data: { empresa_id: empresa.id } }) as Promise<Loja[]>,
      (listUsers({ data: { empresa_id: empresa.id } }) as Promise<UserVinculo[]>).catch(() => [] as UserVinculo[]),
    ])
      .then(([ls, us]) => {
        setLojas(ls);
        setUsers(us);
        setLoaded(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false)); /* eslint-disable-next-line */
  }, [isOpen, loaded, empresa.id]);

  async function handleCreateLoja() {
    try {
      await doCreateLoja({
        data: {
          empresa_id: empresa.id,
          nome: nomeL,
          emp_id_maxdata: empIdL,
          terminal_maxdata: termL,
        },
      });
      toast.success("Loja criada");
      setLojaDialogOpen(false);
      setNomeL("");
      setEmpIdL("");
      setTermL("");
      const ls = (await listLojas({ data: { empresa_id: empresa.id } })) as Loja[];
      setLojas(ls);
      onReloadEmpresas();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AccordionItem value={empresa.id} className="border-b last:border-b-0">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex flex-1 items-center gap-3 text-left">
          <div className="flex-1">
            <p className="font-semibold">{empresa.nome_fantasia}</p>
            {empresa.cnpj && <p className="font-mono text-xs text-muted-foreground">{empresa.cnpj}</p>}
          </div>
          {loaded && <span className="text-xs text-muted-foreground">{lojas.length} loja(s)</span>}
          <Badge variant={empresa.ativo ? "default" : "outline"}>{empresa.ativo ? "Ativa" : "Inativa"}</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        {loading && (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-1/3" />
          </div>
        )}
        {!loading && loaded && (
          <div className="space-y-6 pt-2">
            {/* ── Lojas ── */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lojas vinculadas</p>
                {canEditGlobal && (
                  <Dialog open={lojaDialogOpen} onOpenChange={setLojaDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Nova loja
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova loja — {empresa.nome_fantasia}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label>Nome</Label>
                          <Input value={nomeL} onChange={(e) => setNomeL(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>emp_id_maxdata</Label>
                            <Input value={empIdL} onChange={(e) => setEmpIdL(e.target.value)} placeholder="ex.: 1" />
                          </div>
                          <div>
                            <Label>terminal_maxdata</Label>
                            <Input
                              value={termL}
                              onChange={(e) => setTermL(e.target.value)}
                              placeholder="ex.: TERM-01"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleCreateLoja} disabled={!nomeL || !empIdL || !termL}>
                          Criar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {lojas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma loja cadastrada para esta empresa.</p>
              ) : (
                <div className="space-y-2">
                  {lojas.map((loja) => (
                    <LojaCard
                      key={loja.id}
                      loja={loja}
                      empresaNome={empresa.nome_fantasia}
                      canEdit={canEditLoja}
                      isConfigOpen={configAberta === loja.id}
                      onToggleConfig={() => setConfigAberta(configAberta === loja.id ? null : loja.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Usuários ── */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Usuários vinculados
              </p>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum usuário vinculado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.nome}</TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.role_na_empresa}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

// ──────────────────────────────────────── LojaCard

function LojaCard({
  loja,
  empresaNome,
  canEdit,
  isConfigOpen,
  onToggleConfig,
}: {
  loja: Loja;
  empresaNome: string;
  canEdit: boolean;
  isConfigOpen: boolean;
  onToggleConfig: () => void;
}) {
  const fetchStatus = useServerFn(getIntegrationStatus);
  const [status, setStatus] = useState<IntegrationStatusInfo | null>(null);

  async function refreshStatus() {
    try {
      setStatus(await fetchStatus({ data: { loja_id: loja.id } }));
    } catch {
      // loja pode não ter config ainda
    }
  }

  useEffect(() => {
    void refreshStatus(); /* eslint-disable-next-line */
  }, []);

  return (
    <div className="rounded-md border">
      <div className="flex items-start gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{loja.nome}</span>
            <Badge variant="secondary" className="font-mono text-xs">
              emp_id: {loja.emp_id_maxdata}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {loja.terminal_maxdata}
            </Badge>
            <Badge variant={loja.ativo ? "default" : "outline"}>{loja.ativo ? "Ativa" : "Inativa"}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {status ? (
              <>
                <Badge variant={status.status_bridge === "online" ? "default" : "outline"} className="text-xs">
                  Bridge {status.status_bridge === "online" ? "✓" : "—"}
                </Badge>
                <Badge variant={status.status_maxapi === "online" ? "default" : "outline"} className="text-xs">
                  MaxAPI {status.status_maxapi === "online" ? "✓" : "—"}
                </Badge>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">verificando…</span>
            )}
          </div>
        </div>
        {canEdit && (
          <Button size="sm" variant={isConfigOpen ? "default" : "outline"} onClick={onToggleConfig}>
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            {isConfigOpen ? "Fechar" : "Configurar"}
          </Button>
        )}
      </div>
      {isConfigOpen && (
        <div className="border-t p-4">
          <LojaIntegrationPanel
            loja_id={loja.id}
            loja_nome={loja.nome}
            empresa_nome={empresaNome}
            canEdit={canEdit}
            onSaved={refreshStatus}
          />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────── LojaIntegrationPanel

function LojaIntegrationPanel({
  loja_id,
  loja_nome,
  empresa_nome,
  canEdit,
  onSaved,
}: {
  loja_id: string;
  loja_nome: string;
  empresa_nome: string;
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const fetchConfig = useServerFn(getIntegrationConfig);
  const fetchStatus = useServerFn(getIntegrationStatus);
  const save = useServerFn(saveIntegrationConfig);
  const testBridge = useServerFn(testBridgeConnection);
  const testMax = useServerFn(testMaxApiConnection);

  const [bridgeUrl, setBridgeUrl] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [tokenConfigurado, setTokenConfigurado] = useState(false);
  const [maxUrl, setMaxUrl] = useState("");
  const [empId, setEmpId] = useState("");
  const [terminal, setTerminal] = useState("");
  const [info, setInfo] = useState<IntegrationStatusInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [bridgeResult, setBridgeResult] = useState<{ status: string; mensagem: string } | null>(null);
  const [maxResult, setMaxResult] = useState<{ status: string; mensagem: string } | null>(null);

  async function reload() {
    try {
      const [status, cfg] = await Promise.all([fetchStatus({ data: { loja_id } }), fetchConfig({ data: { loja_id } })]);
      setInfo(status);
      setBridgeUrl(cfg?.bridge_url ?? "");
      setMaxUrl(cfg?.maxapi_url ?? "");
      setEmpId(cfg?.emp_id_maxdata ?? "");
      setTerminal(cfg?.terminal_maxdata ?? "");
      setTokenConfigurado(!!cfg?.bridge_token_configurado);
      setBridgeToken("");
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    void reload(); /* eslint-disable-next-line */
  }, [loja_id]);

  async function handleSave() {
    setSaving(true);
    setBridgeResult(null);
    setMaxResult(null);
    try {
      await save({
        data: {
          loja_id,
          bridge_url: bridgeUrl || undefined,
          bridge_token: bridgeToken || undefined,
          maxapi_url: maxUrl || undefined,
          emp_id_maxdata: empId || undefined,
          terminal_maxdata: terminal || undefined,
        },
      });
      toast.success("Configuração salva. Testando conexões…");
      const [b, m] = await Promise.all([
        testBridge({ data: { loja_id } }).catch((e) => ({
          status: "erro",
          mensagem: (e as Error).message,
        })),
        testMax({ data: { loja_id } }).catch((e) => ({
          status: "erro",
          mensagem: (e as Error).message,
        })),
      ]);
      setBridgeResult(b);
      setMaxResult(m);
      void reload();
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runBridge() {
    try {
      const r = await testBridge({ data: { loja_id } });
      setBridgeResult(r);
      toast[r.status === "online" ? "success" : "error"](r.mensagem);
      void reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function runMax() {
    try {
      const r = await testMax({ data: { loja_id } });
      setMaxResult(r);
      toast[r.status === "online" ? "success" : "error"](r.mensagem);
      void reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground">
        Integração — {empresa_nome} / {loja_nome}
      </p>
      <p className="text-xs text-muted-foreground">
        Tokens nunca aparecem no frontend. Para alterar o token da Bridge, digite um valor novo. Deixe vazio para
        preservar o atual.
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
          <Input
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            placeholder="https://bridge.cliente.local"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label>Token da Bridge</Label>
            {tokenConfigurado && (
              <span className="text-xs font-medium text-[color:oklch(0.55_0.15_150)]">✓ Token já configurado</span>
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
          <Input
            value={maxUrl}
            onChange={(e) => setMaxUrl(e.target.value)}
            placeholder="https://maxapi.cliente.local"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>EmpID MaxData</Label>
            <Input value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="1" />
          </div>
          <div>
            <Label>Terminal MaxData</Label>
            <Input value={terminal} onChange={(e) => setTerminal(e.target.value)} placeholder="36E1123..." />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={!canEdit || saving}>
            {saving ? "Salvando…" : "Salvar e testar"}
          </Button>
          <Button variant="outline" onClick={runBridge} disabled={!canEdit}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Testar Bridge
          </Button>
          <Button variant="outline" onClick={runMax} disabled={!canEdit}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Testar MaxAPI
          </Button>
        </div>
        {(bridgeResult || maxResult) && (
          <div className="space-y-2 rounded border bg-muted/30 p-3 text-xs">
            {bridgeResult && (
              <p>
                <span className="font-semibold">Bridge:</span>{" "}
                <Badge variant={bridgeResult.status === "online" ? "default" : "outline"} className="mr-1">
                  {bridgeResult.status}
                </Badge>
                {bridgeResult.mensagem}
              </p>
            )}
            {maxResult && (
              <p>
                <span className="font-semibold">MaxAPI:</span>{" "}
                <Badge variant={maxResult.status === "online" ? "default" : "outline"} className="mr-1">
                  {maxResult.status}
                </Badge>
                {maxResult.mensagem}
              </p>
            )}
          </div>
        )}
      </fieldset>
    </div>
  );
}

// ──────────────────────────────────────── LogsTab

function LogsTab() {
  const { empresaAtiva, lojaAtiva } = useAuth();
  const list = useServerFn(listAuditLogs);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      created_at: string;
      acao: string;
      entidade: string | null;
      loja_id: string | null;
      user_id: string | null;
    }>
  >([]);

  async function reload() {
    try {
      setRows(
        await list({
          data: { empresa_id: empresaAtiva?.id, loja_id: lojaAtiva?.id, limit: 200 },
        }),
      );
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    void reload(); /* eslint-disable-next-line */
  }, [empresaAtiva?.id, lojaAtiva?.id]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Logs de auditoria</CardTitle>
        <Button variant="outline" size="sm" onClick={reload}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Loja</TableHead>
            </TableRow>
          </TableHeader>
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
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum log.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────── ContratoTab

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
          Esta aba documenta o contrato entre o frontend (Lovable) e a camada de integração real (Claude Code). O
          documento completo vive em{" "}
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
