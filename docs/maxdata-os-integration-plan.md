# FiscalStock MaxData — Plano de Integração da Tela de O.S.

**Data:** 2026-06-14  
**Status:** Implementado (mocks substituídos por integrações reais)

---

## 1. Objetivo

Permitir que a tela de O.S. do FiscalStock MaxData:

1. **Consulte** ordens de serviço em aberto e seus itens via Bridge SQL (leitura direta no BATAUTO).
2. **Busque** produtos com estoque físico e calcule o estoque fiscal via Bridge SQL.
3. **Adicione itens** em O.S. via MaxAPI com validação dupla (físico + fiscal) antes do POST.
4. **Audite** cada operação sensível no Supabase (`audit_logs`).

---

## 2. Arquitetura de Segurança

```
Browser / UI
    │  (apenas loja_id + params tipados)
    ▼
Server Functions (TanStack Start — createServerFn)
    │  ─── leitura ──▶  Bridge SQL (BATAUTO / SQL Server)
    │  ─── escrita ──▶  MaxAPI (REST oficial MaxData)
    │  ─── auditoria ─▶ Supabase audit_logs
    ▼
Supabase (PostgreSQL — app data + cache de token)
```

**Regras invioláveis:**
- Frontend envia `loja_id` + params tipados — nunca SQL.
- Nenhuma escrita direta no SQL Server (sem INSERT/UPDATE/DELETE via Bridge).
- Token MaxAPI nunca chega ao browser e nunca aparece em logs.
- Toda query de leitura usa named queries (`named-queries.ts`) — sem SQL livre.
- Toda escrita em O.S. passa pela MaxAPI oficial.

---

## 3. Arquivos Criados / Alterados

### Novos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260614210000_add_bridge_token.sql` | Adiciona `bridge_token TEXT` à `integration_configs` |
| `src/lib/bridge/bridge-client.ts` | HTTP client para Bridge SQL (`queryBridge`, `pingBridge`) |
| `src/lib/bridge/named-queries.ts` | Registry de 6 named queries + resolver (`resolveNamedQuery`) |
| `src/lib/maxapi/maxapi-types.ts` | Tipos TypeScript do Swagger MaxAPI v2 |
| `src/lib/maxapi/maxapi-client.ts` | MaxAPI client com cache JWT + retry 401 automático |
| `src/lib/fiscal/stock-status.ts` | Enum `StockStatusCode` + `deriveStockStatus()` |
| `src/lib/fiscal/calculate-fiscal-stock.ts` | `calculateFiscalStock()` + `validateStockForOsItem()` |

### Arquivos atualizados (mocks removidos)

| Arquivo | O que mudou |
|---|---|
| `src/lib/api/stock.functions.ts` | `searchProducts` e `getProductStockDetail` usam Bridge SQL real |
| `src/lib/api/service-orders.functions.ts` | `listServiceOrders` via Bridge, `addItemToServiceOrder` valida estoque e grava via MaxAPI |
| `src/lib/api/integrations.functions.ts` | `testBridgeConnection` usa `pingBridge` real; `testMaxApiConnection` autentica na MaxAPI real |

---

## 4. Bridge SQL — Named Queries

Todas as queries vivem em `src/lib/bridge/named-queries.ts` e são resolvidas pelo servidor. O frontend nunca envia SQL.

| Query Name | Tabelas | Uso |
|---|---|---|
| `SEARCH_PRODUCTS` | `produto`, `produto_empresa` | Busca por descrição/código |
| `GET_PRODUCT_PHYSICAL_STOCK` | `produto`, `produto_empresa` | Estoque físico de 1 produto |
| `GET_FISCAL_STOCK_COMPOSITION` | `InventarioItem`, `Inventario`, `nfItem`, `nf`, `produtoAcertoEstoque`, `produtoAcertoEstoqueItem` | Fórmula fiscal completa (CTE) |
| `LIST_OPEN_SERVICE_ORDERS` | `venda`, `cliente` | Lista O.S. abertas (`vedTipo='OS'`, `vedStatus='A'`) |
| `GET_SERVICE_ORDER_DETAIL` | `venda`, `cliente` | Detalhe de 1 O.S. |
| `GET_SERVICE_ORDER_ITEMS` | `vendaItem`, `produto` | Itens de 1 O.S. (excl. cancelados) |

---

## 5. Fórmula do Estoque Fiscal

Validada contra BATAUTO em 2026-06-14 (proId=15788, empId=1 → resultado=898 = proEstoqueAtual).

```
Estoque Fiscal = InventárioBase
               + Entradas NF (nfTipoNf='E', nfStatus='F', CFOP ∉ {1202,2202,5202,6202}, após inventário)
               + Devoluções  (nfStatus='F', CFOP ∈ {1202,2202}, após inventário)
               − Saídas NF   (nfTipoNf='S', nfStatus='F', após inventário)
               + Ajustes     (paeStatus='F', paiQtdInf − paiProEstoque, após inventário)
```

**ATENÇÃO:** Não alterar esta fórmula sem:
1. Registrar o motivo neste documento.
2. Executar query de reconciliação no BATAUTO e confirmar resultado.
3. Não avançar para finalização de NF sem nova validação fiscal completa.

---

## 6. MaxAPI — Autenticação e Cache de Token

**Endpoint de auth:** `POST {maxapi_url}/v2/auth`  
**Body:** `{ "empId": number, "terminal": string }`  
**Response:** `TokenDto { token, expiration, empId, terminal, ... }`

### Cache (Supabase `integration_configs`)

