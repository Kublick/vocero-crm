import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { herramientasEfectivas } from "@/lib/agent-roles";
import type { NotaDto } from "@/lib/notas";
import { crearNotaDelAgente } from "@/server/notas";

/**
 * 067 — El cerebro deja una nota interna (`POST /api/bot/notes`): el borrador
 * de una cotización para que una persona lo apruebe.
 *
 * Enmienda la D5 de 050 solo en escritura: el cerebro escribe notas, nunca las
 * lee, y el despacho sigue sin llevarlas. Este es el único archivo de `bot/`
 * que puede tocar las notas (lo vigila `tests/unit/notas-internas.test.ts`).
 *
 * La bandera `TIENDA` la comprueba la ruta (404); aquí, las reglas:
 * - la herramienta `cotizar` encendida en el perfil;
 * - la IA activa en la conversación, como en `/api/bot/stage`.
 */

export type ResultadoNota =
  | { ok: true; nota: NotaDto }
  | { ok: false; status: 404; code: "not_found"; message: string }
  | { ok: false; status: 409; code: "ai_paused" | "herramienta_apagada"; message: string };

export async function notaDelCerebro(input: {
  organizationId: string;
  conversationId: string;
  texto: string;
}): Promise<ResultadoNota> {
  const db = getDb();
  const { organizationId, conversationId } = input;

  const [conv] = await db
    .select({ aiEnabled: schema.conversation.aiEnabled, handoffAt: schema.conversation.handoffAt })
    .from(schema.conversation)
    .where(scoped(schema.conversation.organizationId, organizationId, eq(schema.conversation.id, conversationId)))
    .limit(1);
  if (!conv) {
    return { ok: false, status: 404, code: "not_found", message: "Conversación no encontrada" };
  }

  const [perfil] = await db
    .select({ tools: schema.agentProfile.tools })
    .from(schema.agentProfile)
    .where(scoped(schema.agentProfile.organizationId, organizationId))
    .limit(1);
  if (!herramientasEfectivas(perfil?.tools, { tienda: true }).includes("cotizar")) {
    return {
      ok: false,
      status: 409,
      code: "herramienta_apagada",
      message: "La herramienta «Cotizar» está apagada en el perfil del agente",
    };
  }

  // Con una persona al frente, el cerebro no toca la conversación. El orden
  // del flujo de cotizar es nota → etapa → handoff, así que la nota llega
  // antes de la pausa.
  if (!conv.aiEnabled || conv.handoffAt) {
    return { ok: false, status: 409, code: "ai_paused", message: "La IA está en pausa en esta conversación" };
  }

  return { ok: true, nota: await crearNotaDelAgente(organizationId, conversationId, input.texto) };
}
