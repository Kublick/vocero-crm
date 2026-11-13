# 067 — Inventario y cotizaciones por WhatsApp (tienda Shopify)

**Feature Branch**: `feat/067-cotizar-por-whatsapp`

**Created**: 2026-11-13

**Status**: Especificada antes de escribir código. Implementada en el CRM; typecheck, lint, unitarias y build en verde; arnés E2E en verde con `TIENDA` apagada (7/7) y encendida (21/21). Falta la captura en oscuro y el recorrido con el cerebro (AC9).

**Input**: el negocio de material eléctrico industrial (e-centinela, Mexicali)
tiene su tienda en Shopify (`ecentinela.myshopify.com`, storefront Hydrogen
propio). Quiere que quien escribe por WhatsApp pueda preguntar por existencias
y pedir una cotización, también con notas de voz («gente en movimiento»), y
que el CRM registre qué se le ofreció a cada cliente. Las decisiones salen de
una sesión de preguntas con el dueño el 2026-11-13 (Q1–Q28, resumidas abajo
como D1–D16).

**Va con** un fork de `nea-agent` (el cerebro): las herramientas `inventario`
y `cotizar` se ejecutan ahí, y la transcripción también. Este repo solo
publica las claves de herramienta, una ruta para que el cerebro deje una nota
interna y la bandera que lo enciende. Ver «Lo que hace el cerebro».

**Carril**: ciclo completo (Principio VI): toca un **contrato publicado**
(`/api/bot/*`: ruta nueva y dos claves de herramienta nuevas en
`GET /api/bot/profile`) y el **modelo de datos** (columna aditiva en
`conversation_note`).

## Problema

Hoy el cerebro califica, agenda y escala, pero no sabe nada del catálogo. Un
comprador industrial pregunta «¿tienen contactor ABB A26-30-10, necesito 12?»
y la respuesta depende de que una persona busque en Shopify, arme el carrito y
lo mande. Además, lo que se cotizó no queda en ningún sitio del CRM: ni en la
ficha, ni en el hilo, ni en el pipeline.

## Decisiones

**D1 — El cerebro habla con Shopify; el CRM no.** Las llamadas a la
Storefront API viven en el fork de Nea (Q1, Q17). El núcleo del CRM no gana
ningún tercero (Principio II). Lo que el CRM gana es lo que necesita para
**registrar** la cotización y dejarla a una persona.

**D2 — Módulo opcional tras la bandera `TIENDA`.** Igual que `AGENDA` (015):
apagada por defecto. Con `TIENDA` apagada, las herramientas `inventario` y
`cotizar` no aparecen en la pantalla Agente ni viajan en
`GET /api/bot/profile`, y `POST /api/bot/notes` responde 404. La migración se
aplica siempre.

**D3 — Dos claves de herramienta nuevas: `inventario` y `cotizar`.** Contrato
con el cerebro, no se renombran. Se encienden y apagan desde el perfil del
agente como las demás. El CRM no puede imponer `inventario` (no pasa por él):
lo respeta el cerebro leyendo `tools`. `cotizar` sí se impone en la ruta de
notas (D5).

**D4 — Una persona aprueba TODA cotización** (Q3). El cerebro nunca le manda
al cliente un enlace de compra. Arma un borrador, lo deja en el CRM y escala.
La persona revisa, manda el enlace desde la Bandeja, captura el monto del
trato y sigue la conversación (Q8, Q9).

**D5 — El cerebro puede dejar una nota interna: `POST /api/bot/notes`.**
Enmienda la D5 de la spec 050 («no viaja por `/api/bot/*`»), solo en
escritura:

- El cerebro **escribe** notas; **no las lee**. No hay `GET`, y el despacho
  sigue sin incluir notas.
- Requiere `TIENDA` encendida y la herramienta `cotizar` encendida
  (`409 herramienta_apagada` si no).
- Con la IA pausada en la conversación (handoff o `ai_enabled` falso):
  `409 ai_paused`, igual que `/api/bot/stage`.
- La nota se publica por SSE (`note.new`) como cualquier otra.

**D6 — La nota del cerebro dice que es del agente.** Columna nueva
`conversation_note.por_agente` (boolean, default `false`). En el hilo se ve
«Nota interna · Agente · hora», no «Alguien del equipo», que es lo que hoy se
muestra cuando la cuenta del autor se borró. Solo quien configura puede
borrarla (no tiene autor).

