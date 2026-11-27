/**
 * Self-test E2E — 067: el cerebro deja una nota interna (borrador de
 * cotización) con `POST /api/bot/notes`.
 * Guion: tests/e2e/us-notas-del-agente.md.
 *
 * Se corre DOS veces, porque la bandera se lee al arrancar la app:
 * - con `TIENDA` apagada: AC1 (no existe nada de la tienda);
 * - con `TIENDA=on`: AC2–AC7.
 * El guion detecta cuál es por `GET /api/agent/profile` → `tiendaEnabled`.
 *
 * Requiere la app viva con WA_MOCK_ENABLED=true, META_GRAPH_BASE_URL → wa-mock
 * y `BOT_API_KEY` (la misma en este entorno). `E2E_EMAIL` / `E2E_PASSWORD`
 * para entrar con la dueña de una base que ya tenga organización (si no, se
 * crea).
 *
 * Uso: node --env-file=<env> scripts/e2e-notas-del-agente.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "e2e-notas@vocero.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "password-e2e-notas";
const KEY = process.env.BOT_API_KEY ?? "";
const S = Date.now().toString(36);
const PN = `PN-COT-${S}`;

let failures = 0;
let checks = 0;
function ok(name, cond, extra = "") {
  checks++;
  if (cond) console.log(`  OK  ${name}`);
  else {
    failures++;
    console.log(`  FALLA  ${name}${extra ? ` — ${extra}` : ""}`);
  }
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasta(fn, ms = 15000) {
  const fin = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > fin) return v;
    await espera(250);
  }
}

mkdirSync(".tmp", { recursive: true });
const browser = await chromium.launch();
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const apiA = (p, init = {}) => ctxA.request.fetch(`${BASE}${p}`, { ...init, headers: { origin: BASE, ...(init.headers ?? {}) } });
const bot = (p, data, key = KEY) =>
  ctxA.request.fetch(`${BASE}${p}`, { method: "POST", data, headers: key ? { "x-api-key": key } : {} });

try {
  console.log("== Preparación ==");
  let r = await apiA("/api/auth/sign-up/email", { method: "POST", data: { email: EMAIL, password: PASSWORD, name: "Dueña" } });
  if (!r.ok()) r = await apiA("/api/auth/sign-in/email", { method: "POST", data: { email: EMAIL, password: PASSWORD } });
  ok("login de la dueña", r.ok());
  await apiA("/api/settings/whatsapp", { method: "PUT", data: { wabaId: "WABA-COT", phoneNumberId: PN, token: "tok-cot" } });

  const NOMBRE = `Cliente Cotiza ${S}`;
  const rnd = () => Math.floor(1000 + Math.random() * 8999);
  await apiA("/api/dev/wa-mock/inbound", { method: "POST", data: { phoneNumberId: PN, from: `52155552${rnd()}`, name: NOMBRE, text: `necesito 12 contactores ${S}` } });
  const convDe = async (nombre) =>
    ((await (await apiA("/api/conversations")).json()).conversations ?? []).find((c) => c.contact.name === nombre) ?? null;
  const conv = await hasta(() => convDe(NOMBRE));
  ok("la conversación existe", Boolean(conv));
  await apiA(`/api/conversations/${conv.id}`, { method: "PATCH", data: { markRead: true } });

  const perfil = await (await apiA("/api/agent/profile")).json();
  const tienda = perfil.tiendaEnabled === true;
  console.log(`\n(La app corre con TIENDA ${tienda ? "encendida" : "apagada"}.)`);

  if (!tienda) {
    console.log("\n== AC1 · bandera apagada ==");
    ok("el perfil del CRM no trae inventario ni cotizar", !perfil.profile.tools.some((t) => t === "inventario" || t === "cotizar"));
    const delBot = await (await ctxA.request.fetch(`${BASE}/api/bot/profile`, { headers: { "x-api-key": KEY } })).json();
    ok("GET /api/bot/profile tampoco", !delBot.profile.tools.some((t) => t === "inventario" || t === "cotizar"), JSON.stringify(delBot.profile?.tools));
    r = await bot("/api/bot/notes", { conversationId: conv.id, texto: "x" });
    ok("POST /api/bot/notes → 404", r.status() === 404, String(r.status()));
    const page = await ctxA.newPage();
    await page.goto(`${BASE}/agent`);
    await page.getByText("Pasar a una persona").first().waitFor({ timeout: 15000 }).catch(() => {});
    ok("la pantalla Agente cargó (muestra «Pasar a una persona»)", (await page.getByText("Pasar a una persona").count()) > 0);
    ok("la pantalla Agente no ofrece «Cotizar» ni «Consultar inventario»", (await page.getByText("Consultar inventario").count()) === 0 && (await page.getByText("Cotizar", { exact: true }).count()) === 0);
  } else {
    console.log("\n== AC2 · bandera encendida ==");
    r = await apiA("/api/agent/profile", { method: "PUT", data: { tools: ["ficha", "etapa", "inventario", "cotizar"] } });
    ok("encender inventario y cotizar persiste", r.ok() && (await (await apiA("/api/agent/profile")).json()).profile.tools.includes("cotizar"));
    const delBot = await (await ctxA.request.fetch(`${BASE}/api/bot/profile`, { headers: { "x-api-key": KEY } })).json();
    ok("GET /api/bot/profile las entrega", ["inventario", "cotizar"].every((t) => delBot.profile.tools.includes(t)), JSON.stringify(delBot.profile?.tools));
    const pageA = await ctxA.newPage();
    await pageA.goto(`${BASE}/agent`);
    await pageA.getByText("Consultar inventario").first().waitFor({ timeout: 15000 }).catch(() => {});
    ok("la pantalla Agente las ofrece", (await pageA.getByText("Consultar inventario").count()) === 1);

    console.log("\n== AC3 · nota del cerebro ==");
    await pageA.goto(`${BASE}/inbox`);
    await pageA.getByText(NOMBRE).first().click();
    await pageA.getByText(`necesito 12 contactores ${S}`).first().waitFor();
    const antes = await convDe(NOMBRE);
    const outbox = async () => ((await (await apiA("/api/dev/wa-mock/outbox")).json()).outbox ?? []).length;
    const enviadosAntes = await outbox();
    const TEXTO = `Cotización pendiente de aprobar (cot_${S})\n• 12 × Contactor ABB A26-30-10 — $1,840.00 c/u — en el enlace`;
    r = await bot("/api/bot/notes", { conversationId: conv.id, texto: TEXTO });
    const cuerpo = await r.json().catch(() => ({}));
    ok("POST /api/bot/notes → 201", r.status() === 201, String(r.status()));
    ok("la nota es del agente y sin autor", cuerpo.nota?.porAgente === true && cuerpo.nota?.autor === null);
    const nota = pageA.locator("[data-nota-id]").filter({ hasText: `cot_${S}` });
    await nota.waitFor({ timeout: 10000 }).catch(() => {});
    ok("aparece en vivo en la Bandeja", (await nota.count()) === 1);
    ok("firmada «Nota interna · Agente»", /Nota interna[\s\S]*Agente/.test(await nota.innerText().catch(() => "")));
    await espera(800);
    ok("NINGÚN mensaje salió al wa-mock", (await outbox()) === enviadosAntes);
    const despues = await convDe(NOMBRE);
    ok("la lista no cambió (último mensaje y hora)", despues.lastMessage?.text === antes.lastMessage?.text && despues.lastMessageAt === antes.lastMessageAt);
    ok("sin no leídos nuevos", despues.unreadCount === antes.unreadCount);
    await pageA.screenshot({ path: ".tmp/e2e-067-nota-agente.png" });

    console.log("\n== AC6 · validación ==");
    r = await bot("/api/bot/notes", { conversationId: conv.id, texto: "x" }, "");
    ok("sin llave → 401", r.status() === 401, String(r.status()));
    r = await bot("/api/bot/notes", { conversationId: `cv_no_existe_${S}`, texto: "x" });
    ok("conversación inexistente → 404", r.status() === 404);
    r = await bot("/api/bot/notes", { conversationId: conv.id, texto: "   " });
    ok("texto vacío → 422", r.status() === 422);
    r = await bot("/api/bot/notes", { conversationId: conv.id, texto: "x".repeat(4097) });
    ok("más de 4 096 caracteres → 422", r.status() === 422);

    console.log("\n== AC7 · borrar ==");
    const mEmail = `miembro-cot-${S}@vocero.test`;
    await apiA("/api/settings/team", { method: "POST", data: { name: "Laura Ventas", email: mEmail, password: "password-miembro-cot" } });
    const ctxB = await browser.newContext();
    const apiB = (p, init = {}) => ctxB.request.fetch(`${BASE}${p}`, { ...init, headers: { origin: BASE, ...(init.headers ?? {}) } });
    await apiB("/api/auth/sign-in/email", { method: "POST", data: { email: mEmail, password: "password-miembro-cot" } });
    const notaId = cuerpo.nota?.id;
    r = await apiB(`/api/conversations/${conv.id}/notes/${notaId}`, { method: "DELETE" });
    ok("un miembro no la borra → 403", r.status() === 403, String(r.status()));
    r = await apiA(`/api/conversations/${conv.id}/notes/${notaId}`, { method: "DELETE" });
    ok("quien configura sí → 204", r.status() === 204, String(r.status()));
    await ctxB.close();

    console.log("\n== AC4 · herramienta apagada ==");
    await apiA("/api/agent/profile", { method: "PUT", data: { tools: ["ficha", "etapa", "inventario"] } });
    r = await bot("/api/bot/notes", { conversationId: conv.id, texto: "x" });
    ok("con cotizar apagada → 409 herramienta_apagada", r.status() === 409 && (await r.json()).error?.code === "herramienta_apagada");
    // 067 — Monto del trato con la cotización: misma etapa, solo el monto.
    const etapaActual = (await (await ctxA.request.fetch(`${BASE}/api/bot/context?conversationId=${conv.id}`, { headers: { "x-api-key": KEY } })).json()).lead?.stageName;
    r = await apiA("/api/agent/profile", { method: "PUT", data: { tools: ["ficha", "etapa", "inventario"] } });
    r = await bot("/api/bot/stage", { conversationId: conv.id, stage: etapaActual, amountCents: 3351, currency: "USD" });
    ok("monto con cotizar apagada → 409 herramienta_apagada", r.status() === 409 && (await r.json()).error?.code === "herramienta_apagada");
    await apiA("/api/agent/profile", { method: "PUT", data: { tools: ["ficha", "etapa", "inventario", "cotizar"] } });
    r = await bot("/api/bot/stage", { conversationId: conv.id, stage: etapaActual, amountCents: 3351 });
    ok("monto sin moneda → 422", r.status() === 422, String(r.status()));
    r = await bot("/api/bot/stage", { conversationId: conv.id, stage: etapaActual, amountCents: 3351, currency: "USD" });
    ok("monto con la etapa actual → 200", r.status() === 200, String(r.status()));
    const tarjeta = ((await (await apiA("/api/pipeline/board")).json()).leads ?? []).find((l) => l.conversationId === conv.id);
    ok("la tarjeta trae el monto y la moneda", tarjeta?.amountCents === 3351 && tarjeta?.currency === "USD", JSON.stringify(tarjeta && { a: tarjeta.amountCents, c: tarjeta.currency }));

    console.log("\n== AC5 · IA pausada ==");
    r = await bot("/api/bot/handoff", { conversationId: conv.id, reason: "cotizacion_pendiente" });
    ok("handoff del cerebro", r.ok(), String(r.status()));
    r = await bot("/api/bot/notes", { conversationId: conv.id, texto: "x" });
    ok("en handoff → 409 ai_paused", r.status() === 409 && (await r.json()).error?.code === "ai_paused");
  }
} finally {
  await browser.close();
}

console.log(`\n${checks - failures}/${checks} checks en verde`);
process.exit(failures > 0 ? 1 : 0);
