const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/libreria";
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/libros", require("./routes/libros"));
app.use("/api/usuarios", require("./routes/usuarios"));
app.use("/api/prestamos", require("./routes/prestamos"));

/* Manejo de errores: convierte los de Mongo/Mongoose en mensajes claros. */
app.use((err, _req, res, _next) => {
  if (err.code === 11000) {
    const campo = Object.keys(err.keyPattern || {})[0] || "campo";
    return res.status(409).json({ error: `Ya existe un registro con ese ${campo}.` });
  }
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 121) {
    return res.status(400).json({ error: "El documento no cumple el validador de la colección." });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(`Conectado a MongoDB: ${mongoose.connection.name}`);
    app.listen(PORT, () => console.log(`Biblioteca en http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error("No se pudo conectar a MongoDB:", e.message);
    process.exit(1);
  });
