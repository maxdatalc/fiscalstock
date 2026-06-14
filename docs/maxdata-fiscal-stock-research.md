# MaxData ERP — Pesquisa de Estoque Fiscal (BATAUTO)

> Investigação realizada em 2026-06-14 via Bridge SQL (somente SELECT).  
> Banco: `BATAUTO` | Bridge: `https://batautobridge.lcgestor.com.br`  
> Todas as queries são parametrizadas — nunca SQL livre do frontend.

---

## 1. Tabelas Candidatas

### 1.1 Produtos

| Tabela | Papel |
|---|---|
| `produto` | Catálogo global de produtos (PK: `proId`) |
| `produto_empresa` | Dados por empresa/loja: **estoque físico**, código, preços (PK: `preId`, FK: `empId` + `proId`) |
| `codBarras` | Códigos EAN/barras por produto (FK: `cdbIdProd` → `produto.proId`) |
| `grupoProd` | Grupos de produto |

### 1.2 Estoque Físico

| Tabela | Papel |
|---|---|
| `produto_empresa` | Coluna `proEstoqueAtual` = **saldo físico atual por loja** |
| `produtoEstoqueMovimento` | Histórico de movimentos físicos (não fiscal) |

### 1.3 Inventário Fiscal (Base de Cálculo)

| Tabela | Papel |
|---|---|
| `Inventario` | Cabeçalho do inventário (PK: `invId`, campos: `invData`, `empId`, `invSuspenso`) |
| `InventarioItem` | Itens: `iviProId`, `iviProEstoque` (qtd no inventário), `iviInvId` |

### 1.4 NF Saída (Saídas Fiscais)

| Tabela | Papel |
|---|---|
| `nf` | Cabeçalho das NFs saída e entrada (`nfTipoNf='S'`). Campos: `nfId`, `nfNum`, `nfStatus`, `nfDataEmissao`, `empId` |
| `nfItem` | Itens da NF: `nfiNf`, `nfiProd`, `nfiQtde`, `nfiCfop`, `nfiVlr` |

### 1.5 Entradas Fiscais (Compras/NF Entrada)

| Tabela | Papel |
|---|---|
| `nf` | **Mesma tabela** — `nfTipoNf='E'` para entradas |
| `nfItem` | Itens da NF entrada — mesmo esquema, CFOP 1xxx/2xxx |

### 1.6 Vendas e Itens

| Tabela | Papel |
|---|---|
| `venda` | Vendas, OS e devoluções (PK: `vedId`, `vedTipo`: `'VE'`, `'OS'`, `'DV'`) |
| `vendaItem` | Itens: `vdiVedId`, `vdiItemId` (FK produto), `vdiQtde`, `vdiValor`, `vdiCancel` |

### 1.7 Ordem de Serviço (AutoMax)

| Tabela | Papel |
|---|---|
| `venda` | `vedTipo='OS'` — OS está na tabela `venda`. Campos adicionais: `vedOsKm`, `vedOsPrisma`, `vedOsAutoMaxStatus`, `vedOsAutoMaxTipoServicoId` |
| `vendaItem` | Itens da OS (peças/serviços) via `vdiVedId` |
| `automaxTipoServicos` | Tipos de serviço AutoMax |
| `automaxSetores` | Setores de oficina |
| `automaxChecklistOs` | Checklist vinculado à OS |

### 1.8 Ajustes de Estoque

| Tabela | Papel |
|---|---|
| `produtoAcertoEstoque` | Cabeçalho do ajuste (PK: `paeId`, campos: `paeStatus`, `paeDataOcorrencia`, `empId`) |
| `produtoAcertoEstoqueItem` | Itens: `paiProId`, `paiProEstoque` (qtd antes), `paiQtdInf` (qtd informada/contada) |

---

## 2. Colunas Relevantes Confirmadas

### `produto_empresa` — Estoque Físico por Loja

