/**
 * Chat de cliente de pruebas (spec 067): escribe o manda notas de voz como si
 * fueras un cliente de WhatsApp, sin WhatsApp.
 *
 * Lo que escribes entra al CRM por el wa-mock (/api/dev/wa-mock/inbound), el
 * CRM se lo despacha al cerebro (Nea) y lo que el cerebro contesta se lee de
 * la bandeja de salida del wa-mock. Una nota de voz se convierte con ffmpeg a
 * Ogg/Opus (lo que manda WhatsApp), se sube al wa-mock y entra como audio con
 * `voice: true`: el cerebro la descarga y la transcribe igual que en
 * producción. Nada sale a WhatsApp real.
 *
 * Requiere: el CRM local con WA_MOCK_ENABLED=true, un cerebro conectado
 * (BRAIN_DISPATCH_URL) y ffmpeg para las notas de voz.
 *
 * Uso: node --env-file=.env scripts/chat-cliente/server.mjs  → http://localhost:4000
 *
 * Variables: APP_BASE_URL (el CRM), BOT_API_KEY, E2E_EMAIL / E2E_PASSWORD
 * (la dueña de la base de pruebas), CHAT_PHONE_NUMBER_ID, CHAT_PORT.
 *
 * «Reiniciar» reactiva la IA en el CRM y manda `/reset` para que el cerebro
 * olvide la conversación: con Nea, el teléfono tiene que estar en su
 * TESTER_WA_IDS. «Nuevo cliente» empieza limpio con otro teléfono.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const CRM = process.env.APP_BASE_URL ?? "http://localhost:3000";
const PORT = Number(process.env.CHAT_PORT ?? 4000);
const PN = process.env.CHAT_PHONE_NUMBER_ID ?? "PN-DEMO-067";
const EMAIL = process.env.E2E_EMAIL ?? "e2e-notas@vocero.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "password-e2e-notas";
const BOT_KEY = process.env.BOT_API_KEY ?? "";
const TOKEN = "tok-chat-cliente";
const HTML = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"));
const MAX_AUDIO = 16 * 1024 * 1024; // el límite de adjuntos de WhatsApp
const exec = promisify(execFile);

let cookie = "";
async function crm(path, { method = "GET", body, bot = false } = {}) {
  const headers = { "content-type": "application/json", origin: CRM, ...(bot ? { "x-api-key": BOT_KEY } : { cookie }) };
  const r = await fetch(`${CRM}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  const text = await r.text();
  try {
    return { status: r.status, json: JSON.parse(text) };
  } catch {
    return { status: r.status, json: null };
  }
}

/** Entra como la dueña, apunta la instancia al número del mock y enciende el agente. */
async function preparar() {
  const login = await crm("/api/auth/sign-in/email", { method: "POST", body: { email: EMAIL, password: PASSWORD } });
  if (login.status !== 200) throw new Error(`login ${login.status}`);
  await crm("/api/settings/whatsapp", { method: "PUT", body: { wabaId: "WABA-CHAT", phoneNumberId: PN, token: TOKEN } });
  const on = await crm("/api/agent/profile", { method: "PUT", body: { enabled: true } });
  if (on.status !== 200) throw new Error(`no pude encender el agente: ${JSON.stringify(on.json)}`);
}