**D7 — La cotización se registra dos veces** (Q7):

- **Nota interna** en el hilo: lo que la persona lee para aprobar.
- **`ficha.cotizaciones`**, una lista en la ficha del contacto (por la ruta
  existente `PUT /api/bot/ficha`): historial estructurado que el cerebro
  vuelve a leer en turnos siguientes. Una lista y no un campo: el CRM tiene un
  trato por contacto (`lead_contact_uq`), y la segunda cotización de un
  cliente que vuelve no debe pisar la primera.

**D8 — Dos etapas nuevas en el pipeline** (Q12): «Cotización pendiente» y
«Cotización enviada», en ese orden y abiertas. Son datos (se crean con el
administrador de etapas de la pantalla Pipeline), no código. El cerebro mueve a «Cotización pendiente» con
`etapa` al dejar el borrador. Lo demás lo mueve la persona. Ganar o perder
sigue siendo de una persona (038; Q6).

**D9 — El monto del trato lo captura la persona** (Q8). Ninguna ruta del bot
escribe `amount_cents` y esta spec no agrega una.

**D10 — Precios en la moneda de la tienda, IVA incluido** (Q13). El checkout
de Shopify cobra siempre la moneda de la tienda; las otras monedas del sitio
son solo de visualización. La cotización dice «precio vigente al momento del
pago» (Q22): un enlace de carrito cobra el precio del momento.

**D11 — Qué va en el enlace y qué va a la persona** (Q2, Q5, Q10, Q11):

- Con existencia suficiente: entra al enlace de carrito
  (`<origen>/cart/<variante>:<cantidad>,…`).
- Sin existencia suficiente o «Precio a cotizar»: **no** entra al enlace. Va
  marcado en el borrador, sin precio inventado.
- Si todo queda fuera, no hay enlace: el borrador es solo la lista marcada.

**D12 — Existencias: número exacto solo ante una cantidad** (Q4). Ante
«¿tienen X?», el cerebro dice si hay o no. Ante «necesito 50», dice si alcanza
y, si no, cuántas hay.

**D13 — Antes del borrador, el cerebro repite la lista y espera un «sí»**
(Q16), siempre, no solo con audio. Con varias coincidencias de búsqueda,
ofrece las 3 primeras y pide elegir (Q14).

**D14 — CFDI: solo sí/no** (Q23). El cerebro pregunta si requiere factura y
lo anota. RFC, razón social y uso de CFDI los pide la persona.

**D15 — Notas de voz** (Q15, Q20, Q21, Q25, Q26):

- La transcripción vive en el cerebro (044). El fork de Nea gana un segundo
  proveedor, Modulate, elegido por variable (`STT_PROVIDER=gemini|modulate`).
- Si la transcripción falla, el cerebro le pide al cliente que lo escriba. No
  hay respaldo automático al otro proveedor.
- La transcripción entra al borrador de la nota. La Bandeja **no** muestra
  transcripciones (044 lo dejó fuera y sigue fuera).
- El aviso de privacidad de e-centinela.com lista a quienes procesan los
  mensajes (Meta, OpenRouter y Google, y Modulate si está encendido).

**D16 — Pruebas manuales por la línea de pruebas** (Q24). El dueño prueba
desde su propio WhatsApp en la allowlist del cerebro, con `/reset` para
empezar de nuevo. Un «playground» dentro del CRM queda para después.

## Lo que hace el cerebro (nea-agent, fuera de este repo)

Contrato de comportamiento que el fork de Nea debe cumplir. Se escribe aquí
porque define lo que la persona verá en el CRM.

**Variables nuevas del cerebro**:

| Variable | Qué |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `ecentinela.myshopify.com` |
| `SHOPIFY_STOREFRONT_TOKEN` | El token privado de Storefront del storefront (Q18: se reutiliza; rotarlo rompe los dos). Necesita el scope `unauthenticated_read_product_inventory` |
| `CART_LINK_ORIGIN` | Origen del enlace de carrito: `https://ecentinela.myshopify.com` hasta el lanzamiento, `https://e-centinela.com` después (Q19) |
| `STT_PROVIDER` | `gemini` (por defecto, por el proxy `/api/bot/llm`) o `modulate` |
| `MODULATE_API_KEY` | Solo con `STT_PROVIDER=modulate` |

