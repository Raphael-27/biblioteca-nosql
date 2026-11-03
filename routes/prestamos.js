const router = require("express").Router();
const { Libro, Usuario, Prestamo } = require("../models");

const DIAS_PRESTAMO = 7;

/* Marca como Vencido los prestamos activos cuya fecha limite ya paso. */
async function actualizarVencidos() {
  await Prestamo.updateMany(
    { estado: "Activo", fechaLimite: { $lt: new Date() } },
    { $set: { estado: "Vencido" } }
  );
}

/* GET /api/prestamos?estado=Activo|Vencido|Devuelto */
router.get("/", async (req, res, next) => {
  try {
    await actualizarVencidos();
    const filtro = {};
    if (req.query.estado) filtro.estado = req.query.estado;
    const datos = await Prestamo.find(filtro)
      .sort({ fechaPrestamo: -1 })
      .limit(200)
      .populate("usuario", "nombre rol")
      .populate("libro", "titulo categoria")
      .lean();
    res.json(datos);
  } catch (e) {
    next(e);
  }
});

/* POST /api/prestamos { usuarioId, libroId } */
router.post("/", async (req, res, next) => {
  try {
    const { usuarioId, libroId } = req.body;
    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });
    if (usuario.estadoCuenta !== "activa") {
      return res.status(403).json({ error: "La cuenta del usuario está suspendida." });
    }

    await actualizarVencidos();
    const vencidos = await Prestamo.countDocuments({ usuario: usuario._id, estado: "Vencido" });
    if (vencidos > 0) {
      return res.status(403).json({ error: "El usuario tiene préstamos vencidos pendientes de devolver." });
    }

    /* Descuento atomico: solo si aun hay ejemplares (evita quedar en negativo). */
    const libro = await Libro.findOneAndUpdate(
      { _id: libroId, ejemplaresDisponibles: { $gt: 0 } },
      { $inc: { ejemplaresDisponibles: -1 } },
      { new: true }
    );
    if (!libro) return res.status(409).json({ error: "No hay ejemplares disponibles de este libro." });

    const ahora = new Date();
    const limite = new Date(ahora.getTime() + DIAS_PRESTAMO * 24 * 60 * 60 * 1000);
    try {
      const prestamo = await Prestamo.create({
        usuario: usuario._id,
        libro: libro._id,
        fechaPrestamo: ahora,
        fechaLimite: limite,
        fechaDevolucion: null,
        estado: "Activo",
      });
      res.status(201).json(prestamo);
    } catch (err) {
      await Libro.updateOne({ _id: libro._id }, { $inc: { ejemplaresDisponibles: 1 } });
      throw err;
    }
  } catch (e) {
    next(e);
  }
});

/* POST /api/prestamos/:id/devolver */
router.post("/:id/devolver", async (req, res, next) => {
  try {
    const p = await Prestamo.findOneAndUpdate(
      { _id: req.params.id, estado: { $in: ["Activo", "Vencido"] } },
      { $set: { estado: "Devuelto", fechaDevolucion: new Date() } },
      { new: true }
    );
    if (!p) return res.status(404).json({ error: "Préstamo no encontrado o ya devuelto." });
    await Libro.updateOne({ _id: p.libro }, { $inc: { ejemplaresDisponibles: 1 } });
    res.json(p);
  } catch (e) {
    next(e);
  }
});

/* Reporte: libros mas solicitados */
router.get("/reportes/mas-solicitados", async (_req, res, next) => {
  try {
    const datos = await Prestamo.aggregate([
      { $group: { _id: "$libro", prestamos: { $sum: 1 } } },
      { $sort: { prestamos: -1 } },
      { $limit: 10 },
      { $lookup: { from: "libros", localField: "_id", foreignField: "_id", as: "libro" } },
      { $unwind: "$libro" },
      { $project: { _id: 0, titulo: "$libro.titulo", categoria: "$libro.categoria", prestamos: 1 } },
    ]);
    res.json(datos);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
