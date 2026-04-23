export type BackendAccessMode = "hybrid" | "direct_rls" | "api_first";

const normalizeMode = (value: string): BackendAccessMode => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "direct_rls") return "direct_rls";
  if (normalized === "api_first") return "api_first";
  return "hybrid";
};

export const backendAccessMode: BackendAccessMode = normalizeMode(
  process.env.NEXT_PUBLIC_BACKEND_ACCESS_MODE ?? "hybrid",
);

const API_FIRST_MODULES = new Set(["super-admin"]);

export const isApiFirstModule = (moduleName: string): boolean => {
  if (backendAccessMode === "api_first") return true;
  return API_FIRST_MODULES.has(moduleName);
};
