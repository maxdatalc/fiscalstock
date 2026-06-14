/**
 * calculateFiscalStock — server-side only.
 *
 * Computes the fiscal stock for a single product in a single empresa using
 * the validated formula (see docs/maxdata-fiscal-stock-research.md §8):
 *
 *   Fiscal = InventarioBase
 *           + EntradasNF   (nfTipoNf='E', nfStatus='F', CFOP ≠ devolução, após inventário)
 *           + Devoluções   (CFOP 1202/2202, nfStatus='F', após inventário)
 *           - SaídasNF     (nfTipoNf='S', nfStatus='F', após inventário)
 *           + AjustesLíq   (paeStatus='F', paiQtdInf-paiProEstoque, após inventário)
 *
 * Formula validated against BATAUTO on 2026-06-14:
 *   proId=15788, empId=1 → fiscal=898 = proEstoqueAtual (no movements since last inventory).
 *
 * IMPORTANT: Do NOT change the fiscal formula without documenting the reason
 * and running a reconciliation query on BATAUTO to verify the result.
 */

import { queryBridge, type BridgeConfig } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";
import { deriveStockStatus, type StockStatusCode } from "./stock-status";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface FiscalStockComposition {
  inventarioId: number | null;
  dataInventario: string | null;
  estoqueBaseInventario: number;
  entradasFiscais: number;
  saidasFiscais: number;
  devolucoesFiscais: number;
  ajustesEstoque: number;
  estoqueFiscal: number;
}

export interface FiscalStockResult {
  proId: number;
  empId: number;
  proCodigo: string;
  proDescricao: string;
  proUn: string;
  estoqueFisico: number;
  composicao: FiscalStockComposition | null;
  estoqueFiscal: number;
  diferenca: number;
  statusCode: StockStatusCode;
  alertas: string[];
  semInventario: boolean;
}

// ---------------------------------------------------------------------------
// Raw row shapes returned by Bridge
// ---------------------------------------------------------------------------

interface PhysicalRow {
  proId: number;
  proCodigo: string;
  proDescricao: string;
  proEstoqueAtual: number;
  proUn: string;
}

interface FiscalRow {
  proId: number;
  empId: number;
  inventarioId: number | null;
  dataInventario: string | null;
  estoqueBaseInventario: number;
  entradasFiscais: number;
  saidasFiscais: number;
  devolucoesFiscais: number;
  ajustesEstoque: number;
  estoqueFiscal: number;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Calculate physical and fiscal stock for one product in one empresa.
 *
 * @param empId   - MaxData empresa ID (1–5)
 * @param proId   - MaxData produto ID
 * @param bridge  - Bridge SQL config (url + token)
 * @returns FiscalStockResult with both physical and fiscal breakdown
 */
export async function calculateFiscalStock(
  empId: number,
  proId: number,
  bridge: BridgeConfig,
): Promise<FiscalStockResult> {
  // Run physical and fiscal queries concurrently
  const [physicalRows, fiscalRows] = await Promise.all([
    queryBridge<PhysicalRow>(
      bridge,
      resolveNamedQuery("GET_PRODUCT_PHYSICAL_STOCK", { empId, proId }).sql,
      { empId, proId },
    ),
    queryBridge<FiscalRow>(
      bridge,
      resolveNamedQuery("GET_FISCAL_STOCK_COMPOSITION", { empId, proId }).sql,
      { empId, proId },
    ),
  ]);

  if (!physicalRows.length) {
    throw new Error(`Produto proId=${proId} não encontrado no empId=${empId}`);
  }

  const ph = physicalRows[0];
  const estoqueFisico = Number(ph.proEstoqueAtual ?? 0);
  const alertas: string[] = [];

  // No inventory → cannot compute fiscal stock
  if (!fiscalRows.length) {
    alertas.push("Nenhum inventário encontrado para este produto — estoque fiscal indisponível.");
    return {
      proId,
      empId,
      proCodigo: ph.proCodigo ?? "",
      proDescricao: ph.proDescricao ?? "",
      proUn: ph.proUn ?? "",
      estoqueFisico,
      composicao: null,
      estoqueFiscal: 0,
      diferenca: estoqueFisico,
      statusCode: "PENDENTE_VALIDACAO",
      alertas,
      semInventario: true,
    };
  }

  const fi = fiscalRows[0];
  const estoqueFiscal = Number(fi.estoqueFiscal ?? 0);
  const diferenca = estoqueFisico - estoqueFiscal;

  if (diferenca > 0) {
    alertas.push(
      `Estoque físico (${estoqueFisico}) maior que fiscal (${estoqueFiscal}) em ${diferenca} unidades.`,
    );
  }
  if (diferenca < 0) {
    alertas.push(
      `Estoque fiscal (${estoqueFiscal}) maior que físico (${estoqueFisico}) em ${Math.abs(diferenca)} unidades — possível entrada de NF não recebida fisicamente.`,
    );
  }

  const composicao: FiscalStockComposition = {
    inventarioId: fi.inventarioId,
    dataInventario: fi.dataInventario,
    estoqueBaseInventario: Number(fi.estoqueBaseInventario ?? 0),
    entradasFiscais: Number(fi.entradasFiscais ?? 0),
    saidasFiscais: Number(fi.saidasFiscais ?? 0),
    devolucoesFiscais: Number(fi.devolucoesFiscais ?? 0),
    ajustesEstoque: Number(fi.ajustesEstoque ?? 0),
    estoqueFiscal,
  };

  // Derive status without a requested quantity (qty=0 = "what's available")
  const { code } = deriveStockStatus(estoqueFisico, estoqueFiscal, 0);

  return {
    proId,
    empId,
    proCodigo: ph.proCodigo ?? "",
    proDescricao: ph.proDescricao ?? "",
    proUn: ph.proUn ?? "",
    estoqueFisico,
    composicao,
    estoqueFiscal,
    diferenca,
    statusCode: code,
    alertas,
    semInventario: false,
  };
}

/**
 * Validate whether a quantity can be added to an OS for a given product.
 * Returns both the FiscalStockResult and the validation outcome for the requested qty.
 */
export async function validateStockForOsItem(
  empId: number,
  proId: number,
  requestedQty: number,
  bridge: BridgeConfig,
) {
  const stock = await calculateFiscalStock(empId, proId, bridge);
  const validation = deriveStockStatus(stock.estoqueFisico, stock.estoqueFiscal, requestedQty);
  return { stock, validation };
}
