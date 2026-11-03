const mongoose = require("mongoose");
const { Schema } = mongoose;

/* Los esquemas reflejan los validadores $jsonSchema del modelo del proyecto.
   Se fija el nombre de la coleccion para que coincida con Compass. */

const libroSchema = new Schema(
  {
    titulo: { type: String, required: true, trim: true },
    autores: {
      type: [String],
      validate: (v) => Array.isArray(v) && v.length >= 1,
    },
    isbn: { type: String, required: true, unique: true, trim: true },
    categoria: { type: String, required: true, trim: true },
    edicion: { type: String, trim: true },
    ejemplaresTotales: { type: Number, min: 0 },
    ejemplaresDisponibles: { type: Number, required: true, min: 0 },
  },
  { collection: "libros", versionKey: false, autoIndex: false }
);

const usuarioSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    correo: { type: String, required: true, unique: true, trim: true, lowercase: true },
    rol: { type: String, required: true, enum: ["estudiante", "profesor"] },
    identificador: { type: String, trim: true },
    estadoCuenta: { type: String, required: true, enum: ["activa", "suspendida"], default: "activa" },
  },
  { collection: "usuarios", versionKey: false, autoIndex: false }
);

const prestamoSchema = new Schema(
  {
    usuario: { type: Schema.Types.ObjectId, ref: "Usuario", required: true },
    libro: { type: Schema.Types.ObjectId, ref: "Libro", required: true },
    fechaPrestamo: { type: Date, required: true },
    fechaLimite: { type: Date, required: true },
    fechaDevolucion: { type: Date, default: null },
    estado: { type: String, required: true, enum: ["Activo", "Devuelto", "Vencido"] },
  },
  { collection: "prestamos", versionKey: false, autoIndex: false }
);

module.exports = {
  Libro: mongoose.model("Libro", libroSchema),
  Usuario: mongoose.model("Usuario", usuarioSchema),
  Prestamo: mongoose.model("Prestamo", prestamoSchema),
};
