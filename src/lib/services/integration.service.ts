import { mockEmpresas, mockLogs } from "./mock-data";
import type { Empresa, LogIntegracao } from "../types";

export async function listarEmpresas(): Promise<Empresa[]> {
  await new Promise((r) => setTimeout(r, 60));
  return mockEmpresas.slice();
}

export async function listarLogs(empresaId?: string): Promise<LogIntegracao[]> {
  await new Promise((r) => setTimeout(r, 80));
  return empresaId ? mockLogs.filter((l) => l.empresaId === empresaId) : mockLogs.slice();
}

export async function testarConexao(empresaId: string): Promise<{ ok: boolean; latenciaMs: number }> {
  await new Promise((r) => setTimeout(r, 400));
  const emp = mockEmpresas.find((e) => e.id === empresaId);
  return { ok: emp?.statusConexao !== "offline", latenciaMs: Math.round(Math.random() * 600) + 80 };
}