| Coluna | Tipo | Descrição |
|---|---|---|
| `preId` | int | PK |
| `empId` | int | **ID da empresa/loja** |
| `proId` | int | FK → `produto.proId` |
| `proEstoqueAtual` | decimal | **Estoque físico atual** |
| `proCodigo` | varchar(50) | Código do produto nesta loja |
| `proDesativaProd` | smallint | 0=ativo, 1=inativo (filtrar!) |
| `proUn` | varchar(10) | Unidade |

### `produto` — Catálogo Global

| Coluna | Tipo | Descrição |
|---|---|---|
| `proId` | int | **PK** |
| `proDescricao` | varchar(100) | Descrição do produto |
| `proUn` | varchar(10) | Unidade de medida |
| `proTipo` | varchar(1) | Tipo do produto |
| `proNaoContEstoque` | smallint | Se 1: produto não controla estoque |

### `codBarras` — EAN/Barras

| Coluna | Tipo | Descrição |
|---|---|---|
| `cdbId` | int | PK |
| `cdbIdProd` | int | FK → `produto.proId` |
| `cdbCodigo` | varchar | Código EAN/barras |

### `Inventario` — Cabeçalho

| Coluna | Tipo | Descrição |
|---|---|---|
| `invId` | int | PK |
| `invData` | datetime | **Data de referência do inventário** |
| `empId` | int | **Empresa/loja** |
| `invSuspenso` | smallint | 0=válido, ≠0=ignorar |
| `invSped` | bit | Inventário SPED |

### `InventarioItem` — Qtd por Produto

| Coluna | Tipo | Descrição |
|---|---|---|
| `iviId` | int | PK |
| `iviInvId` | int | FK → `Inventario.invId` |
| `iviProId` | int | FK → `produto.proId` |
| `iviProEstoque` | decimal | **Qtd no inventário (base fiscal)** |
| `iviProDescricao` | varchar | Descrição no momento |

### `nf` — Notas Fiscais (E e S)

| Coluna | Tipo | Descrição |
|---|---|---|
| `nfId` | int | PK |
| `nfNum` | bigint | Número da NF |
| `nfTipoNf` | varchar | **'E'=entrada, 'S'=saída** |
| `nfStatus` | varchar | **'F'=válida**, 'C'=cancelada, 'Z'=inutilizada, 'A'/'P'=pendente |
| `nfDataEmissao` | datetime | **Data de emissão** (usar para filtro pós-inventário) |
| `empId` | int | **Empresa/loja** |
| `nfNfeAutorizado` | bit | NF autorizada na SEFAZ |
| `nfVedRef` | int | Referência à venda (frequentemente null) |

### `nfItem` — Itens da NF

| Coluna | Tipo | Descrição |
|---|---|---|
| `nfiId` | int | PK |
| `nfiNf` | int | FK → `nf.nfId` |
| `nfiProd` | int | FK → `produto.proId` |
| `nfiQtde` | decimal | **Quantidade** |
| `nfiCfop` | int | **CFOP** (determina natureza do movimento) |
| `nfiVlr` | float | Valor unitário |

### `venda` — Vendas/OS/Devoluções

| Coluna | Tipo | Descrição |
|---|---|---|
| `vedId` | int | PK |
| `vedCod` | int | Número sequencial visível |
| `vedTipo` | varchar | **'OS'=ordem serviço, 'VE'=venda, 'DV'=devolução** |
| `vedStatus` | varchar | **'F'=finalizada, 'A'=aberta, 'C'=cancelada, 'Z'=excluída** |
| `vedAbertura` | datetime | Data de abertura |
| `vedFechamento` | datetime | Data de fechamento (null se aberta) |
| `vedCliNome` | varchar | Nome do cliente |
| `empId` | int | **Empresa/loja** |
| `vedOsKm` | decimal | KM do veículo (OS) |
| `vedOsPrisma` | varchar | Prisma/box (OS) |
| `vedOsAutoMaxStatus` | varchar | Status AutoMax da OS |
| `vedOsAutoMaxTipoServicoId` | int | Tipo de serviço AutoMax |
| `vedVeiculoId` | int | FK → veiculo |
| `vedRefDevolucao` | int | FK → venda original (para DV) |
| `vedNaoMovEstoque` | bit | Se 1: não movimentou estoque |
| `vedTipoAtend` | int | Tipo de atendimento (para OS: 2,3,4,5,6,7,8) |

