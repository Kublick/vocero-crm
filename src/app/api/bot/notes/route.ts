import { z } from "zod";
import { apiError, parseBody } from "@/lib/api";
import { NOTA_MAX } from "@/lib/notas";
import { requireBotKey, resolveInstanceOrg } from "@/server/bot/auth";
import { notaDelCerebro } from "@/server/bot/notas";
import { tiendaDisabledResponse, tiendaEnabled } from "@/server/tienda/flag";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  texto: z.string().trim().min(1, "la nota no puede ir vacía").max(NOTA_MAX),
});

/**
 * 067 — El cerebro deja una nota interna en el hilo (el borrador de una
 * cotización). Solo con la bandera `TIENDA`; reglas en
 * `src/server/bot/notas.ts`. Solo escritura: no hay `GET`.
 */
export async function POST(req: Request) {
  if (!tiendaEnabled()) return tiendaDisabledResponse();
  const denied = requireBotKey(req);
  if (denied) return denied;

  const organizationId = await resolveInstanceOrg();
  if (!organizationId) {
    return apiError(409, "no_org", "La instancia aún no tiene organización");
  }

  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  const res = await notaDelCerebro({ organizationId, ...body.data });
  if (!res.ok) return apiError(res.status, res.code, res.message);
  return Response.json({ nota: res.nota }, { status: 201 });
}
