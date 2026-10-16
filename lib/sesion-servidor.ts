import { cookies } from "next/headers";
import { COOKIE, sessionFromCookieValue, type Sesion } from "./sesion.ts";

export async function leerSesion(): Promise<Sesion | null> {
  const store = await cookies();
  return sessionFromCookieValue(store.get(COOKIE)?.value);
}
