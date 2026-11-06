import { afterEach, describe, expect, it, vi } from "vitest";

/** FR-060/FR-081: registro cerrado tras la 1ª organización, salvo escape. */

let orgCount = 0;

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => Promise.resolve([{ n: orgCount }]),
    }),
  }),
  schema: { organization: {} },
}));

import { isPublicSignupAllowed } from "@/server/auth/registration";

afterEach(() => vi.unstubAllEnvs());

describe("registro público cerrado", () => {
  it("instancia vacía → registro permitido (primer usuario)", async () => {
    orgCount = 0;
    vi.stubEnv("ALLOW_SIGNUP", "");
    expect(await isPublicSignupAllowed()).toBe(true);
  });

  it("ya existe una organización → cerrado", async () => {
    orgCount = 1;
    vi.stubEnv("ALLOW_SIGNUP", "");
    expect(await isPublicSignupAllowed()).toBe(false);
  });

  it("escape ALLOW_SIGNUP=true → permitido aunque exista organización", async () => {
    orgCount = 1;
    vi.stubEnv("ALLOW_SIGNUP", "true");
    expect(await isPublicSignupAllowed()).toBe(true);
  });

  it("otros valores del escape NO abren el registro", async () => {
    orgCount = 1;
    vi.stubEnv("ALLOW_SIGNUP", "1");
    expect(await isPublicSignupAllowed()).toBe(false);
  });
});

describe("código de instalación del primer registro (revisión de seguridad)", () => {
  it("se deriva del secreto de sesiones, estable y con formato XXXX-XXXX-XXXX", async () => {
    const { setupCode } = await import("@/server/auth/registration");
    const a = setupCode({ BETTER_AUTH_SECRET: "secreto-uno-de-prueba-123" });
    expect(a).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(setupCode({ BETTER_AUTH_SECRET: "secreto-uno-de-prueba-123" })).toBe(a);
    expect(setupCode({ BETTER_AUTH_SECRET: "otro-secreto-distinto-456" })).not.toBe(a);
    expect(a).not.toContain("secreto");
  });

  it("SETUP_TOKEN manda sobre el derivado", async () => {
    const { setupCode } = await import("@/server/auth/registration");
    expect(
      setupCode({ SETUP_TOKEN: " mi-codigo ", BETTER_AUTH_SECRET: "x".repeat(20) })
    ).toBe("mi-codigo");
  });

  it("compara sin importar guiones, espacios ni mayúsculas; vacío o distinto no pasa", async () => {
    const { setupCodeMatches } = await import("@/server/auth/registration");
    expect(setupCodeMatches("ab12-cd34-ef56", "AB12-CD34-EF56")).toBe(true);
    expect(setupCodeMatches(" AB12 CD34 EF56 ", "AB12-CD34-EF56")).toBe(true);
    expect(setupCodeMatches("AB12-CD34-EF57", "AB12-CD34-EF56")).toBe(false);
    expect(setupCodeMatches("", "AB12-CD34-EF56")).toBe(false);
    expect(setupCodeMatches(null, "AB12-CD34-EF56")).toBe(false);
    expect(setupCodeMatches("---", "---")).toBe(false);
  });

  it("solo se exige en producción", async () => {
    const { setupCodeRequired } = await import("@/server/auth/registration");
    vi.stubEnv("NODE_ENV", "production");
    expect(setupCodeRequired()).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(setupCodeRequired()).toBe(false);
  });
});