**`inventario`** — búsqueda en la Storefront API (`search` / `products`), con
`availableForSale`, `quantityAvailable`, precio y la etiqueta «Precio a
cotizar» de la tienda. Respeta D12 y D13.

**`cotizar`**, en este orden:

1. Lista confirmada por el cliente (D13) y la respuesta de CFDI (D14).
2. Vuelve a consultar existencias en ese momento: la lista se armó turnos
   atrás.
3. Arma el enlace con lo que tiene existencia (D11).
4. `PUT /api/bot/ficha` agregando una entrada a `cotizaciones` (lee la ficha
   actual del contexto y manda la lista completa; la ficha mezcla por clave).
5. `POST /api/bot/notes` con el borrador (formato abajo).
6. `POST /api/bot/stage` a «Cotización pendiente», si `etapa` está encendida.
7. `POST /api/bot/handoff` con `reason: "cotizacion_pendiente"`.
8. Le dice al cliente que una persona confirma su cotización en breve. No
   manda el enlace.

**Entrada de `ficha.cotizaciones`**:

```json
{
  "id": "cot_<nanoid>",
  "creada": "2026-11-13T18:04:00Z",
  "moneda": "MXN",
  "lineas": [
    {
      "varianteId": "gid://shopify/ProductVariant/123",
      "sku": "A26-30-10",
      "titulo": "Contactor ABB A26-30-10",
      "cantidad": 12,
      "precioUnitario": "1840.00",
      "enEnlace": true
    },
    {
      "varianteId": "gid://shopify/ProductVariant/456",
      "sku": "TX-500",
      "titulo": "Transformador 500 VA",
      "cantidad": 1,
      "precioUnitario": null,
      "enEnlace": false,
      "motivo": "precio_a_cotizar"
    }
  ],
  "totalEnlace": "22080.00",
  "url": "https://ecentinela.myshopify.com/cart/123:12",
  "cfdi": true,
  "origen": "audio"
}
```

`motivo` ∈ `sin_existencia` | `precio_a_cotizar`. `origen` ∈ `texto` |
`audio`. Montos como cadena decimal, como `MoneyV2.amount` de Shopify.

**Texto de la nota** (lo que la persona lee):

```
Cotización pendiente de aprobar (cot_…)
• 12 × Contactor ABB A26-30-10 — $1,840.00 c/u — en el enlace
• 1 × Transformador 500 VA — precio a cotizar — NO va en el enlace
Total del enlace: $22,080.00 MXN, IVA incluido
Enlace: https://…/cart/123:12
Requiere CFDI: sí
Pedido por audio: «necesito doce contactores ABB A26 30 10 y un transformador de 500»
```

**Notas de voz con Modulate**: `POST https://platform.modulate.ai/api/velma-2-stt-batch`
(multipart, header `X-API-Key`), el `.ogg` tal cual, `language=es`, y
`config={"custom_terms":[…]}` con las marcas y categorías de la tienda (Q26),
menos de 1000 términos. La transcripción viene en `text`.

## Criterios de aceptación (este repo)

- **AC1 — Bandera apagada.**
  - La pantalla Agente no muestra «Consultar inventario» ni «Cotizar».
  - `GET /api/bot/profile` no incluye `inventario` ni `cotizar` en `tools`,
    aunque el perfil las tenga guardadas o `tools` sea `null`.
  - `POST /api/bot/notes` → 404.
- **AC2 — Bandera encendida.**
  - La pantalla Agente muestra las dos herramientas con su descripción, y
    apagarlas o encenderlas persiste.
  - Con `tools` en `null`, las dos viajan encendidas.
- **AC3 — Nota del cerebro.** `POST /api/bot/notes` con `{ conversationId,
  texto }` y la llave del bot → 201 `{ nota }`.
  - La nota aparece en vivo en la Bandeja como «Nota interna · Agente».
  - **Ningún** mensaje sale al wa-mock; la lista, la ventana y los no leídos
    no cambian; no se despacha nada al cerebro (igual que AC2 de 050).
- **AC4 — Herramienta apagada.** Con `cotizar` apagada → 409
  `herramienta_apagada`.
- **AC5 — IA pausada.** En una conversación en handoff o con la IA apagada →
  409 `ai_paused`.
