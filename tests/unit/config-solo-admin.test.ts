import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Revisión de seguridad — Un `member` atiende la bandeja; no configura la
 * instancia (`canConfigure`). Antes, estas rutas solo pedían sesión: un
 * miembro podía mandar la llave de IA guardada a su servidor con «Probar
 * conexión», reapuntar el proveedor o cambiar el número de WhatsApp por el
 * suyo. Esta guarda escanea las rutas: cada método que escribe configuración
 * pasa por `withConfigAuth`.
 */
const RUTAS: Record<string, string[]> = {
  "agent/profile": ["PUT"],
  "calendar/settings": ["PUT"],
  kb: ["POST"],
  "kb/[id]": ["PATCH", "DELETE"],
  "lab/runs": ["POST"],
  "lab/suggestions/apply": ["POST"],
  "pipeline/stages": ["POST"],
  "pipeline/stages/[id]": ["PATCH", "DELETE"],
  "seed/demo": ["POST"],
  "settings/ai": ["PUT", "DELETE"],
  "settings/ai/models": ["POST"],
  "settings/ai/test": ["POST"],
  "settings/capi": ["PUT", "DELETE"],
  "settings/google": ["PUT", "DELETE"],
  "settings/google/test": ["POST"],
  "settings/whatsapp": ["PUT", "DELETE"],
  "settings/whatsapp/test": ["POST"],
  "settings/zoom": ["PUT", "DELETE"],
  "settings/zoom/test": ["POST"],
  templates: ["POST"],
  // El GET del webhook enseña el verify token (el segmento secreto de la URL).
  "settings/webhook": ["GET"],
};

describe("la configuración es solo de quien administra", () => {
  for (const [ruta, metodos] of Object.entries(RUTAS)) {
    it(`/api/${ruta}: ${metodos.join(", ")} con withConfigAuth`, () => {
      const src = readFileSync(
        path.join(process.cwd(), "src/app/api", ruta, "route.ts"),
        "utf8"
      );
      for (const m of metodos) {
        expect(src).toMatch(new RegExp(`export const ${m} = withConfigAuth\\(`));
      }
    });
  }

  it("withConfigAuth responde 403 a un member y deja pasar a owner y admin", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    let rol = "member";
    vi.doMock("@/lib/auth/session", () => ({
      requireSession: async () => ({ userId: "u", organizationId: "o", role: rol }),
      UnauthorizedError: class extends Error {},
    }));
    const { withConfigAuth } = await import("@/lib/api");
    const handler = withConfigAuth(async () => Response.json({ ok: true }));
    expect((await handler()).status).toBe(403);
    rol = "owner";
    expect((await handler()).status).toBe(200);
    rol = "admin";
    expect((await handler()).status).toBe(200);
    vi.doUnmock("@/lib/auth/session");
  });
});
