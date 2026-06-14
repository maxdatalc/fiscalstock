# FiscalStock MaxData — Handoff Lovable → Claude Code

Este documento descreve o contrato entre o frontend construído no Lovable e a
camada de integração real que será implementada pelo Claude Code. O objetivo
é deixar o frontend, o schema e as server functions prontos para receber a
integração definitiva com a **Bridge SQL** (SQL Server MaxData) e a **MaxAPI**
sem que o Lovable precise mexer em telas.

> ⚠️ Nada neste documento define a fórmula real do estoque fiscal nem mapeia
> tabelas SQL do MaxData. Essas decisões são do Claude Code.

---

## 1. Tabelas criadas no Lovable Cloud (Supabase)

| Tabela                 | Função                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| `profiles`             | Espelha `auth.users` com `nome`, `email`, `role` global (owner/admin/...) |
| `empresas`             | Empresas (clientes MaxData)                                               |
| `lojas`                | Lojas/filiais; **`emp_id_maxdata` + `terminal_maxdata` parametrizam Bridge/MaxAPI** |
| `user_empresas`        | Vínculo N×N usuário ↔ empresa, com `role_na_empresa`                      |
| `integration_configs`  | URL da Bridge, URL/Client/Secret da MaxAPI, cache de token, status        |
| `audit_logs`           | Auditoria de ações sensíveis (consultas, tentativas em risco, testes)     |
| `stock_cache`          | Cache opcional de saldos consultados                                      |
| `service_order_cache`  | Cache opcional de O.S. lidas                                              |

RLS está habilitado em todas as tabelas, com policies que usam as funções
`is_global_admin`, `user_has_empresa`, `user_can_manage_empresa`,
`user_can_access_loja` e `user_can_manage_loja` (SECURITY DEFINER).

---

## 2. Server functions existentes

Todas em `src/lib/api/*.functions.ts`. **Não há SQL direto no frontend.**

### `user-context.functions.ts`
- `getCurrentUserContext()` → empresas/lojas visíveis ao usuário logado.

### `stock.functions.ts` (mockadas — TODO CLAUDE)
- `searchProducts({ loja_id, termo })` → `ProdutoListItem[]`
- `getProductStockDetail({ loja_id, produto_id })` → `ProductStockDetail | null`

### `service-orders.functions.ts` (mockadas — TODO CLAUDE)
- `listServiceOrders({ loja_id, cliente?, placa?, status? })`
- `addItemToServiceOrder({ loja_id, os_id, produto_id, quantidade })`
  - Já grava `audit_logs.acao = 'TENTOU_ADICIONAR_ITEM_SEM_ESTOQUE_FISCAL'`
    quando `quantidade > estoque_fiscal`.

### `integrations.functions.ts`
- `getIntegrationStatus({ loja_id })` → flags e status (sem expor segredos).
- `testBridgeConnection({ loja_id })` → atualmente simulado.
- `testMaxApiConnection({ loja_id })` → atualmente simulado; tem cache de token.

### `admin.functions.ts`
- `listEmpresasAdmin`, `createEmpresa`
- `listLojasAdmin`, `createLoja`
- `listUserEmpresas`
- `upsertIntegrationConfig` (preserva `maxapi_secret_key` se vier vazio)
- `listAuditLogs`

---

## 3. Arquivos principais

| Arquivo                                            | Função                                         |
| -------------------------------------------------- | ---------------------------------------------- |
| `src/lib/auth-context.tsx`                         | Sessão + empresa/loja ativa                    |
| `src/components/AppShell.tsx`                      | Layout, seletor de empresa/loja                |
| `src/components/RequireLoja.tsx`                   | Gate de loja obrigatória                       |
| `src/components/IntegrationStatusBanner.tsx`       | Banner Bridge/MaxAPI no topo do Dashboard      |
| `src/lib/services/stock-adapter.ts`                | `MockStockService` / `ServerStockService`      |
| `src/lib/services/service-order-adapter.ts`        | `MockServiceOrderService` / `ServerServiceOrderService` |
| `src/lib/types.ts`                                 | Contratos TypeScript estáveis                  |
| `src/routes/{dashboard,produto.$id,ordens*}.tsx`   | Telas — todas exigem `lojaAtiva` via RequireLoja |
| `src/routes/configuracoes.tsx`                     | Abas: Empresas, Lojas, Integrações, Usuários, Logs, Contrato |

---

## 4. Interfaces TypeScript (contratos)

Definidas em `src/lib/types.ts`:

- `EmpresaRef`, `LojaRef`
- `IntegrationConfig`
- `ProductSummary`
- `ProductStockDetail`
- `FiscalStockComposition` (com flag `validada: boolean`)
- `StockRiskStatus` = `"ok" | "atencao" | "bloqueado"`
- `ServiceOrder`, `ServiceOrderItem`
- `AuditLog`

Funções utilitárias: `calcularStatusFiscal(p)`, `disponivelParaEmissao(p)`.

---