/** Cualquier audio (webm del navegador, m4a de Notas de voz…) → Ogg/Opus mono, como WhatsApp. */
async function aOggOpus(bytes) {
  const dir = await mkdtemp(join(tmpdir(), "chat-cliente-"));
  try {
    await writeFile(join(dir, "entrada"), bytes);
    await exec("ffmpeg", ["-loglevel", "error", "-y", "-i", join(dir, "entrada"), "-c:a", "libopus", "-b:a", "24k", "-ar", "16000", "-ac", "1", join(dir, "nota.ogg")]);
    return await readFile(join(dir, "nota.ogg"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function subirAlMock(ogg) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "audio/ogg; codecs=opus");
  form.append("file", new Blob([ogg], { type: "audio/ogg" }), "nota-de-voz.ogg");
  const r = await fetch(`${CRM}/api/dev/wa-mock/graph/${PN}/media`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error(`el wa-mock no aceptó el audio (${r.status})`);
  return j.id;
}

const ultimos10 = (s) => String(s ?? "").replace(/\D/g, "").slice(-10);
function textoDe(e) {
  const b = e.body ?? {};
  if (b.text?.body) return b.text.body;
  if (b.interactive) return `[botones] ${b.interactive.body?.text ?? ""}`;
  if (b.template) return `[plantilla ${b.template.name}]`;
  return `[${e.type}]`;
}

async function cuerpoCrudo(req, max) {
  const partes = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > max) throw new Error("audio demasiado grande");
    partes.push(c);
  }
  return Buffer.concat(partes);
}

createServer(async (req, res) => {
  const json = (code, data) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(HTML);
    }
    if (req.method === "POST" && url.pathname === "/api/enviar") {
      const { telefono, nombre, texto } = JSON.parse((await cuerpoCrudo(req, 64 * 1024)).toString() || "{}");
      const r = await crm("/api/dev/wa-mock/inbound", { method: "POST", body: { phoneNumberId: PN, from: telefono, name: nombre, text: texto } });
      return json(r.status, r.json ?? {});
    }
    if (req.method === "POST" && url.pathname === "/api/audio") {
      const ogg = await aOggOpus(await cuerpoCrudo(req, MAX_AUDIO));
      const mediaId = await subirAlMock(ogg);
      const r = await crm("/api/dev/wa-mock/inbound", {
        method: "POST",
        body: {
          phoneNumberId: PN, from: url.searchParams.get("telefono"), name: url.searchParams.get("nombre") ?? undefined,
          type: "audio", mediaId, mimeType: "audio/ogg; codecs=opus", voice: true,
        },
      });
      return json(r.status, { mediaId, bytes: ogg.byteLength });
    }
    if (req.method === "GET" && url.pathname === "/api/respuestas") {
      const tel = ultimos10(url.searchParams.get("telefono"));
      const desde = Number(url.searchParams.get("desde") ?? 0);
      const { json: o } = await crm("/api/dev/wa-mock/outbox");
      const mias = (o?.outbox ?? []).filter((e) => ultimos10(e.to || e.recipient) === tel && e.n > desde);
      return json(200, { respuestas: mias.map((e) => ({ n: e.n, at: e.at, texto: textoDe(e) })) });
    }
    if (req.method === "POST" && url.pathname === "/api/reiniciar") {
      const { telefono } = JSON.parse((await cuerpoCrudo(req, 64 * 1024)).toString() || "{}");
      const convs = (await crm("/api/conversations")).json?.conversations ?? [];
      const conv = convs.find((c) => ultimos10(c.contact.phone) === ultimos10(telefono));
      if (!conv) return json(200, { reiniciada: false });
      // 1) El CRM reactiva la IA (en handoff no le despacha nada al cerebro).
      const r = await crm("/api/bot/reset", { method: "POST", body: { conversationId: conv.id }, bot: true });
      // 2) `/reset` como el cliente: el cerebro olvida su historial de esta
      //    conversación. Nea solo lo acepta de los números en TESTER_WA_IDS.
      await crm("/api/dev/wa-mock/inbound", { method: "POST", body: { phoneNumberId: PN, from: telefono, text: "/reset" } });
      return json(r.status, { reiniciada: r.status === 200 });
    }
    json(404, { error: "no existe" });
  } catch (e) {
    json(500, { error: String(e?.message ?? e) });
  }
}).listen(PORT, async () => {
  try {
    await preparar();
    console.log(`Chat de cliente en http://localhost:${PORT} (agente encendido, número ${PN})`);
  } catch (e) {
    console.log(`Chat en http://localhost:${PORT}, pero falló la preparación: ${e.message}`);
  }
});