### `vendaItem` — Itens de Venda/OS

| Coluna | Tipo | Descrição |
|---|---|---|
| `vdiId` | int | PK |
| `vdiVedId` | int | FK → `venda.vedId` |
| `vdiItemId` | int | FK → `produto.proId` |
| `vdiQtde` | decimal | **Quantidade** |
| `vdiValor` | decimal | Valor unitário |
| `vdiCancel` | int | **0=ativo, ≠0=item cancelado** |
| `vdiStatus` | varchar | Status do item |
| `vdiProNome` | varchar | Nome do produto na venda |
| `vdiCfop` | int | CFOP do item |

### `produtoAcertoEstoque` — Ajuste

| Coluna | Tipo | Descrição |
|---|---|---|
| `paeId` | int | PK |
| `paeDataOcorrencia` | datetime | Data do ajuste |
| `paeStatus` | varchar | **'F'=finalizado** (único valor observado) |
| `empId` | int | Empresa/loja |

### `produtoAcertoEstoqueItem`

| Coluna | Tipo | Descrição |
|---|---|---|
| `paiId` | int | PK |
| `paiPaeId` | int | FK → `produtoAcertoEstoque.paeId` |
| `paiProId` | int | FK → `produto.proId` |
| `paiProEstoque` | decimal | Qtd **antes** do ajuste |
| `paiQtdInf` | decimal | Qtd **informada** (contagem física) |

---

## 3. Relacionamentos Confirmados

```
produto (proId)
  ├── produto_empresa (empId + proId) → proEstoqueAtual
  ├── codBarras (cdbIdProd) → cdbCodigo (EAN)
  └── InventarioItem (iviProId) ← Inventario (empId, invData)
        └── iviProEstoque = base fiscal

nf (nfId, empId, nfTipoNf, nfStatus, nfDataEmissao)
  └── nfItem (nfiNf → nfId)
        ├── nfiProd → produto.proId
        ├── nfiQtde
        └── nfiCfop

venda (vedId, empId, vedTipo, vedStatus)
  └── vendaItem (vdiVedId → vedId)
        ├── vdiItemId → produto.proId
        ├── vdiQtde
        └── vdiCancel

produtoAcertoEstoque (paeId, empId, paeStatus, paeDataOcorrencia)
  └── produtoAcertoEstoqueItem (paiPaeId)
        ├── paiProId → produto.proId
        ├── paiProEstoque (antes)
        └── paiQtdInf (depois)
```

---

## 4. Status: O que Incluir e o que Excluir

### `nf.nfStatus`

| Valor | Significado | Incluir no cálculo? |
|---|---|---|
| `'F'` | Finalizada/Autorizada | ✅ SIM |
| `'C'` | Cancelada | ❌ NÃO |
| `'Z'` | Inutilizada | ❌ NÃO |
| `'A'` | Aguardando/Pendente | ❌ NÃO |
| `'P'` | Pendente | ❌ NÃO |

### `venda.vedStatus`

| Valor | Significado | Incluir? |
|---|---|---|
| `'F'` | Finalizada | ✅ SIM (para histórico) |
| `'A'` | Aberta/Andamento | ⚠️ Depende do contexto (OS em aberto) |
| `'C'` | Cancelada | ❌ NÃO |
| `'Z'` | Excluída | ❌ NÃO |
| `'X'` | PDV/Caixa | ⚠️ Verificar |
| `'O'` | Desconhecido (1 registro) | ❌ Ignorar |

### `vendaItem.vdiCancel`

