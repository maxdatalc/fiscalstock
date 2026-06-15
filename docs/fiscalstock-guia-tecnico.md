# FiscalStock — Guia Técnico Completo

> Documento de referência para Claude Code e desenvolvedores.
> Cobre arquitetura, cálculo fiscal, como verificar dados no banco e o que falta implementar.

---

## 1. O que é o FiscalStock

Sistema de controle de **estoque físico vs. estoque fiscal (contábil)** para empresas que usam o ERP MaxData. Permite:

- Listar e consultar Ordens de Serviço (OS) do MaxData
- Calcular o estoque fiscal de um produto a partir do último inventário
- Alertar antes de lançar um item numa OS se o estoque fiscal for insuficiente (emissão de NF vai falhar)
- Testar e configurar a Bridge SQL e a MaxAPI por loja

**Regra de ouro:** toda leitura vem do SQL Server via Bridge SQL. Toda escrita vai pela MaxAPI. Nunca SQL no frontend.

---

## 2. Arquitetura

```
Browser (React)
  │
  │  chamadas a createServerFn / Server Actions
  ▼
Servidor (TanStack Start / Next.js)
  ├── src/lib/api/*.functions.ts   ← boundary seguro, valida auth via Supabase
  │     ├── service-orders.functions.ts
  │     ├── integrations.functions.ts
  │     ├── stock.functions.ts
  │     └── admin.functions.ts
  │
  ├── src/lib/bridge/bridge-client.ts   ← queryBridge(), pingBridge()
  │     └── named-queries.ts            ← whitelist SQL (único lugar com SQL)
  │
  ├── src/lib/maxapi/maxapi-client.ts   ← getOrRefreshToken(), addItemToServiceOrderMaxApi()
  │
  └── src/lib/fiscal/
        ├── calculate-fiscal-stock.ts  ← fórmula do estoque fiscal
        └── stock-status.ts            ← classifica risco (OK/ATENÇÃO/BLOQUEADO)

Supabase (usokjuxnttfhffuvkhec)
  ├── tenants          ← empresas/clientes MaxData
  ├── tenant_users     ← vínculo usuário↔empresa
  ├── lojas            ← lojas (sql_bridge_url, sql_bridge_token, emp_id, terminal_maxdata)
  ├── integration_configs ← config MaxAPI + cache token + status testes
  ├── fs_profiles      ← perfis FiscalStock
  └── fs_audit_logs    ← auditoria de ações

Bridge SQL → SQL Server BATAUTO (MaxData ERP)
MaxAPI     → https://lucasbatauto.lcgestor.com.br
```

---

## 3. Como Claude deve conectar ao banco para verificar informações

### 3.1 Via Bridge SQL (leitura de dados MaxData)

A Bridge é um proxy HTTP que executa SQL no SQL Server BATAUTO.
**Nunca execute a Bridge diretamente do frontend.** Use apenas nas server functions.

**Configuração de acesso (já em produção):**
```
URL:   https://batautobridge.lcgestor.com.br
Token: af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4
```

**Para verificar conectividade:**
```bash
curl -s https://batautobridge.lcgestor.com.br/health
# Resposta esperada: {"ok":true,"db":"BATAUTO","port":3055}
```

**Para executar uma query de verificação:**
```bash
curl -s -X POST https://batautobridge.lcgestor.com.br/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4" \
  -d '{
    "sql": "SELECT TOP 5 proId, proDescricao FROM produto ORDER BY proId",
    "params": {}
  }'
```

**Para investigar o estoque de um produto específico (empId=1, proId=15788):**
```bash
curl -s -X POST https://batautobridge.lcgestor.com.br/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4" \
  -d '{
    "sql": "SELECT pe.proEstoqueAtual, pe.proCodigo, p.proDescricao FROM produto_empresa pe INNER JOIN produto p ON p.proId = pe.proId WHERE pe.proId = @proId AND pe.empId = @empId",
    "params": {"proId": 15788, "empId": 1}
  }'
```

