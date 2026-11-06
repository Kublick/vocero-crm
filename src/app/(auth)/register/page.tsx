import { organizationCount, setupCodeRequired } from "@/server/auth/registration";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

/**
 * El formulario pide el código de instalación solo cuando el servidor lo va a
 * exigir: en producción y con la instancia todavía sin organización.
 */
export default async function RegisterPage() {
  let pideCodigo = false;
  if (setupCodeRequired()) {
    try {
      pideCodigo = (await organizationCount()) === 0;
    } catch {
      // Sin BD el registro fallará igual; mejor enseñar el campo que ocultarlo.
      pideCodigo = true;
    }
  }
  return <RegisterForm pideCodigo={pideCodigo} />;
}