| Campo | Tipo | Conteúdo |
|---|---|---|
| `maxapi_token_cache` | TEXT | JWT Bearer (criptografado em repouso pelo Supabase) |
| `maxapi_token_expires_at` | TIMESTAMPTZ | Expiração do JWT |

- Token é reutilizado enquanto `expiration - agora > 5 minutos`.
- Em caso de 401 na MaxAPI, o token é refeito automaticamente uma vez.
- Token NUNCA aparece em logs, audit_logs ou respostas ao browser.

### Credenciais necessárias por loja

Configure em `integration_configs` via admin:

| Campo Supabase | Conteúdo |
|---|---|
| `bridge_url` | URL da Bridge SQL (ex: `https://batautobridge.lcgestor.com.br`) |
| `bridge_token` | Bearer token da Bridge |
| `maxapi_url` | URL base da MaxAPI (ex: `https://api.maxdata.com.br`) |
| `maxapi_client_id` | CF-Access-Client-Id (ou client credential MaxAPI) |
| `maxapi_secret_key` | CF-Access-Client-Secret (ou secret MaxAPI) |

E na tabela `lojas`:

| Campo | Conteúdo |
|---|---|
| `emp_id_maxdata` | empId da empresa no MaxData (ex: `"1"`) |
| `terminal_maxdata` | Código do terminal MaxManager |

---

## 7. Fluxo de Adição de Item na O.S.

```
UI: usuário seleciona OS + produto + quantidade
    │
    ▼ POST /api/addItemToServiceOrder
Server Function
    │
    ├─ 1. Verifica permissão (user_can_access_loja via Supabase RPC)
    ├─ 2. Carrega config (bridge + maxapi) do Supabase
    ├─ 3. Bridge SQL: GET_PRODUCT_PHYSICAL_STOCK → estoque físico
    ├─ 4. Bridge SQL: GET_FISCAL_STOCK_COMPOSITION → estoque fiscal (CTE)
    ├─ 5. deriveStockStatus(físico, fiscal, qtd) → StockStatusCode
    │
    ├─ 6a. Se blocked=true:
    │      └─ audit_log BLOQUEOU_ADICIONAR_ITEM_OS → throw (UI mostra erro)
    │
    ├─ 6b. Se warning=true e forcar_sem_fiscal=false:
    │      └─ audit_log ADVERTENCIA_ESTOQUE_FISCAL_OS
    │         → return { requer_confirmacao: true, alerta: "..." }
    │         → UI exibe modal de confirmação; usuário re-envia com forcar_sem_fiscal=true
    │
    └─ 7. MaxAPI POST /v2/serviceorder/items (única escrita permitida)
           └─ audit_log ADICIONOU_ITEM_OS → return { ok: true, item_adicionado }
```

---

## 8. Status Codes de Estoque

| Código | Bloqueado | Aviso | Significado |
|---|---|---|---|
| `OK` | — | — | Físico e fiscal suficientes |
| `EXCEDE_FISICO` | ✅ | — | Quantidade > estoque físico |
| `EXCEDE_FISCAL` | — | ✅ | Quantidade > estoque fiscal (NF pode falhar) |
| `EXCEDE_FISICO_E_FISCAL` | ✅ | — | Quantidade > ambos |
| `SEM_ESTOQUE_FISICO` | ✅ | — | Físico ≤ 0 |
| `SEM_ESTOQUE_FISCAL` | ✅ | — | Fiscal ≤ 0 |
| `FISICO_MAIOR_QUE_FISCAL` | — | ✅ | Divergência: físico > fiscal |
| `FISCAL_MAIOR_QUE_FISICO` | — | — | Fiscal > físico (entrada NF sem recebimento físico?) |
| `PENDENTE_VALIDACAO` | — | ✅ | Sem inventário — fiscal não calculável |
| `ERRO_CONSULTA` | ✅ | — | Falha na Bridge SQL |

---

## 9. Auditoria

Toda ação sensível gera um registro em `audit_logs` com:
- `user_id`, `loja_id`, `empresa_id`
- `acao` (ex: `ADICIONOU_ITEM_OS`, `BLOQUEOU_ADICIONAR_ITEM_OS`)
- `entidade` = `"ordem_servico"`, `entidade_id` = ID da O.S.
- `detalhes_json`: produto_id, quantidade, estoques, status_estoque, etc.

---

## 10. O Que NÃO Fazer

- ❌ SQL livre do frontend
- ❌ INSERT/UPDATE/DELETE direto no SQL Server
- ❌ Escrita em O.S. contornando a MaxAPI
- ❌ Token MaxAPI em qualquer log ou resposta ao browser
- ❌ Alterar fórmula fiscal sem documentar e reconciliar
- ❌ Avançar para emissão de NF sem nova validação fiscal pré-faturamento

---

## 11. Próximos Passos

- [ ] Configurar `bridge_token`, `maxapi_url`, `maxapi_client_id`, `maxapi_secret_key`, `emp_id_maxdata`, `terminal_maxdata` para cada loja via painel admin
- [ ] Testar `testBridgeConnection` e `testMaxApiConnection` na UI de integrações
- [ ] Testar busca de produtos e detalhe de estoque com proId real
- [ ] Testar listagem de O.S. abertas via Bridge
- [ ] Testar adição de item com cenário OK, EXCEDE_FISCAL (confirmação), e EXCEDE_FISICO (bloqueio)
- [ ] Validação pré-NF: antes de finalizar/faturar O.S., re-executar `calculateFiscalStock` para todos os itens
- [ ] Considerar cache de estoque em `stock_cache` para reduzir latência em buscas repetidas