**Para verificar o último inventário de um produto:**
```bash
curl -s -X POST https://batautobridge.lcgestor.com.br/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4" \
  -d '{
    "sql": "SELECT TOP 1 i.invId, i.invData, ii.iviProEstoque FROM Inventario i INNER JOIN InventarioItem ii ON ii.iviInvId = i.invId WHERE ii.iviProId = @proId AND i.empId = @empId AND i.invSuspenso = 0 ORDER BY i.invData DESC",
    "params": {"proId": 15788, "empId": 1}
  }'
```

### 3.2 Tabelas principais do SQL Server BATAUTO

| Tabela | O que armazena |
|--------|---------------|
| `produto` | Cadastro mestre de produtos |
| `produto_empresa` | Estoque físico atual por empresa (`proEstoqueAtual`, `proCodigo`) |
| `Inventario` | Cabeçalho do inventário (`invId`, `invData`, `empId`, `invSuspenso`) |
| `InventarioItem` | Itens do inventário (`iviInvId`, `iviProId`, `iviProEstoque`) |
| `nf` | Notas fiscais (`nfId`, `empId`, `nfStatus`, `nfTipoNf`, `nfDataEmissao`) |
| `nfItem` | Itens das NF (`nfiNf`, `nfiProd`, `nfiQtde`, `nfiCfop`) |
| `venda` | OS e vendas (`vedId`, `empId`, `vedTipo='OS'`, `vedStatus`) |
| `vendaItem` | Itens de OS/venda (`vdiVedId`, `vdiItemId`, `vdiQtde`, `vdiCancel`) |
| `produtoAcertoEstoque` | Ajustes manuais de estoque (`paeId`, `empId`, `paeStatus`, `paeDataOcorrencia`) |
| `produtoAcertoEstoqueItem` | Itens dos ajustes (`paiPaeId`, `paiProId`, `paiQtdInf`, `paiProEstoque`) |

### 3.3 Empresa IDs (empId)

| empId | Empresa |
|-------|---------|
| 1 | Principal (BATAUTO) — onde a maioria dos dados está |
| 2–5 | Empresas secundárias |

---

## 4. Fórmula do Estoque Fiscal (implementada)

**Arquivo:** `src/lib/fiscal/calculate-fiscal-stock.ts`
**Query SQL:** `GET_FISCAL_STOCK_COMPOSITION` em `src/lib/bridge/named-queries.ts`

### 4.1 Conceito

O **estoque físico** (`proEstoqueAtual`) é o que o sistema MaxData registra como disponível no galpão.

O **estoque fiscal/contábil** é calculado com base no que *legalmente passou pela empresa* segundo documentos fiscais:

```
Estoque Fiscal = Inventário Base
              + Entradas de NF (compras, novas mercadorias)
              - Saídas de NF (vendas, OS com NF emitida)
              + Devoluções de venda (cliente devolveu mercadoria)
              + Ajustes de estoque finalizados
```

### 4.2 Fórmula detalhada com filtros

```sql
-- Base: último inventário não suspenso
InventarioBase = InventarioItem.iviProEstoque
  WHERE Inventario.invSuspenso = 0
  ORDER BY Inventario.invData DESC
  LIMIT 1

-- Entradas: NF de entrada aprovadas, após o inventário, excluindo devoluções de compra
Entradas = SUM(nfItem.nfiQtde)
  WHERE nf.nfTipoNf = 'E'
    AND nf.nfStatus = 'F'
    AND nfItem.nfiCfop NOT IN (1202, 2202, 5202, 6202)
    AND nf.nfDataEmissao > dataInventario

-- Saídas: NF de saída aprovadas após o inventário (inclui NF de OS)
Saidas = SUM(nfItem.nfiQtde)
  WHERE nf.nfTipoNf = 'S'
    AND nf.nfStatus = 'F'
    AND nf.nfDataEmissao > dataInventario

-- Devoluções de venda: cliente devolveu mercadoria (CFOP 1202/2202)
Devolucoes = SUM(nfItem.nfiQtde)
  WHERE nfItem.nfiCfop IN (1202, 2202)
    AND nf.nfStatus = 'F'
    AND nf.nfDataEmissao > dataInventario

-- Ajustes manuais finalizados após o inventário
Ajustes = SUM(paiQtdInf - paiProEstoque)
  WHERE produtoAcertoEstoque.paeStatus = 'F'
    AND produtoAcertoEstoque.paeDataOcorrencia > dataInventario
```

