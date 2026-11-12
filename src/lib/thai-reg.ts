/** Thai company registration number (เลขทะเบียนนิติบุคคล): browser-safe checks shared by sign-up and the server. */
export const digitsOnly = (s: string) => s.replace(/\D/g, "").slice(0, 13);

/** 13 digits; the 13th equals (11 − (d1×13 + d2×12 + … + d12×2) mod 11) mod 10. */
export function isValidThaiReg(s: string | null | undefined): boolean {
  const d = String(s ?? "");
  if (!/^\d{13}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

/** Changes allowed per sign-up, and the lookup limits. */
export const REG_CHANGES = 2;
export const LOOKUPS_PER_EMAIL = 3;
export const LOOKUPS_PER_DEVICE_24H = 5;

/** Website saved without https:// and without a trailing slash. */
export const normWebsite = (s: string) => s.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

/** Sign-up steps per role (section 1). */
export type SignupStepKey = "role" | "about" | "type" | "company" | "sector" | "logo" | "account" | "code";
export function signupSteps(role: "seller" | "buyer" | "advisor" | null, answer: string | null): SignupStepKey[] {
  if (role === "buyer") {
    if (answer === "individual") return ["role", "about", "company", "sector", "account", "code"];
    return ["role", "about", "type", "company", "sector", "logo", "account", "code"];
  }
  return ["role", "about", "company", "sector", "logo", "account", "code"];
}
