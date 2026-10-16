// Crea o actualiza un usuario en la base de datos local.
// Uso:  npm run seed -- "correo@ejemplo.com" "contraseña" "Nombre"
const bcrypt = require("bcryptjs");
const { findUserByEmail, createUser, getDb, limpiarIntentos } = require("../lib/db");

const [, , email, password, nombre] = process.argv;

if (!email || !password) {
  console.log('Uso: npm run seed -- "correo@ejemplo.com" "contraseña" "Nombre"');
  process.exit(1);
}

const V = require("../lib/validaciones");
const errCorreo = V.validarEmail(email);
const errClave = V.validarClave(password);
if (errCorreo || errClave) {
  console.log(errCorreo || errClave);
  process.exit(1);
}

(async () => {
const existente = await findUserByEmail(email);
const hash = bcrypt.hashSync(password, 10);

if (existente) {
  await getDb().prepare("update users set password_hash = ?, nombre = ?, must_change = 0 where id = ?").run(hash, nombre || existente.nombre, existente.id);
  await limpiarIntentos(email); // también levanta un bloqueo por intentos fallidos
  console.log(`Contraseña actualizada para ${email}`);
} else {
  await createUser({ email, passwordHash: hash, nombre, rol: "admin" });
  console.log(`Usuario creado: ${email}`);
}
})().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