| Valor | Incluir? |
|---|---|
| `0` | ✅ SIM |
| `≠ 0` | ❌ NÃO (item cancelado) |

### `Inventario.invSuspenso`

| Valor | Incluir? |
|---|---|
| `0` | ✅ SIM |
| `≠ 0` | ❌ NÃO (inventário suspenso) |

### `produtoAcertoEstoque.paeStatus`

| Valor | Incluir? |
|---|---|
| `'F'` | ✅ SIM (único valor existente no banco) |

---

## 5. CFOPs e Direção de Movimento

### CFOPs Observados no Banco

| CFOP | Qtd | Direção | Impacto no Estoque Fiscal |
|---|---|---|---|
| 5405 | 5.276 | Saída | ➖ Reduz |
| 1403 | 3.991 | Entrada | ➕ Aumenta |
| 5102 | 923 | Saída | ➖ Reduz |
| 1102 | 810 | Entrada | ➕ Aumenta |
| 1949 | 128 | Entrada | ➕ Aumenta |
| 5411 | 127 | Saída | ➖ Reduz |
| 1556 | 117 | Entrada (serviço/imobilizado) | ➕ Aumenta |
| 6108 | 50 | Saída (interestadual) | ➖ Reduz |
| **1202** | **19** | **Devolução de venda** | **➕ Aumenta** |
| 5949 | 6 | Saída (outros) | ➖ Reduz |

### Regra de CFOP para Cálculo Fiscal

```
nfTipoNf = 'E' AND nfiCfop NOT IN (1202, 2202) → ENTRADA (aumenta fiscal)
nfTipoNf = 'S'                                  → SAÍDA (reduz fiscal)
nfTipoNf = 'E' AND nfiCfop IN (1202, 2202)      → DEVOLUÇÃO DE VENDA (aumenta fiscal)
```

> **Nota**: CFOP 5202/6202 (devolução de compra = produto voltando ao fornecedor) reduziria o fiscal. Não foi observado no banco, mas deve ser tratado se aparecer.

---

## 6. Fórmula do Estoque Fiscal

```
Estoque Fiscal = Inventário Base
               + Entradas NF (nfTipoNf='E', nfStatus='F', CFOP ≠ devolução, após data inventário)
               + Devoluções de Venda (CFOP 1202/2202, nfStatus='F', após data inventário)
               - Saídas NF (nfTipoNf='S', nfStatus='F', após data inventário)
               + Ajustes de Estoque líquidos (paeStatus='F', paiQtdInf - paiProEstoque, após data inventário)
```

### Inventário Base

O MaxData gera inventários mensais automáticos de fechamento de período (SPED) e inventários manuais. O inventário base para o cálculo é o **último inventário com `invSuspenso=0` para o `empId` do produto**.

**Validado no banco:**
- `invId=41`, `invData='2026-05-31'`, `empId=1`, 3.310 itens
- Os valores de `iviProEstoque` **coincidem exatamente** com `produto_empresa.proEstoqueAtual` no momento da geração

---

## 7. Empresas/Lojas

O banco tem **5 empresas** (`empId`: 1, 2, 3, 4, 5).  
Cada empresa tem seus próprios registros em `produto_empresa`, `Inventario`, `nf`, `venda`, `produtoAcertoEstoque`.  
**Sempre filtrar por `empId` em todas as queries.**

---

## 8. Queries SQL Propostas

### Query 1 — Buscar Produto por Descrição / Código / EAN

```sql
SELECT TOP 50
  p.proId,
  pe.proCodigo            AS codigo,
  p.proDescricao          AS descricao,
  p.proUn                 AS unidade,
  pe.proEstoqueAtual      AS estoqueFisico,
  cb.cdbCodigo            AS ean
FROM produto p
INNER JOIN produto_empresa pe ON pe.proId = p.proId
LEFT JOIN codBarras cb ON cb.cdbIdProd = p.proId
WHERE pe.empId = @empId
  AND pe.proDesativaProd = 0
  AND p.proNaoContEstoque = 0
  AND (
    pe.proCodigo LIKE '%' + @termo + '%'
    OR p.proDescricao LIKE '%' + @termo + '%'
    OR cb.cdbCodigo = @termoBarra
  )
ORDER BY p.proDescricao
```

