import { createHmac, timingSafeEqual } from "node:crypto";
import { count } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/** Cuántas organizaciones tiene la instancia (0 = nadie se ha registrado). */
export async function organizationCount(): Promise<number> {
  const db = getDb();
  const rows = await db.select({ n: count() }).from(schema.organization);
  return rows[0]?.n ?? 0;
}

/**
 * Registro público cerrado tras la primera organización (FR-060), salvo la
 * variable de escape ALLOW_SIGNUP=true. Las cuentas de equipo las crea el
 * propietario (bypass interno del gate).
 */
export async function isPublicSignupAllowed(): Promise<boolean> {
  if (process.env.ALLOW_SIGNUP === "true") return true;
  return (await organizationCount()) === 0;
}

export { SETUP_CODE_HEADER } from "@/lib/setup-code";

/**
 * Revisión de seguridad — El primer registro se queda con la instancia. Sin
 * un código, cualquiera que encontrara el dominio entre el `docker compose
 * up` y el registro del dueño se volvía propietario. En producción, mientras
 * no haya organización, el registro pide el código de instalación que el
 * arranque imprime en los logs. En desarrollo (y en los arneses E2E) no se
 * pide.
 */
export function setupCodeRequired(): boolean {
  return process.env.NODE_ENV === "production";
}

function normalizar(codigo: string): string {
  return codigo.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

/**
 * El código: `SETUP_TOKEN` si existe; si no, uno derivado de
 * `BETTER_AUTH_SECRET` (HMAC, no revela el secreto), así una instalación no
 * necesita una variable nueva. Formato `XXXX-XXXX-XXXX` para dictarlo.
 */
export function setupCode(
  env: Record<string, string | undefined> = process.env
): string {
  const propio = env.SETUP_TOKEN?.trim();
  if (propio) return propio;
  const derivado = createHmac("sha256", env.BETTER_AUTH_SECRET ?? "")
    .update("vocero:codigo-de-instalacion")
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
  return derivado.match(/.{4}/g)!.join("-");
}

/** Compara en tiempo constante, sin importar guiones, espacios ni mayúsculas. */
export function setupCodeMatches(
  recibido: string | null | undefined,
  esperado: string = setupCode()
): boolean {
  if (!recibido) return false;
  const a = Buffer.from(normalizar(recibido));
  const b = Buffer.from(normalizar(esperado));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