## 5. Adapters (ponto de troca)

```ts
// src/lib/services/stock-adapter.ts
export const stockService: IStockService = new ServerStockService();
// trocar por new MockStockService() para fallback offline.

// src/lib/services/service-order-adapter.ts
export const serviceOrderService: IServiceOrderService = new ServerServiceOrderService();
```

As classes `Server*` chamam server functions; as `Mock*` retornam dados de
`src/lib/services/mock-data.ts`. Quando o Claude implementar a integração
real, basta substituir o **conteúdo do `.handler()`** das server functions —
o frontend continua igual.

---

## 6. Mocks ainda presentes

- `src/lib/services/mock-data.ts` (produtos, ordens, empresas de exemplo, logs).
- Handlers de `searchProducts`, `getProductStockDetail`,
  `listServiceOrders`, `addItemToServiceOrder` ainda leem `mockProdutos`/`mockOrdens`.
- `testBridgeConnection` e `testMaxApiConnection` simulam resposta (`Math.random`).
- `services/stock.service.ts`, `services/service-order.service.ts`,
  `services/integration.service.ts` ainda existem como mocks; podem ser
  removidos quando o adapter for usado em 100% dos componentes (mantidos como
  fallback de segurança).

---

## 7. O que Claude Code precisa implementar

1. **Mapear tabelas reais do SQL Server MaxData** (produtos, estoque físico,
   movimentações fiscais, inventário base, devoluções, ajustes).
2. **Validar a fórmula correta de estoque fiscal** contra o MaxManager.
3. **Criar queries nomeadas seguras na Bridge SQL** (whitelisted, parametrizadas
   por `emp_id_maxdata`). Nunca permitir SQL livre vindo do frontend.
4. **Implementar as chamadas reais** dentro de:
   - `searchProducts.handler` (Bridge SQL — listagem)
   - `getProductStockDetail.handler` (Bridge SQL — composição + saldos)
   - `listServiceOrders.handler` (MaxAPI — leitura de O.S.)
   - `addItemToServiceOrder.handler` (**MaxAPI — único caminho de escrita**)
   - `testBridgeConnection.handler` (ping real)
   - `testMaxApiConnection.handler` (autenticação real + cache de token)
5. **Setar `composicao_estoque_fiscal.validada = true`** apenas quando a
   fórmula bater com o MaxManager.
6. **Não escrever em O.S. via SQL direto.** Sempre MaxAPI.
7. **Manter os mocks** funcionando para o ambiente de demo/preview.

---

## 8. Payloads esperados

### `searchProducts`

```ts
// Input
{ loja_id?: string; termo?: string }

// Output: ProductSummary[]
{
  id: string;
  codigo: string;
  codigoBarras: string;
  nome: string;
  unidade: string;
  estoqueFisico: number;
  estoqueFiscal: number;
}[]
```

### `getProductStockDetail`

```ts
// Input
{ loja_id?: string; produto_id: string }

// Output: ProductStockDetail | null
{
  produto: { id, codigo, codigoBarras, nome, unidade },
  estoque_fisico: number,
  estoque_fiscal: number,
  diferenca: number,
  status_risco: "ok" | "atencao" | "bloqueado",
  composicao_estoque_fiscal: {
    inventario_base, entradas, saidas, devolucoes, ajustes,
    validada: boolean,           // false enquanto mock
  },
  pode_emitir_nf: boolean,
  pode_lancar_os: boolean,
  disponivel_para_emissao: number,
  alertas: { tipo: "warning"|"danger"; mensagem: string }[],
}
```

### `listServiceOrders`

```ts
// Input
{ loja_id?: string; cliente?: string; placa?: string; status?: string }

// Output: ServiceOrder[] (ver src/lib/types.ts)
```

### `addItemToServiceOrder`

```ts
// Input
{ loja_id?: string; os_id: string; produto_id: string; quantidade: number }

// Output
{ ok: boolean; excedeu_fiscal: boolean; alerta: string | null }
```

### `testBridgeConnection`

```ts
// Input  : { loja_id: string }
// Output : { status: "online"|"offline"|"erro"|"nao_configurado"; mensagem: string }
```

### `testMaxApiConnection`

```ts
// Input  : { loja_id: string }
// Output : {
//   status: "online"|"offline"|"erro"|"nao_configurado",
//   mensagem: string,
//   token_cached_until: string | null,   // ISO
// }
```

---

## 9. Regras de segurança que devem ser mantidas

- Frontend só chama server functions; nada de fetch direto à Bridge/MaxAPI.
- `maxapi_secret_key`, tokens, URLs internas: **nunca** retornar pro frontend.
  O `getIntegrationStatus` devolve apenas flags `*_configurada` e status.
- Toda mutação de integração e toda escrita em O.S. precisa de
  `user_can_manage_loja(auth.uid(), loja_id)`.
- Toda consulta valida `user_can_access_loja(auth.uid(), loja_id)`.
- Toda ação relevante deve gerar registro em `audit_logs`.