- **AC6 — Validación y organización.**
  - Sin llave → 401.
  - Conversación inexistente → 404.
  - Texto vacío o de más de 4 096 caracteres → 422.
- **AC7 — Borrar.** Una nota del agente la borra solo quien configura. Un
  miembro → 403.
- **AC8 — Guardarraíl.** La prueba de 050 sigue vigilando `dispatch`,
  `brains`, `analytics`, `lab`, `send.ts`, `ingest.ts` y `window.ts`. En
  `bot/`, solo `src/server/bot/notas.ts` puede mencionar las notas, y no
  exporta lectura.
- **AC9 — Recorrido completo (manual, línea de pruebas).** Sigue el
  [quickstart](quickstart.md): una cotización por texto y una por audio, con
  una línea sin existencia, terminan en nota + ficha + etapa + handoff, y el
  cliente no recibe enlace del agente.

## Qué NO se hace y por qué

- **Cotización formal (PDF, folio, vigencia, precio negociado)**: necesita
  Draft Orders de la Admin API y un token con más poder. Es la fase 2 si el
  volumen lo pide (Q2).
- **Ganar el trato al pagarse el pedido** (webhook `orders/paid`): choca con
  038 (ganar o perder es de una persona). Se revisa cuando cerrar a mano canse
  (Q6).
- **Ruta del bot para el monto**: lo captura la persona al aprobar (D9).
- **Botón «Aprobar y enviar»**: el handoff basta para empezar (Q8).
- **El cerebro lee notas**: solo escribe (D5).
- **Transcripción visible en la Bandeja** (D15).
- **Respaldo automático entre proveedores de transcripción** (Q25).
- **Personas del Laboratorio para cotizar**: primero pruebas manuales (D16).
- **Playground de pruebas en el CRM**: el despacho excluye las conversaciones
  de prueba; abrirlo es otra spec (D16).
- **Vigencia con precio fijo** (Q22).

## Pendiente (NEEDS CLARIFICATION — Principio VII)

| Qué | Por qué importa | Responsable |
|---|---|---|
| Estructura de herramientas de `nea-agent` | No está en esta máquina; define cómo se agregan `inventario` y `cotizar` | Quien implemente el fork |
| ¿`fix/modelo-que-oye` ya está en el `main` de Nea? | Sin eso, Gemini no oye (044) | Quien implemente el fork |
| ¿El token de Storefront tiene `unauthenticated_read_product_inventory`? | Sin el scope, `quantityAvailable` viene vacío y D12 no se cumple | Dueño de la tienda |
| Retención de audio en Modulate | Su documentación no lo dice; el aviso de privacidad depende de eso | Dueño, con Modulate |
| Calidad de Modulate con marcas en español | Decide el valor de `STT_PROVIDER` | Prueba con 20–30 audios reales |
| Texto del aviso de privacidad | Ley mexicana de datos personales | Dueño, con su abogado |
| ¿Esto sube a `kevinrivm/vocero-crm` o vive en un fork? | La bandera `TIENDA` está pensada para que viva en main sin molestar a nadie | Dueño |

## Constitution Check

| Principio | Cómo se cumple |
|---|---|
| I · Seguridad | El token de Shopify vive en el cerebro, no en el CRM. La llave del bot protege la ruta nueva |
| II · Soberanía | El núcleo no gana terceros (D1). Shopify y Modulate quedan del lado del cerebro |
| III · Multi-tenancy | `organization_id` por `resolveInstanceOrg()`; la conversación se comprueba de la organización antes de escribir |
| IV · Idempotencia | Crear una nota es un `INSERT`; un reintento del cerebro duplica la nota, y se acepta (es un registro visible, no un efecto hacia el cliente) |
| V · Hecho | Unitarias, guardarraíl, arnés E2E de la ruta y recorrido manual |
| VI · Specs | Ciclo completo: esta spec, `plan.md`, `tasks.md` y `quickstart.md` antes del código |
| VII · Trazabilidad | D1–D16, la tabla «Pendiente», enmienda a 050 D5 y a `docs/openapi.json` |
| VIII · Foco | Atender y convertir conversaciones de WhatsApp de un negocio |
| IX · En vivo | Arnés contra el wa-mock y recorrido real por la línea de pruebas |
| Sandbox | Una nota nunca llega a `send.ts`; las conversaciones de prueba no se despachan |
