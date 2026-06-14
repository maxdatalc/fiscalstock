import type { Empresa, Produto, OrdemServico, LogIntegracao } from "../types";

export const mockEmpresas: Empresa[] = [
  {
    id: "emp-001",
    nome: "MaxData Matriz - São Paulo",
    empId: "1",
    bridgeUrl: "https://bridge.exemplo.local/sql",
    maxApiUrl: "https://maxapi.exemplo.local",
    terminal: "TERM-01",
    statusConexao: "online",
  },
  {
    id: "emp-002",
    nome: "MaxData Filial - Campinas",
    empId: "2",
    bridgeUrl: "https://bridge2.exemplo.local/sql",
    maxApiUrl: "https://maxapi2.exemplo.local",
    terminal: "TERM-07",
    statusConexao: "instavel",
  },
];

export const mockProdutos: Produto[] = [
  {
    id: "p1", codigo: "P-1001", codigoBarras: "7891234567001",
    nome: "Óleo Motor 5W30 Sintético 1L", unidade: "UN",
    estoqueFisico: 42, estoqueFiscal: 38, reservadoEmOS: 2, empresaId: "emp-001",
    composicaoFiscal: { inventarioBase: 50, entradas: 30, saidas: 40, devolucoes: 2, ajustes: -4 },
  },
  {
    id: "p2", codigo: "P-1002", codigoBarras: "7891234567002",
    nome: "Filtro de Óleo Premium", unidade: "UN",
    estoqueFisico: 15, estoqueFiscal: 8, reservadoEmOS: 1, empresaId: "emp-001",
    composicaoFiscal: { inventarioBase: 20, entradas: 10, saidas: 22, devolucoes: 0, ajustes: 0 },
  },
  {
    id: "p3", codigo: "P-1003", codigoBarras: "7891234567003",
    nome: "Pastilha de Freio Dianteira", unidade: "JG",
    estoqueFisico: 6, estoqueFiscal: 0, reservadoEmOS: 0, empresaId: "emp-001",
    composicaoFiscal: { inventarioBase: 12, entradas: 6, saidas: 18, devolucoes: 0, ajustes: 0 },
  },
  {
    id: "p4", codigo: "P-1004", codigoBarras: "7891234567004",
    nome: "Vela de Ignição Iridium", unidade: "UN",
    estoqueFisico: 80, estoqueFiscal: 85, reservadoEmOS: 4, empresaId: "emp-001",
    composicaoFiscal: { inventarioBase: 100, entradas: 40, saidas: 55, devolucoes: 0, ajustes: 0 },
  },
  {
    id: "p5", codigo: "P-1005", codigoBarras: "7891234567005",
    nome: "Fluido de Freio DOT4 500ml", unidade: "UN",
    estoqueFisico: 24, estoqueFiscal: -3, reservadoEmOS: 0, empresaId: "emp-002",
    composicaoFiscal: { inventarioBase: 10, entradas: 15, saidas: 28, devolucoes: 0, ajustes: 0 },
  },
  {
    id: "p6", codigo: "P-1006", codigoBarras: "7891234567006",
    nome: "Aditivo Radiador Orgânico 1L", unidade: "UN",
    estoqueFisico: 33, estoqueFiscal: 33, reservadoEmOS: 0, empresaId: "emp-002",
    composicaoFiscal: { inventarioBase: 40, entradas: 20, saidas: 27, devolucoes: 0, ajustes: 0 },
  },
];

export const mockOrdens: OrdemServico[] = [
  {
    id: "os-1", numero: "OS-2026-0142", cliente: "João Silva", placa: "ABC-1D23",
    data: "2026-06-12", status: "aberta", empresaId: "emp-001",
    itens: [
      { id: "i1", produtoId: "p1", produtoNome: "Óleo Motor 5W30 Sintético 1L", codigo: "P-1001", quantidade: 4 },
      { id: "i2", produtoId: "p2", produtoNome: "Filtro de Óleo Premium", codigo: "P-1002", quantidade: 1 },
    ],
  },
  {
    id: "os-2", numero: "OS-2026-0143", cliente: "Maria Souza", placa: "DEF-4G56",
    data: "2026-06-13", status: "em_andamento", empresaId: "emp-001",
    itens: [
      { id: "i3", produtoId: "p4", produtoNome: "Vela de Ignição Iridium", codigo: "P-1004", quantidade: 4 },
    ],
  },
  {
    id: "os-3", numero: "OS-2026-0144", cliente: "Auto Center Premium", placa: "GHI-7J89",
    data: "2026-06-14", status: "aberta", empresaId: "emp-002",
    itens: [],
  },
];

export const mockLogs: LogIntegracao[] = [
  { id: "l1", data: "2026-06-14T10:22:00Z", empresaId: "emp-001", tipo: "consulta_estoque", status: "sucesso", mensagem: "Consulta de estoque de 6 produtos", usuario: "admin" },
  { id: "l2", data: "2026-06-14T10:25:00Z", empresaId: "emp-002", tipo: "autenticacao", status: "alerta", mensagem: "Tempo de resposta acima do esperado (1.8s)", usuario: "admin" },
  { id: "l3", data: "2026-06-14T10:30:00Z", empresaId: "emp-001", tipo: "consulta_os", status: "sucesso", mensagem: "Listagem de 12 O.S abertas", usuario: "admin" },
  { id: "l4", data: "2026-06-14T10:35:00Z", empresaId: "emp-002", tipo: "consulta_estoque", status: "erro", mensagem: "Falha na Bridge SQL: timeout", usuario: "admin" },
];