### 4.3 Validação conhecida

Em 2026-06-14, validado contra BATAUTO:
- `proId=15788`, `empId=1`
- Resultado: `estoqueFiscal = 898 = proEstoqueAtual` (produto sem movimentação desde o inventário)
- Confirma que a fórmula está correta para esse cenário

---

## 5. O que ainda falta / precisa melhorar

### 5.1 🔴 CRÍTICO — Devolução de compra (CFOP 5202/6202) ausente da fórmula

**Problema:** Quando a empresa devolve uma mercadoria ao fornecedor, a NF emitida usa CFOP 5202 ou 6202. Esse documento é de **saída** (`nfTipoNf = 'S'`) e deveria subtrair do estoque fiscal — e já está sendo subtraído via a CTE `Saidas` porque essa CTE pega todas NF de saída aprovadas.

**Verificar com query:**
```sql
SELECT COUNT(*) as total, SUM(ni.nfiQtde) as qtde_total
FROM nfItem ni
INNER JOIN nf n ON n.nfId = ni.nfiNf
WHERE n.empId = 1
  AND ni.nfiCfop IN (5202, 6202)
  AND n.nfStatus = 'F'
  AND n.nfTipoNf = 'S'
```

Se retornar dados, confirmar se já estão sendo capturados em `Saidas`. Se `nfTipoNf` para CFOP 5202/6202 for `'E'` no BATAUTO (entidade emissor, não destinatário), há um bug na fórmula.

**Como verificar via Bridge:**
```bash
curl -s -X POST https://batautobridge.lcgestor.com.br/query \
  -H "Authorization: Bearer af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT TOP 10 n.nfTipoNf, ni.nfiCfop, ni.nfiQtde FROM nfItem ni INNER JOIN nf n ON n.nfId = ni.nfiNf WHERE n.empId = @empId AND ni.nfiCfop IN (5202, 6202) AND n.nfStatus = @status","params":{"empId":1,"status":"F"}}'
```

### 5.2 🔴 CRÍTICO — OS sem NF emitida não reduz estoque fiscal

**Problema:** Quando uma peça é usada em uma OS mas **nenhuma NF de saída é emitida** (OS encerrada sem faturamento), a peça some do estoque físico mas **não** reduz o estoque fiscal. Isso gera divergência permanente.

**Investigar:** Verificar se o MaxData vincula os itens de OS a uma NF de saída.

**Query de investigação:**
```bash
curl -s -X POST https://batautobridge.lcgestor.com.br/query \
  -H "Authorization: Bearer af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT TOP 5 vdi.vdiId, vdi.vdiVedId, vdi.vdiItemId, vdi.vdiQtde, vdi.vdiNf FROM vendaItem vdi INNER JOIN venda v ON v.vedId = vdi.vdiVedId WHERE v.vedTipo = @tipo AND v.empId = @empId AND vdi.vdiCancel = 0","params":{"tipo":"OS","empId":1}}'
```

Verificar se `vdiNf` (número da NF vinculada ao item) está preenchido. Se estiver em branco para OS, esses itens precisam ser tratados separadamente na fórmula fiscal.

**Possível correção na fórmula:**
```sql
-- Adicionar CTE para consumo de OS sem NF vinculada
ConsumidoEmOS AS (
  SELECT COALESCE(SUM(vdi.vdiQtde), 0) AS total
  FROM vendaItem vdi
  INNER JOIN venda v ON v.vedId = vdi.vdiVedId
  CROSS JOIN InventarioBase ib
  WHERE vdi.vdiItemId = @proId
    AND v.empId       = @empId
    AND v.vedTipo     = 'OS'
    AND vdi.vdiCancel = 0
    AND (vdi.vdiNf IS NULL OR vdi.vdiNf = '')  -- só OS sem NF emitida
    AND v.vedAbertura > ib.dataInventario
)
-- E subtrair no resultado final:
-- (ib.baseInv + e.total - s.total + d.total + aj.total - os_sem_nf.total)
```

