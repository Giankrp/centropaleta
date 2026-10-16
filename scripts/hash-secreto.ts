import { hashDePassword } from "../lib/usuarios.ts";

const password = process.argv[2];
if (!password) {
  console.error("Uso: node --experimental-strip-types scripts/hash-secreto.ts <contraseña>");
  process.exit(1);
}
console.log(hashDePassword(password));
