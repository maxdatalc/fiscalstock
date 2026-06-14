/**
 * Stock status types and derivation logic.
 *
 * A status code is derived from the relation between physical stock,
 * fiscal stock, and the requested quantity. It drives both the UI warning
 * color and the decision to block / warn / allow an OS item addition.
 */

export type StockStatusCode =
  | "OK" // physical >= qty AND fiscal >= qty — safe to invoice
  | "EXCEDE_FISICO" // qty > physical (can't pick from shelf)
  | "EXCEDE_FISCAL" // qty > fiscal (NF will fail)
  | "EXCEDE_FISICO_E_FISCAL" // qty > both
  | "SEM_ESTOQUE_FISICO" // physical <= 0
  | "SEM_ESTOQUE_FISCAL" // fiscal <= 0
  | "FISICO_MAIOR_QUE_FISCAL" // physical OK, fiscal insufficient
  | "FISCAL_MAIOR_QUE_FISICO" // fiscal OK but physical < qty
  | "PENDENTE_VALIDACAO" // no inventory found — cannot compute fiscal
  | "ERRO_CONSULTA"; // bridge query failed

export interface StockValidationResult {
  code: StockStatusCode;
  blocked: boolean; // true → must not add to OS
  warning: boolean; // true → add with user confirmation
  message: string; // human-readable, pt-BR
}

/**
 * Derive the stock status given physical stock, fiscal stock, and
 * the quantity the user wants to add to the OS.
 *
 * Rules:
 *  1. Physical = 0 → SEM_ESTOQUE_FISICO (blocked — nothing to pick)
 *  2. Fiscal = 0   → SEM_ESTOQUE_FISCAL (blocked — NF will fail)
 *  3. Qty > both   → EXCEDE_FISICO_E_FISCAL (blocked)
 *  4. Qty > physical → EXCEDE_FISICO (blocked — can't physically fulfil)
 *  5. Qty > fiscal   → EXCEDE_FISCAL (warning — can pick, NF may fail)
 *  6. Physical > fiscal (at this qty) → FISICO_MAIOR_QUE_FISCAL (warning)
 *  7. Otherwise → OK
 */
export function deriveStockStatus(
  physicalStock: number,
  fiscalStock: number,
  requestedQty: number,
): StockValidationResult {
  if (physicalStock <= 0) {
    return {
      code: "SEM_ESTOQUE_FISICO",
      blocked: true,
      warning: false,
      message: "Estoque físico zerado — produto indisponível no momento.",
    };
  }

  if (fiscalStock <= 0) {
    return {
      code: "SEM_ESTOQUE_FISCAL",
      blocked: true,
      warning: false,
      message: `Estoque fiscal zerado — não é possível emitir NF para este produto (físico: ${physicalStock}).`,
    };
  }

  const excedeFisico = requestedQty > physicalStock;
  const excedeFiscal = requestedQty > fiscalStock;

  if (excedeFisico && excedeFiscal) {
    return {
      code: "EXCEDE_FISICO_E_FISCAL",
      blocked: true,
      warning: false,
      message: `Quantidade (${requestedQty}) excede estoque físico (${physicalStock}) e fiscal (${fiscalStock}).`,
    };
  }

  if (excedeFisico) {
    return {
      code: "EXCEDE_FISICO",
      blocked: true,
      warning: false,
      message: `Quantidade (${requestedQty}) excede o estoque físico disponível (${physicalStock}).`,
    };
  }

  if (excedeFiscal) {
    return {
      code: "EXCEDE_FISCAL",
      blocked: false,
      warning: true,
      message: `Quantidade (${requestedQty}) excede o estoque fiscal (${fiscalStock}). A emissão de NF poderá falhar.`,
    };
  }

  if (physicalStock > fiscalStock) {
    return {
      code: "FISICO_MAIOR_QUE_FISCAL",
      blocked: false,
      warning: true,
      message: `Estoque físico (${physicalStock}) maior que fiscal (${fiscalStock}). Verifique divergência antes de emitir NF.`,
    };
  }

  return {
    code: "OK",
    blocked: false,
    warning: false,
    message: "Estoque físico e fiscal suficientes.",
  };
}

/** Map status codes to UI risk levels for consistent badge colours. */
export function statusToRiskLevel(code: StockStatusCode): "ok" | "atencao" | "bloqueado" {
  switch (code) {
    case "OK":
    case "FISCAL_MAIOR_QUE_FISICO":
      return "ok";
    case "EXCEDE_FISCAL":
    case "FISICO_MAIOR_QUE_FISCAL":
    case "PENDENTE_VALIDACAO":
      return "atencao";
    default:
      return "bloqueado";
  }
}
