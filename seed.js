/* Carga los JSON de /data en la base de datos y crea indices y usuarios de ejemplo.
   Uso: npm run seed          (agrega lo que falte, sin duplicar por ISBN)
        npm run seed -- --reset   (vacia libros, usuarios y prestamos antes) */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/libreria";
const reset = process.argv.includes("--reset");

(async () => {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  console.log("Base de datos:", mongoose.connection.name);

  for (const c of ["libros", "usuarios", "prestamos"]) {
    const existe = await db.listCollections({ name: c }).hasNext();
    if (!existe) await db.createCollection(c);
  }
  if (reset) {
    await Promise.all(["libros", "usuarios", "prestamos"].map((c) => db.collection(c).deleteMany({})));
    console.log("Colecciones vaciadas.");
  }

  /* Indices del modelo del proyecto (si ya existen, no pasa nada). */
  await db.collection("libros").createIndex({ isbn: 1 }, { unique: true });
  await db.collection("libros").createIndex({ categoria: 1 });
  await db.collection("usuarios").createIndex({ correo: 1 }, { unique: true });
  await db.collection("usuarios").createIndex({ identificador: 1 });
  await db.collection("prestamos").createIndex({ estado: 1, fechaLimite: 1 });
  await db.collection("prestamos").createIndex({ usuario: 1, estado: 1 });
  await db.collection("prestamos").createIndex({ libro: 1 });

  /* Libros: upsert por ISBN, asi se puede correr varias veces sin duplicar. */
  const dir = path.join(__dirname, "data");
  let total = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const docs = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const ops = docs.map((d) => ({
      updateOne: { filter: { isbn: d.isbn }, update: { $setOnInsert: d }, upsert: true },
    }));
    const r = await db.collection("libros").bulkWrite(ops, { ordered: false });
    console.log(`${f}: ${docs.length} en archivo, ${r.upsertedCount} nuevos`);
    total += r.upsertedCount;
  }

  /* Usuarios de ejemplo para probar prestamos. */
  const usuarios = [
    { nombre: "Ana Torres", correo: "ana.torres@alumno.ipn.mx", rol: "estudiante", identificador: "2021000001", estadoCuenta: "activa" },
    { nombre: "Luis Hernández", correo: "luis.hernandez@alumno.ipn.mx", rol: "estudiante", identificador: "2021000002", estadoCuenta: "activa" },
    { nombre: "Dra. María Gómez", correo: "maria.gomez@ipn.mx", rol: "profesor", identificador: "PROF-0001", estadoCuenta: "activa" },
  ];
  for (const u of usuarios) {
    await db.collection("usuarios").updateOne({ correo: u.correo }, { $setOnInsert: u }, { upsert: true });
  }

  console.log(`\nLibros nuevos: ${total}`);
  console.log("Total en la coleccion libros:", await db.collection("libros").countDocuments());
  await mongoose.disconnect();
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
