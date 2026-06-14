import type { Empresa } from "./types";

const USER_KEY = "fsmd:user";
const EMP_KEY = "fsmd:empresa";

export function getUser(): { nome: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function setUser(u: { nome: string; email: string }) {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}
export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EMP_KEY);
}
export function getEmpresa(): Empresa | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(EMP_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function setEmpresa(e: Empresa) {
  localStorage.setItem(EMP_KEY, JSON.stringify(e));
}