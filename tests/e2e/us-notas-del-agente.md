# Guion E2E — Nota del agente para cotizar (067)

> Automatizado en `scripts/e2e-notas-del-agente.mjs`. Spec:
> [067](../../specs/067-cotizar-por-whatsapp/spec.md). El recorrido con el
> cerebro real (Shopify, audio) es manual: [quickstart](../../specs/067-cotizar-por-whatsapp/quickstart.md).

## Por qué

El cerebro arma el borrador de una cotización y una persona lo aprueba. Para
que la persona lo vea donde trabaja, el cerebro lo deja como nota interna en
el hilo. Todo esto existe solo con la bandera `TIENDA`.

## Cómo se corre

Dos veces, porque la bandera se lee al arrancar la app:

```bash
node --env-file=<env> scripts/e2e-notas-del-agente.mjs            # app sin TIENDA
node --env-file=<env> scripts/e2e-notas-del-agente.mjs            # app con TIENDA=on
```

La app tiene que estar viva con `WA_MOCK_ENABLED=true` y `BOT_API_KEY`. Con
`E2E_EMAIL` y `E2E_PASSWORD` se entra con la dueña de una base que ya tenga
organización.

## Camino verificado

**Con `TIENDA` apagada (AC1)**

- `GET /api/agent/profile` y `GET /api/bot/profile` no traen `inventario` ni
  `cotizar`.
- `POST /api/bot/notes` → 404.
- La pantalla Agente no ofrece «Consultar inventario» ni «Cotizar».

**Con `TIENDA=on`**

1. **Herramientas (AC2).** Encenderlas desde el perfil persiste, y el cerebro
   las recibe en `GET /api/bot/profile`. La pantalla Agente las muestra.
2. **Nota del cerebro (AC3).**
   - `POST /api/bot/notes` → 201, con `porAgente: true` y `autor: null`.
   - Aparece en vivo en la Bandeja como «Nota interna · Agente».
   - **Ningún mensaje** sale al wa-mock.
   - La lista no cambia: mismo último mensaje, misma hora, sin no leídos.
3. **Validación (AC6).** Sin llave 401; conversación inexistente 404; texto
   vacío o de más de 4 096 caracteres 422.
4. **Borrar (AC7).** Un miembro → 403; quien configura → 204.
5. **Herramienta apagada (AC4).** Sin `cotizar` → 409 `herramienta_apagada`.
6. **IA pausada (AC5).** Tras `POST /api/bot/handoff` → 409 `ai_paused`.

## Lo que este guion no cubre

AC8 (el guardarraíl) es una prueba unitaria. AC9 (el recorrido con el
cerebro real) es manual.