### 5.3 🟡 IMPORTANTE — Paginação na listagem de OS

**Problema:** A query `LIST_SERVICE_ORDERS` retorna **todas** as OS sem paginação. Com 2.048+ OS abertas, isso pode ser lento.

**Arquivo:** `src/lib/bridge/named-queries.ts` — query `LIST_SERVICE_ORDERS`

**Solução:** Adicionar `OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY` (SQL Server syntax) e passar `{ offset: 0, limit: 50 }` como parâmetros.

```sql
SELECT ...
FROM venda v
LEFT JOIN cliente c ON c.cliId = v.vedClienteId
WHERE v.empId = @empId
  AND v.vedTipo = 'OS'
  AND v.vedStatus NOT IN ('Z')
  AND (@statusFilter = '' OR v.vedStatus = @statusFilter)
  AND (@clienteNome  = '' OR COALESCE(c.cliNome, v.vedCliNome) LIKE @clienteNome)
ORDER BY v.vedAbertura DESC
OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
```

### 5.4 🟡 IMPORTANTE — Relatório de divergências em lote

**Falta:** Uma tela/exportação que mostre todos os produtos com divergência físico vs fiscal, ordenados pela maior diferença absoluta.

**Query base para o relatório:**
```sql
-- (adaptar para a CTE existente)
SELECT
  p.proDescricao,
  pe.proCodigo,
  pe.proEstoqueAtual AS estoqueFisico,
  [resultado do cálculo fiscal] AS estoqueFiscal,
  pe.proEstoqueAtual - [fiscal] AS divergencia
FROM produto_empresa pe
INNER JOIN produto p ON p.proId = pe.proId
WHERE pe.empId = @empId
ORDER BY ABS(pe.proEstoqueAtual - [fiscal]) DESC
```

Isso é uma query complexa para rodar em lote — provavelmente precisa de uma stored procedure ou materialização via job noturno no Bridge.

### 5.5 🟡 IMPORTANTE — Cache de resultado fiscal

**Problema:** Cada consulta de detalhe de produto faz 2 queries na Bridge (físico + fiscal CTE). Para um relatório com 500+ produtos, isso levaria ~500 requisições HTTP.

**Solução:** Armazenar o resultado do cálculo fiscal em `integration_configs.fiscal_stock_cache` ou em uma tabela separada no Supabase, com `calculated_at`. Recalcular em background a cada X horas via cron job.

### 5.6 🟢 MELHORIAS MENORES

- **Filtro por data** na listagem de OS (abertura entre datas)
- **Busca por número de OS** (vedId direto) — já existe mas poderia ter um campo dedicado
- **Status de OS** mais granular — atualmente só `aberta/faturada/cancelada`; MaxData pode ter sub-status
- **Placa do veículo** — a query `LIST_SERVICE_ORDERS` retorna `placa = ''` (vazia). Investigar se `vedVeiculoId` está preenchido e fazer JOIN com `veiculo`

---

## 6. Como validar o cálculo fiscal manualmente

Para verificar se o resultado do FiscalStock está correto para um produto, rode esta sequência de queries na Bridge:

**Passo 1 — estoque físico atual:**
```bash
curl -s -X POST https://batautobridge.lcgestor.com.br/query \
  -H "Authorization: Bearer af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT pe.proEstoqueAtual, pe.proCodigo, p.proDescricao FROM produto_empresa pe INNER JOIN produto p ON p.proId = pe.proId WHERE pe.proId = @proId AND pe.empId = @empId","params":{"proId":15788,"empId":1}}'
```

**Passo 2 — base do inventário:**
```bash
curl -s -X POST https://batautobridge.lcgestor.com.br/query \
  -H "Authorization: Bearer af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT TOP 1 i.invId, CONVERT(VARCHAR,i.invData,23) AS data, ii.iviProEstoque AS baseEstoque FROM Inventario i INNER JOIN InventarioItem ii ON ii.iviInvId = i.invId WHERE ii.iviProId = @proId AND i.empId = @empId AND i.invSuspenso = 0 ORDER BY i.invData DESC","params":{"proId":15788,"empId":1}}'
```