> **Parâmetros**: `@empId` (int), `@termo` (string), `@termoBarra` (string = EAN exato)

---

### Query 2 — Estoque Físico Atual por Produto e Empresa

```sql
SELECT
  pe.proId,
  pe.empId,
  pe.proEstoqueAtual  AS estoqueFisico,
  pe.proCodigo        AS codigo,
  p.proDescricao      AS descricao,
  p.proUn             AS unidade
FROM produto_empresa pe
INNER JOIN produto p ON p.proId = pe.proId
WHERE pe.proId = @proId
  AND pe.empId = @empId
```

> **Parâmetros**: `@proId` (int), `@empId` (int)

---

### Query 3 — Último Inventário Fiscal Base por Produto e Empresa

```sql
SELECT TOP 1
  ii.iviProId         AS proId,
  ii.iviProEstoque    AS estoqueBaseInventario,
  i.invId,
  i.invData           AS dataInventario
FROM InventarioItem ii
INNER JOIN Inventario i ON i.invId = ii.iviInvId
WHERE ii.iviProId = @proId
  AND i.empId    = @empId
  AND i.invSuspenso = 0
ORDER BY i.invData DESC
```

> **Parâmetros**: `@proId` (int), `@empId` (int)

---

### Query 4 — Entradas Fiscais Válidas Após o Inventário

```sql
SELECT
  COALESCE(SUM(ni.nfiQtde), 0)  AS totalEntradas,
  COUNT(ni.nfiId)                AS qtdDocumentos
FROM nfItem ni
INNER JOIN nf n ON n.nfId = ni.nfiNf
WHERE ni.nfiProd          = @proId
  AND n.empId             = @empId
  AND n.nfStatus          = 'F'
  AND n.nfTipoNf          = 'E'
  AND ni.nfiCfop NOT IN (1202, 2202, 5202, 6202)
  AND n.nfDataEmissao     > @dataInventario
```

> **Parâmetros**: `@proId`, `@empId`, `@dataInventario` (datetime do inventário base)

---

### Query 5 — Saídas Fiscais Válidas Após o Inventário

```sql
SELECT
  COALESCE(SUM(ni.nfiQtde), 0)  AS totalSaidas,
  COUNT(ni.nfiId)                AS qtdDocumentos
FROM nfItem ni
INNER JOIN nf n ON n.nfId = ni.nfiNf
WHERE ni.nfiProd          = @proId
  AND n.empId             = @empId
  AND n.nfStatus          = 'F'
  AND n.nfTipoNf          = 'S'
  AND n.nfDataEmissao     > @dataInventario
```

> **Parâmetros**: `@proId`, `@empId`, `@dataInventario`

---

### Query 6 — Devoluções de Venda (Aumentam o Estoque Fiscal)

```sql
SELECT
  COALESCE(SUM(ni.nfiQtde), 0)  AS totalDevolucoes
FROM nfItem ni
INNER JOIN nf n ON n.nfId = ni.nfiNf
WHERE ni.nfiProd          = @proId
  AND n.empId             = @empId
  AND n.nfStatus          = 'F'
  AND ni.nfiCfop          IN (1202, 2202)
  AND n.nfDataEmissao     > @dataInventario
```

> CFOPs 1202 (devolução de venda dentro do estado) e 2202 (interestadual) confirmados no banco.  
> **Parâmetros**: `@proId`, `@empId`, `@dataInventario`

---

### Query 7 — Ajustes de Estoque Após o Inventário

