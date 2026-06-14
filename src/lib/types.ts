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