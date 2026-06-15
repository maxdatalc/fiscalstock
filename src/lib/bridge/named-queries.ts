/**
 * Named query registry â€” server-side only.
 *
 * SQL is hardcoded here; the frontend only ever sends a `queryName` string
 * plus typed params. This prevents SQL injection and free-query attacks.
 *
 * All SQL targets the BATAUTO (MaxData) SQL Server via the Bridge proxy.
 * Parameters use SQL Server @name syntax.
 *
 * Schema validated against BATAUTO on 2026-06-14 â€” see docs/maxdata-fiscal-stock-research.md.
 */

// ---------------------------------------------------------------------------
// Query 1 â€” SEARCH_PRODUCTS
// proEstoqueAtual comes from produto_empresa (per-loja stock, not global total)
// ---------------------------------------------------------------------------
const SEARCH_PRODUCTS = `
SELECT TOP 30
  p.proId            AS proId,
  pe.proCodigo       AS proCodigo,
  p.proDescricao     AS proDescricao,
  pe.proEstoqueAtual AS proEstoqueAtual,
  p.proUn            AS proUn
FROM produto p
INNER JOIN produto_empresa pe ON pe.proId = p.proId AND pe.empId = @empId
WHERE
  (pe.proDesativaProd IS NULL OR pe.proDesativaProd = 0)
  AND (
       p.proDescricao LIKE @termo
    OR pe.proCodigo   LIKE @termo
  )
ORDER BY p.proDescricao
`;

// ---------------------------------------------------------------------------
// Query 2 â€” GET_PRODUCT_PHYSICAL_STOCK
// proEstoqueAtual comes from produto_empresa (per-loja stock, not global total)
// ---------------------------------------------------------------------------
const GET_PRODUCT_PHYSICAL_STOCK = `
SELECT
  p.proId            AS proId,
  pe.proCodigo       AS proCodigo,
  p.proDescricao     AS proDescricao,
  pe.proEstoqueAtual AS proEstoqueAtual,
  p.proUn            AS proUn
FROM produto p
INNER JOIN produto_empresa pe ON pe.proId = p.proId AND pe.empId = @empId
WHERE p.proId = @proId
`;

// ---------------------------------------------------------------------------
// Query 3 â€” GET_FISCAL_STOCK_COMPOSITION
// Calculates fiscal stock using the validated formula (research doc Â§8).
// Formula: InventarioBase + Entradas(E) + DevoluÃ§Ãµes(1202/2202) - SaÃ­das(S) + Ajustes
// ---------------------------------------------------------------------------
const GET_FISCAL_STOCK_COMPOSITION = `
WITH InventarioBase AS (
  SELECT TOP 1
    ii.iviProId       AS proId,
    ii.iviProEstoque  AS baseInv,
    i.invId,
    i.invData         AS dataInventario,
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
  WHERE ni.nfiProd      = @proId
    AND n.empId         = @empId
    AND n.nfStatus      = 'F'
    AND n.nfTipoNf      = 'E'
    AND ni.nfiCfop NOT IN (1202, 2202, 5202, 6202)
    AND n.nfDataEmissao > ib.dataInventario
),
Saidas AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  CROSS JOIN InventarioBase ib
  WHERE ni.nfiProd      = @proId
    AND n.empId         = @empId
    AND n.nfStatus      = 'F'
    AND n.nfTipoNf      = 'S'
    AND n.nfDataEmissao > ib.dataInventario
),
Devolucoes AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  CROSS JOIN InventarioBase ib
  WHERE ni.nfiProd      = @proId
    AND n.empId         = @empId
    AND n.nfStatus      = 'F'
    AND ni.nfiCfop      IN (1202, 2202)
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
  ib.proId              AS proId,
  ib.empId              AS empId,
  ib.invId              AS inventarioId,
  CONVERT(VARCHAR(23), ib.dataInventario, 126) AS dataInventario,
  ib.baseInv            AS estoqueBaseInventario,
  e.total               AS entradasFiscais,
  s.total               AS saidasFiscais,
  d.total               AS devolucoesFiscais,
  aj.total              AS ajustesEstoque,
  (ib.baseInv + e.total - s.total + d.total + aj.total) AS estoqueFiscal
FROM InventarioBase ib
CROSS JOIN Entradas e
CROSS JOIN Saidas s
CROSS JOIN Devolucoes d
CROSS JOIN Ajustes aj
`;

