import { afterEach, describe, expect, it } from "vitest";
import { CLAVES_HERRAMIENTA, HERRAMIENTAS, herramientasEfectivas } from "@/lib/agent-roles";
import { parseTiendaFlag, tiendaEnabled } from "@/server/tienda/flag";

/** 067 — Inventario y cotizar existen solo con la bandera `TIENDA`. */
describe("la bandera TIENDA", () => {
  const antes = process.env.TIENDA;
  afterEach(() => {
    if (antes === undefined) delete process.env.TIENDA;
    else process.env.TIENDA = antes;
  });

  it("acepta los mismos valores que AGENDA y nada más", () => {
    for (const v of ["on", "1", "true", "sí", "si", "yes", " ON "]) expect(parseTiendaFlag(v)).toBe(true);
    for (const v of [undefined, "", "off", "0", "false", "tienda"]) expect(parseTiendaFlag(v)).toBe(false);
  });

  it("se lee del entorno", () => {
    delete process.env.TIENDA;
    expect(tiendaEnabled()).toBe(false);
    process.env.TIENDA = "on";
    expect(tiendaEnabled()).toBe(true);
  });
});

describe("las herramientas de la tienda", () => {
  it("son inventario y cotizar, marcadas", () => {
    expect(HERRAMIENTAS.filter((h) => h.tienda).map((h) => h.clave)).toEqual(["inventario", "cotizar"]);
  });

  it("sin la bandera no existen, ni con null ni guardadas", () => {
    const sinTienda = CLAVES_HERRAMIENTA.filter((c) => c !== "inventario" && c !== "cotizar");
    expect(herramientasEfectivas(null)).toEqual(sinTienda);
    expect(herramientasEfectivas(["cotizar", "inventario", "ficha"])).toEqual(["ficha", "escalar"]);
  });

  it("con la bandera, null las enciende y una lista las respeta", () => {
    expect(herramientasEfectivas(null, { tienda: true })).toEqual([...CLAVES_HERRAMIENTA]);
    expect(herramientasEfectivas(["cotizar"], { tienda: true })).toEqual(["cotizar", "escalar"]);
    expect(herramientasEfectivas([], { tienda: true })).toEqual(["escalar"]);
  });
});
