const apiBaseEnv = process.env.NEXT_PUBLIC_MENTRA_API_BASE_URL ?? process.env.NEXT_PUBLIC_MENTRA_API_BASE ?? "";
const tenantEnv = process.env.NEXT_PUBLIC_MENTRA_TENANT_ID ?? "demo";

if (!apiBaseEnv && typeof console !== "undefined") {
  console.warn("NEXT_PUBLIC_MENTRA_API_BASE_URL is not set. API calls will likely fail.");
}

export const appConfig = {
  apiBaseUrl: apiBaseEnv.replace(/\/$/, ""),
  tenantId: tenantEnv
};
