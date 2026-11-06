/**
 * El encabezado con el que `/register` manda el código de instalación del
 * primer registro. Vive en `lib/` porque lo usan los dos lados: el formulario
 * (cliente) y el gate de Better Auth (servidor, `server/auth/registration.ts`).
 */
export const SETUP_CODE_HEADER = "x-vocero-setup-code";
