/**
 * 067 — Si esta instancia tiene tienda (inventario y cotizaciones) o no.
 *
 * Mismo patrón que `AGENDA` (015, ADR-001): el código viaja siempre en main y
 * una variable de despliegue decide si existe. Sin `TIENDA`, las herramientas
 * `inventario` y `cotizar` no aparecen en la pantalla Agente ni viajan al
 * cerebro, y `POST /api/bot/notes` responde 404. La tienda (Shopify) la
 * consulta el cerebro, no el CRM: aquí no hay credenciales de nadie.
 */

const ON_VALUES = new Set(["on", "1", "true", "si", "sí", "yes"]);

export function parseTiendaFlag(raw: string | undefined): boolean {
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

/** De `process.env` directo, como `agendaEnabled()`: preguntar si una
 *  feature existe no puede depender de que todo el entorno valide. */
export function tiendaEnabled(): boolean {
  return parseTiendaFlag(process.env.TIENDA);
}

/** 404 y no 403: con la bandera apagada, la superficie no existe. */
export function tiendaDisabledResponse(): Response {
  return new Response(null, { status: 404 });
}
