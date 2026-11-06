"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth/client";
import { SETUP_CODE_HEADER } from "@/lib/setup-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm({ pideCodigo }: { pideCodigo: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signUp.email({
      name,
      email,
      password,
      // El primer registro se queda con la instancia: en producción, el
      // servidor pide el código de instalación que imprimió al arrancar.
      fetchOptions: pideCodigo
        ? { headers: { [SETUP_CODE_HEADER]: codigo.trim() } }
        : undefined,
    });
    setLoading(false);
    if (err) {
      if (err.status === 403) {
        setError(
          "El registro está cerrado: esta instancia ya tiene su organización. Pide acceso al propietario."
        );
      } else if (err.status === 401) {
        setError(
          "El código de instalación no coincide. Búscalo en los logs del arranque de la app (línea «Código de instalación»)."
        );
      } else if (err.status === 429) {
        setError("Demasiados intentos. Espera unos minutos.");
      } else {
        setError(err.message ?? "No se pudo crear la cuenta.");
      }
      return;
    }
    // A la raíz, no a la Bandeja: ahí se decide si toca la guía de inicio
    // (#86) o la Bandeja de siempre.
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>
          El primer registro crea la organización de esta instancia y queda
          como propietario.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Tu nombre</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {pideCodigo && (
            <div className="space-y-1.5">
              <Label htmlFor="setup-code">Código de instalación</Label>
              <Input
                id="setup-code"
                required
                autoComplete="off"
                placeholder="XXXX-XXXX-XXXX"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Está en los logs del arranque de la app: busca la línea
                «Código de instalación» (por ejemplo, con docker compose logs app).
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creando…" : "Crear cuenta"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