**Passo 3 — movimentações após o inventário:**
```bash
curl -s -X POST https://batautobridge.lcgestor.com.br/query \
  -H "Authorization: Bearer af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT n.nfTipoNf, ni.nfiCfop, SUM(ni.nfiQtde) AS total FROM nfItem ni INNER JOIN nf n ON n.nfId = ni.nfiNf WHERE ni.nfiProd = @proId AND n.empId = @empId AND n.nfStatus = @status AND n.nfDataEmissao > @dataRef GROUP BY n.nfTipoNf, ni.nfiCfop ORDER BY n.nfTipoNf, ni.nfiCfop","params":{"proId":15788,"empId":1,"status":"F","dataRef":"2026-05-31"}}'
```

**Passo 4 — CTE completa (a mesma que o sistema usa):**

Executar diretamente a query `GET_FISCAL_STOCK_COMPOSITION` do arquivo `named-queries.ts` com `@proId` e `@empId` específicos.

---

## 7. Variáveis de ambiente necessárias

```env
# Supabase (mesmo projeto do dashboard)
SUPABASE_URL=https://usokjuxnttfhffuvkhec.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...   # anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # service role — NUNCA expor no frontend

# TanStack Start / Next.js (prefixo VITE_ ou NEXT_PUBLIC_ conforme o framework)
VITE_SUPABASE_URL=https://usokjuxnttfhffuvkhec.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

A Bridge SQL e a MaxAPI **não ficam em variáveis de ambiente** — ficam nas colunas `lojas.sql_bridge_url`, `lojas.sql_bridge_token`, `integration_configs.maxapi_url` no Supabase, buscadas pelo servidor em tempo de execução.

---

## 8. Configuração inicial de uma loja no Supabase

Para uma loja funcionar, precisam estar preenchidos no Supabase:

**Tabela `lojas`:**
```sql
UPDATE lojas SET
  sql_bridge_url    = 'https://batautobridge.lcgestor.com.br',
  sql_bridge_token  = 'af371ff5932cb0d9a350187d449cda60e7c2ab9bd92c2a1920956b84a742ecb4',
  emp_id            = 1,
  terminal_maxdata  = '0A285A0A41A6472F300BE37FE6680720'
WHERE id = '<uuid-da-loja>';
```

**Tabela `integration_configs`:**
```sql
INSERT INTO integration_configs (loja_id, maxapi_url)
VALUES ('<uuid-da-loja>', 'https://lucasbatauto.lcgestor.com.br')
ON CONFLICT (loja_id) DO UPDATE SET maxapi_url = EXCLUDED.maxapi_url;
```

---

## 9. Status atual do projeto (2026-06-15)

| Funcionalidade | Status |
|---|---|
| Listagem de OS | ✅ Funcionando |
| Detalhe de OS com itens | ✅ Funcionando |
| Cálculo de estoque físico | ✅ Funcionando |
| Cálculo de estoque fiscal (fórmula base) | ✅ Implementado e validado |
| Bloqueio/alerta ao lançar item em OS | ✅ Funcionando |
| Configuração de Bridge/MaxAPI via UI | ✅ Funcionando |
| Testes de conectividade Bridge e MaxAPI | ✅ Funcionando |
| Auditoria de ações | ✅ Funcionando |
| Integração com dashboard (Next.js) | ✅ Build ok, módulo integrado |
| Devolução de compra CFOP 5202/6202 | ⚠️ A verificar (ver §5.1) |
| OS sem NF emitida no estoque fiscal | ⚠️ Provavelmente ausente (ver §5.2) |
| Paginação da listagem de OS | ❌ Não implementado |
| Relatório de divergências em lote | ❌ Não implementado |
| Placa do veículo na OS | ❌ Retornando vazio |
| Cache de resultados fiscais | ❌ Não implementado |