// ---------------------------------------------------------------------------
// Query 4 â€” LIST_SERVICE_ORDERS
// All OS for loja (excludes only deleted 'Z'); optional filters via empty-string
// guards so all params are always passed (SQL Server requires declared params).
// ---------------------------------------------------------------------------
const LIST_SERVICE_ORDERS = `
SELECT
  v.vedId              AS vedId,
  COALESCE(c.cliNome, v.vedCliNome) AS clienteNome,
  ''                   AS placa,
  v.vedStatus          AS status,
  CONVERT(VARCHAR(23), v.vedAbertura, 126) AS dataAbertura,
  v.vedEquipamento     AS equipamento,
  v.vedMarca           AS marca,
  v.vedDefeito         AS defeito,
  v.vedObs             AS obs
FROM venda v
LEFT JOIN cliente c ON c.cliId = v.vedClienteId
WHERE v.empId   = @empId
  AND v.vedTipo = 'OS'
  AND v.vedStatus NOT IN ('Z')
  AND (@statusFilter = '' OR v.vedStatus = @statusFilter)
  AND (@clienteNome  = '' OR COALESCE(c.cliNome, v.vedCliNome) LIKE @clienteNome)
ORDER BY v.vedAbertura DESC
`;

// ---------------------------------------------------------------------------
// Query 5 â€” GET_SERVICE_ORDER_DETAIL
// ---------------------------------------------------------------------------
const GET_SERVICE_ORDER_DETAIL = `
SELECT
  v.vedId              AS vedId,
  v.vedClienteId       AS clienteId,
  COALESCE(c.cliNome, v.vedCliNome) AS clienteNome,
  COALESCE(ve.veiPlaca, '')          AS placa,
  v.vedStatus          AS status,
  CONVERT(VARCHAR(23), v.vedAbertura, 126) AS dataAbertura,
  v.vedEquipamento     AS equipamento,
  v.vedMarca           AS marca,
  v.vedDefeito         AS defeito,
  v.vedObs             AS obs,
  v.vedLaudoTec        AS laudoTec
FROM venda v
LEFT JOIN cliente c  ON c.cliId  = v.vedClienteId
LEFT JOIN veiculo ve ON ve.veiId = v.vedVeiculoId
WHERE v.vedId = @osId
  AND v.empId  = @empId
  AND v.vedTipo = 'OS'
`;

// ---------------------------------------------------------------------------
// Query 6 â€” GET_SERVICE_ORDER_ITEMS
// ---------------------------------------------------------------------------
const GET_SERVICE_ORDER_ITEMS = `
SELECT
  vdi.vdiId            AS itemId,
  vdi.vdiItemId        AS proId,
  COALESCE(pe.proCodigo, '') AS proCodigo,
  vdi.vdiProNome       AS proDescricao,
  vdi.vdiProUn         AS proUn,
  vdi.vdiQtde          AS qtde,
  vdi.vdiValor         AS precoUnitario,
  (vdi.vdiQtde * vdi.vdiValor) AS totalItem,
  vdi.vdiCancel        AS cancelado
FROM vendaItem vdi
LEFT JOIN produto_empresa pe ON pe.proId = vdi.vdiItemId AND pe.empId = @empId
WHERE vdi.vdiVedId = @osId
  AND vdi.vdiCancel = 0
ORDER BY vdi.vdiId
`;

// ---------------------------------------------------------------------------
// Registry â€” maps queryName â†’ { sql, allowedParams }
// Only keys listed here are callable from server functions.
// ---------------------------------------------------------------------------

type QueryDef = {
  sql: string;
  allowedParams: string[];
};

const REGISTRY: Record<string, QueryDef> = {
  SEARCH_PRODUCTS: {
    sql: SEARCH_PRODUCTS,
    allowedParams: ["empId", "termo"],
  },
  GET_PRODUCT_PHYSICAL_STOCK: {
    sql: GET_PRODUCT_PHYSICAL_STOCK,
    allowedParams: ["empId", "proId"],
  },
  GET_FISCAL_STOCK_COMPOSITION: {
    sql: GET_FISCAL_STOCK_COMPOSITION,
    allowedParams: ["empId", "proId"],
  },
  LIST_SERVICE_ORDERS: {
    sql: LIST_SERVICE_ORDERS,
    allowedParams: ["empId", "statusFilter", "clienteNome"],
  },
  GET_SERVICE_ORDER_DETAIL: {
    sql: GET_SERVICE_ORDER_DETAIL,
    allowedParams: ["empId", "osId"],
  },
  GET_SERVICE_ORDER_ITEMS: {
    sql: GET_SERVICE_ORDER_ITEMS,
    allowedParams: ["osId", "empId"],
  },
};

export type NamedQueryKey = keyof typeof REGISTRY;

/**
 * Resolve a named query to its SQL + validated params.
 * Strips any params not in the allowedParams list (defense in depth).
 * Throws if the query name is not registered.
 */
export function resolveNamedQuery(
  queryName: NamedQueryKey,
  rawParams: Record<string, unknown>,
): { sql: string; params: Record<string, unknown> } {
  const def = REGISTRY[queryName];
  if (!def) {
    throw new Error(`Named query desconhecida: "${String(queryName)}"`);
  }
  const params: Record<string, unknown> = {};
  for (const key of def.allowedParams) {
    if (key in rawParams) params[key] = rawParams[key];
  }
  return { sql: def.sql, params };
}
