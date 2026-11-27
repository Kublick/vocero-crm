# Implementation Plan: Inventario y cotizaciones por WhatsApp

**Branch**: `feat/067-cotizar-por-whatsapp` | **Spec**: [spec.md](spec.md) | **Tareas**: [tasks.md](tasks.md) | **Recorrido**: [quickstart.md](quickstart.md)

## Summary

Una bandera `TIENDA`, dos claves de herramienta (`inventario`, `cotizar`) que
solo existen con ella, una columna `por_agente` en `conversation_note` y la
ruta `POST /api/bot/notes` para que el cerebro deje el borrador de la
cotización en el hilo. Todo lo de Shopify y la transcripción vive en el fork
de `nea-agent`.

## Modelo de datos

Migración aditiva `0027_nota_por_agente.sql`:

| Tabla | Columna | Tipo | Notas |
|---|---|---|---|
| `conversation_note` | `por_agente` | boolean NOT NULL DEFAULT false | `true` solo si la escribió el cerebro; `author_user_id` queda `null` |

Sin cambios en `contact`, `lead` ni `pipeline_stage`: la cotización va en la
ficha (jsonb libre) y las etapas se crean como datos desde la pantalla
Pipeline.

## Bandera

`src/server/tienda/flag.ts`, copia del patrón de `src/server/agenda/flag.ts`:

- `tiendaEnabled()` lee `process.env.TIENDA` con los mismos valores
  encendidos.
- `tiendaDisabledResponse()` → 404 sin cuerpo.
- `TIENDA: z.string().optional()` en `src/lib/env.ts`, documentada en
  `.env.example`.

## Catálogo de herramientas

`src/lib/agent-roles.ts` sigue puro, sin leer el entorno:

- `ClaveHerramienta` gana `"inventario" | "cotizar"`.
- `Herramienta` gana `tienda?: true`.
- Dos entradas nuevas:
  - `inventario`, «Consultar inventario»: «Busca productos en la tienda y
    dice si hay existencia. Da el número exacto solo si el cliente pide una
    cantidad.»
  - `cotizar`, «Cotizar»: «Arma el borrador de una cotización con enlace de
    compra y se lo pasa a una persona para que lo apruebe. Nunca le manda el
    enlace al cliente.»
- `herramientasEfectivas(tools, { tienda = false } = {})` descarta las
  `tienda` cuando la opción va apagada, también cuando `tools` es `null`.

Callers que pasan `{ tienda: tiendaEnabled() }`:

- `src/server/bot/profile.ts` (lo que viaja al cerebro).
- `src/app/api/agent/profile/route.ts` (GET y PATCH).
- `src/server/bot/stage.ts` no lo necesita (solo pregunta por `etapa`).

UI: `src/components/agent/agent-client.tsx` filtra igual que con `agenda`
(`!h.tienda || tiendaEnabled`), con la prop llegando desde la página.

## API del bot (contrato, aditivo)

| Método | Ruta | Auth | Cuerpo | Respuestas |
|---|---|---|---|---|
| POST | `/api/bot/notes` | `requireBotKey` | `{ conversationId: string, texto: string (1–4096) }` | 201 `{ nota: NotaDto }` · 401 · 404 (bandera apagada o conversación inexistente) · 409 `herramienta_apagada` · 409 `ai_paused` · 409 `no_org` · 422 |

Implementación:

- Ruta `src/app/api/bot/notes/route.ts`.
- Lógica en `src/server/bot/notas.ts`: comprueba bandera, `cotizar` encendida
  en el perfil, conversación de la organización y no pausada (misma lectura
  que `stage.ts`).
- Delega en una función nueva de `src/server/notas.ts`,
  `crearNotaDelAgente(organizationId, conversationId, texto)`, que inserta con
  `por_agente = true` y publica `note.new`. No se duplica la inserción.

`NotaDto` gana `porAgente: boolean`. `aDto` lo llena. `puedeBorrarNota` no
cambia: sin autor, solo quien configura.

Enmiendas de contrato:

- `docs/openapi.json`: la ruta nueva, y `inventario` y `cotizar` en el enum de
  `profile.tools`, marcadas como «solo con `TIENDA`».
- `specs/050-notas-internas/spec.md`: nota de enmienda en D5 apuntando aquí.
- `specs/001-vocero-core/contracts/sse.md`: `note.new` puede traer
  `porAgente: true`.

## Interfaz

`src/components/inbox/message-thread.tsx`: si `nota.porAgente`, el pie dice
«Agente» en lugar del nombre. Nada más cambia en la Bandeja.

## Pruebas

**Unitarias** (`tests/unit/cotizar-tienda.test.ts`):

- `herramientasEfectivas`:
  - con y sin `tienda`;
  - con `tools` en `null` y con claves guardadas;
  - `escalar` siempre presente.
- `parseTiendaFlag`.
- Guardarraíl actualizado en `tests/unit/notas-internas.test.ts`:
  - `bot/` se vigila con una excepción: `src/server/bot/notas.ts`;
  - ese archivo no importa `listarNotas`.

**Arnés** `scripts/e2e-notas-del-agente.mjs`, contra el wa-mock, cubriendo
AC1–AC7:

- bandera apagada → 404 y herramientas ausentes;
- bandera encendida → 201;
- la nota se ve en vivo con «Agente»;
- wa-mock sin envíos, lista sin cambios;
- 409 `herramienta_apagada` y 409 `ai_paused`;
- 401, 404 y 422;
- borrar: 403 para un miembro, 204 para quien configura.

**Guion** `tests/e2e/us-notas-del-agente.md`.

**Recorrido manual** del lado del cerebro: [quickstart.md](quickstart.md).

## Fuera de este repo

**`nea-agent` (fork)**: herramientas, flujo y variables según «Lo que hace el
cerebro» en la spec.

**Storefront e-centinela**: página de aviso de privacidad con los encargados.
Sin otro cambio: `handleShopifyRoutes` ya redirige `/cart/<variante>:<cantidad>`
al checkout.