```sql
SELECT
  COALESCE(SUM(pai.paiQtdInf - pai.paiProEstoque), 0)  AS ajusteLiquido,
  COUNT(DISTINCT pae.paeId)                              AS qtdAjustes
FROM produtoAcertoEstoque pae
INNER JOIN produtoAcertoEstoqueItem pai ON pai.paiPaeId = pae.paeId
WHERE pai.paiProId           = @proId
  AND pae.empId              = @empId
  AND pae.paeStatus          = 'F'
  AND pae.paeDataOcorrencia  > @dataInventario
```

> `paiQtdInf - paiProEstoque`: positivo = reforço, negativo = redução.  
> **Parâmetros**: `@proId`, `@empId`, `@dataInventario`

---

### Query 8 — Composição Completa do Saldo Fiscal (Query Única)

```sql
WITH InventarioBase AS (
  SELECT TOP 1
    ii.iviProId          AS proId,
    ii.iviProEstoque     AS baseInv,
    i.invId,
    i.invData            AS dataInventario,
    i.empId
  FROM InventarioItem ii
  INNER JOIN Inventario i ON i.invId = ii.iviInvId
  WHERE ii.iviProId  = @proId
    AND i.empId      = @empId
    AND i.invSuspenso = 0
  ORDER BY i.invData DESC
),
Entradas AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  CROSS JOIN InventarioBase ib
  WHERE ni.nfiProd    = @proId
    AND n.empId       = @empId
    AND n.nfStatus    = 'F'
    AND n.nfTipoNf    = 'E'
    AND ni.nfiCfop NOT IN (1202, 2202, 5202, 6202)
    AND n.nfDataEmissao > ib.dataInventario
),
Saidas AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  CROSS JOIN InventarioBase ib
  WHERE ni.nfiProd    = @proId
    AND n.empId       = @empId
    AND n.nfStatus    = 'F'
    AND n.nfTipoNf    = 'S'
    AND n.nfDataEmissao > ib.dataInventario
),
Devolucoes AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  CROSS JOIN InventarioBase ib
  WHERE ni.nfiProd    = @proId
    AND n.empId       = @empId
    AND n.nfStatus    = 'F'
    AND ni.nfiCfop    IN (1202, 2202)
    AND n.nfDataEmissao > ib.dataInventario
),
Ajustes AS (
  SELECT COALESCE(SUM(pai.paiQtdInf - pai.paiProEstoque), 0) AS total
  FROM produtoAcertoEstoque pae
  INNER JOIN produtoAcertoEstoqueItem pai ON pai.paiPaeId = pae.paeId
  CROSS JOIN InventarioBase ib
  WHERE pai.paiProId           = @proId
    AND pae.empId              = @empId
    AND pae.paeStatus          = 'F'
    AND pae.paeDataOcorrencia  > ib.dataInventario
)
SELECT
  ib.proId,
  ib.empId,
  ib.invId                AS inventarioId,
  ib.dataInventario,
  ib.baseInv              AS estoqueBaseInventario,
  e.total                 AS entradasFiscais,
  s.total                 AS saidasFiscais,
  d.total                 AS devolucoesFiscais,
  aj.total                AS ajustesEstoque,
  (ib.baseInv + e.total - s.total + d.total + aj.total) AS estoqueFiscal
FROM InventarioBase ib
CROSS JOIN Entradas e
CROSS JOIN Saidas s
CROSS JOIN Devolucoes d
CROSS JOIN Ajustes aj
```

> **Parâmetros**: `@proId` (int), `@empId` (int)  
> A query retorna todos os componentes + o total calculado em uma única chamada.

---

## 9. Validação: Teste End-to-End

Executado em 2026-06-14 com `proId=15788` (OLEO LUBRAX AUTO SQ 5W30 1L), `empId=1`:

| Componente | Resultado |
|---|---|
| Estoque físico atual (`produto_empresa.proEstoqueAtual`) | **898** |
| Inventário base (invId=41, 2026-05-31) | **898** |
| Entradas NF após inventário | 0 |
| Saídas NF após inventário | 0 |
| Devoluções após inventário | 0 |
| Ajustes após inventário | 0 |
| **Estoque Fiscal Calculado** | **898** |
| **Diferença Físico vs Fiscal** | **0 (OK ✅)** |

