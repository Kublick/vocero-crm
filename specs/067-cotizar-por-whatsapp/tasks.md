# Tasks: Inventario y cotizaciones por WhatsApp

**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Recorrido**: [quickstart.md](quickstart.md)

## Este repo

- [ ] T001 `src/server/tienda/flag.ts` (`parseTiendaFlag`, `tiendaEnabled`, `tiendaDisabledResponse`) + `TIENDA` en `src/lib/env.ts` y `.env.example`
- [ ] T002 `por_agente` en `conversationNote` (`schema.ts`), `pnpm db:generate` → `0027`
- [ ] T003 `agent-roles.ts`: claves `inventario` y `cotizar`, `tienda?: true`, opción `{ tienda }` en `herramientasEfectivas`
- [ ] T004 Pasar `{ tienda: tiendaEnabled() }` en `src/server/bot/profile.ts` y `src/app/api/agent/profile/route.ts`; filtro en `agent-client.tsx`
- [ ] T005 `crearNotaDelAgente` en `src/server/notas.ts`; `porAgente` en `NotaDto` y `aDto`
- [ ] T006 `src/server/bot/notas.ts` + `src/app/api/bot/notes/route.ts` (bandera, herramienta, pausa, organización, validación)
- [ ] T007 «Agente» en el pie de la nota en `message-thread.tsx`
- [ ] T008 `tests/unit/cotizar-tienda.test.ts` y guardarraíl de `notas-internas.test.ts` con la excepción de `bot/notas.ts`
- [ ] T009 `tests/e2e/us-notas-del-agente.md` + `scripts/e2e-notas-del-agente.mjs`
- [ ] T010 `docs/openapi.json` (ruta y claves), enmienda en 050 D5 y en `contracts/sse.md`
- [ ] T011 Gates con `TIENDA` apagada y encendida, capturas de la nota del agente en claro y oscuro
- [ ] T012 AGENTS.md (mapa: bandera `TIENDA`), `specs/README.md`, bitácora y PR

## Fuera de este repo (seguimiento)

- [ ] N001 Fork de `nea-agent`: confirmar que `fix/modelo-que-oye` está en main y ubicar dónde viven las herramientas
- [ ] N002 `inventario` contra la Storefront API (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN`)
- [ ] N003 `cotizar`: confirmación, CFDI, re-consulta de existencias, enlace (`CART_LINK_ORIGIN`), ficha, nota, etapa, handoff
- [ ] N004 `STT_PROVIDER=gemini|modulate` + `MODULATE_API_KEY`, `custom_terms` con las marcas de la tienda, mensaje «¿me lo escribes?» si falla
- [ ] N005 Desplegar el fork en el proyecto de Coolify del CRM (`http://nea:8000`)
- [ ] S001 Storefront: página de aviso de privacidad con los encargados
- [ ] S002 Verificar el scope `unauthenticated_read_product_inventory` del token
- [ ] S003 Preguntar a Modulate por la retención de audio; comparar con Gemini en 20–30 audios reales
