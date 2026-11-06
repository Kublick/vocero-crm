import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Revisión de seguridad — La app no arranca con los valores de ejemplo de
 * `.env.example`: el esquema solo mide longitudes, y `REEMPLAZA_secreto_de_
 * sesiones` (28) o `REEMPLAZA_token_de_verificacion` pasaban.
 */
const BASE = {
  APP_BASE_URL: "https://crm.ejemplo.com",
  DATABASE_URL: "postgresql://u:p@localhost:5432/d",
  BETTER_AUTH_SECRET: "un-secreto-real-de-sesiones-123",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  META_WEBHOOK_VERIFY_TOKEN: "token-real-de-verificacion",
};

function stub(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("valores de ejemplo en el entorno", () => {
  it("placeholderVars encuentra las variables del esquema con REEMPLAZA_", async () => {
    const { placeholderVars } = await import("@/lib/env");
    expect(
      placeholderVars({
        ...BASE,
        BETTER_AUTH_SECRET: "REEMPLAZA_secreto_de_sesiones",
        META_WEBHOOK_VERIFY_TOKEN: "REEMPLAZA_token_de_verificacion",
        DOMAIN: "REEMPLAZA_crm.tudominio.com", // no es del esquema de la app
      }).sort()
    ).toEqual(["BETTER_AUTH_SECRET", "META_WEBHOOK_VERIFY_TOKEN"]);
  });

  it("getEnv se niega a arrancar con el secreto de sesiones de ejemplo", async () => {
    stub({ ...BASE, BETTER_AUTH_SECRET: "REEMPLAZA_secreto_de_sesiones" });
    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("…y con la contraseña de ejemplo dentro de DATABASE_URL", async () => {
    stub({
      ...BASE,
      DATABASE_URL: "postgresql://postgres:REEMPLAZA_password_de_postgres@postgres:5432/vocero",
    });
    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });

  it("con valores reales arranca", async () => {
    stub(BASE);
    const { getEnv } = await import("@/lib/env");
    expect(getEnv().BETTER_AUTH_SECRET).toBe(BASE.BETTER_AUTH_SECRET);
  });

  it("en el build no aplica (ahí no hay secretos todavía)", async () => {
    stub({
      ...BASE,
      BETTER_AUTH_SECRET: "REEMPLAZA_secreto_de_sesiones",
      NEXT_PHASE: "phase-production-build",
    });
    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).not.toThrow();
  });
});
