export type Empresa = {
  id: string;
  nome: string;
  empId: string;
  bridgeUrl: string;
  maxApiUrl: string;
  terminal: string;
  statusConexao: "online" | "offline" | "instavel";
};

export type Produto = {
  id: string;
  codigo: string;
  codigoBarras: string;
  nome: string;
  unidade: string;
  estoqueFisico: number;
  estoqueFiscal: number;
  composicaoFiscal: {
    inventarioBase: number;
    entradas: number;
    saidas: number;
    devolucoes: number;
    ajustes: number;
  };
  reservadoEmOS: number;
  empresaId: string;
};

export type StatusFiscal = "ok" | "atencao" | "bloqueado";

export type OrdemServico = {
  id: string;
  numero: string;
  cliente: string;
  placa: string;
  data: string;
  status: "aberta" | "em_andamento" | "faturada" | "cancelada";
  empresaId: string;
  itens: ItemOS[];
};

export type ItemOS = {
  id: string;
  produtoId: string;
  produtoNome: string;
  codigo: string;
  quantidade: number;
  observacao?: string;
};

export type LogIntegracao = {
  id: string;
  data: string;
  empresaId: string;
  tipo: "consulta_estoque" | "consulta_os" | "lancamento" | "autenticacao";
  status: "sucesso" | "erro" | "alerta";
  mensagem: string;
  usuario: string;
};

export function calcularStatusFiscal(p: Produto): StatusFiscal {
  if (p.estoqueFiscal <= 0) return "bloqueado";
  if (p.estoqueFiscal < p.estoqueFisico) return "atencao";
  return "ok";
}

export function disponivelParaEmissao(p: Produto): number {
  return Math.max(0, Math.min(p.estoqueFisico, p.estoqueFiscal) - p.reservadoEmOS);
}

// ============================================================================
// Contratos estáveis (Lovable ↔ Claude Code).
// Estas interfaces representam o "contrato" entre o frontend e o backend real.
// Quando o Claude Code substituir os mocks por integração real (Bridge SQL +
// MaxAPI), os tipos abaixo NÃO devem ser quebrados.
// ============================================================================

/** Status fiscal vs físico de um produto. */
export type StockRiskStatus = "ok" | "atencao" | "bloqueado";

/** Identificação de empresa e loja MaxData (parametriza toda consulta). */
export interface EmpresaRef {
  id: string;             // uuid no Supabase
  nome_fantasia: string;
  razao_social?: string | null;
  cnpj?: string | null;
  ativo: boolean;
}

export interface LojaRef {
  id: string;             // uuid no Supabase
  empresa_id: string;
  nome: string;
  /** ID da empresa/loja no MaxData (ERP) — usado nas queries SQL e na MaxAPI. */
  emp_id_maxdata: string;
  /** Terminal padrão dessa loja (usado em chamadas MaxAPI). */
  terminal_maxdata: string;
  ativo: boolean;
}

/** Configuração de integração de uma loja. Tokens nunca trafegam pro frontend. */
export interface IntegrationConfig {
  loja_id: string;
  bridge_configurada: boolean;
  maxapi_configurada: boolean;
  status_bridge: "online" | "offline" | "erro" | "nao_configurado";
  status_maxapi: "online" | "offline" | "erro" | "nao_configurado";
  ultimo_teste_bridge: string | null;
  ultimo_teste_maxapi: string | null;
}

/** Item resumido de uma listagem de produtos. */
export interface ProductSummary {
  id: string;
  codigo: string;
  codigoBarras: string;
  nome: string;
  unidade: string;
  estoqueFisico: number;
  estoqueFiscal: number;
}

/** Composição do estoque fiscal. Atualmente simulada. */
export interface FiscalStockComposition {
  inventario_base: number;
  entradas: number;
  saidas: number;
  devolucoes: number;
  ajustes: number;
  /**
   * Indica se a composição foi calculada com regra fiscal validada (true)
   * ou se ainda é uma simulação a ser validada pelo Claude Code (false).
   * TODO CLAUDE: setar como true quando a fórmula real estiver definida e
   * bater com o MaxManager.
   */
  validada: boolean;
}

/** Detalhe completo do estoque de um produto em uma loja. */
export interface ProductStockDetail {
  produto: { id: string; codigo: string; codigoBarras: string; nome: string; unidade: string };
  estoque_fisico: number;
  estoque_fiscal: number;
  diferenca: number;
  status_risco: StockRiskStatus;
  composicao_estoque_fiscal: FiscalStockComposition;
  pode_emitir_nf: boolean;
  pode_lancar_os: boolean;
  disponivel_para_emissao: number;
  alertas: { tipo: "warning" | "danger"; mensagem: string }[];
}

export interface ServiceOrderItem {
  id: string;
  produto_id: string;
  produto_nome: string;
  codigo: string;
  quantidade: number;
  observacao?: string | null;
}

export interface ServiceOrder {
  id: string;
  numero: string;
  cliente: string;
  placa: string;
  data: string;            // ISO
  status: "aberta" | "em_andamento" | "faturada" | "cancelada";
  loja_id: string;
  itens: ServiceOrderItem[];
}

export interface AuditLog {
  id: string;
  data: string;            // ISO
  user_id: string | null;
  empresa_id: string | null;
  loja_id: string | null;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  detalhes_json: unknown;
}