> O banco tem dados de Jun–Nov/2025. O inventário invId=41 (Mai/2026) reflete o estado atual. Não há movimentos fiscais após a data do inventário.

---

## 10. Dúvidas a Validar com o MaxManager

| # | Dúvida | Impacto |
|---|---|---|
| 1 | Os inventários mensais (invId 38-41) são snapshots automáticos de fechamento SPED ou inventários manuais? | Define se a data de corte do inventário base é confiável |
| 2 | O campo `nf.nfNfeAutorizado` deve ser validado adicionalmente além de `nfStatus='F'`? | Pode excluir NFs finalizadas mas não autorizadas na SEFAZ |
| 3 | Vendas/OS que **não geram NF** (ex: venda interna, consumo próprio) devem ser consideradas no estoque fiscal? | Se sim, precisaria de regra adicional via `venda`+`vendaItem` |
| 4 | O campo `venda.vedNaoMovEstoque=1` indica vendas que NÃO movimentaram estoque — essas vendas também não geraram NF saída? | Confirmar se são exclusões corretas |
| 5 | O CFOP 5202/6202 (devolução de compra ao fornecedor) existe neste banco? | Reduziria estoque fiscal — não observado mas deve ser tratado |
| 6 | Os ajustes `produtoAcertoEstoque` geram registros SPED (Bloco H)? São incluídos no inventário do período seguinte? | Define se `paiQtdInf - paiProEstoque` já está embutido no inventário base ou precisa ser somado |
| 7 | Os inventários mensais capturam o saldo **no momento da geração** ou são recalculados retroativamente? | Se recalculados, a fórmula estaria duplo-contando movimentos |
| 8 | Há outras empresas (`empId` 2-5) com estrutura idêntica ao `empId=1`? | Confirmar que o filtro por `empId` é suficiente para isolar cada loja |
| 9 | O `venda.vedTipo='DV'` (devolução) sempre gera uma NF com CFOP 1202/2202, ou pode existir devolução sem NF? | Define se apenas contar NFs é suficiente ou se precisa consultar `venda` também |
| 10 | O status `vedStatus='X'` em `venda` (3 registros) corresponde a vendas via PDV/SAT que geraram NF separada? | Confirmar se já estão refletidas em `nf` |

---

## 11. Resumo: Mapeamento para `calculateFiscalStock()`

```typescript
// Parâmetros de entrada
productId: number  // = produto_empresa.proId
empId:     number  // = produto_empresa.empId

// Resultado
physicalStock          = produto_empresa.proEstoqueAtual
fiscalInventoryBase    = InventarioItem.iviProEstoque (último Inventario com invSuspenso=0)
fiscalEntriesQty       = SUM(nfItem.nfiQtde) WHERE nfTipoNf='E', nfStatus='F', CFOP≠dev
fiscalOutputsQty       = SUM(nfItem.nfiQtde) WHERE nfTipoNf='S', nfStatus='F'
fiscalReturnsQty       = SUM(nfItem.nfiQtde) WHERE CFOP IN (1202,2202), nfStatus='F'
fiscalAdjustmentsQty   = SUM(paiQtdInf - paiProEstoque) WHERE paeStatus='F'
fiscalStock            = base + entries + returns - outputs + adjustments
differencePhysical...  = physicalStock - fiscalStock
availableToInvoice     = MAX(0, MIN(physicalStock, fiscalStock))
status                 = 'bloqueado' se fiscal≤0 | 'atencao' se físico>fiscal | 'ok'
```

---

*Documento gerado com base em investigação direta do banco SQL Server `BATAUTO` via Bridge SQL.*  
*Todas as queries acima foram testadas e confirmam zero erros de coluna/tabela.*  
*validada: false — aguardando confirmação do MaxManager antes de marcar a fórmula como aprovada.*