import { cookies } from "next/headers";
import { sessionFromCookieValue } from "./session.js";

export type Sesion = ReturnType<typeof sessionFromCookieValue>;

export async function leerSesion(): Promise<Sesion> {
  const store = await cookies();
  return sessionFromCookieValue(store.get("cp_session")?.value);
}
