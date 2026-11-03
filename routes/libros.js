const router = require("express").Router();
const { Libro, Prestamo } = require("../models");

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* GET /api/libros?q=&categoria=&disponibles=1&pagina=1&limite=24 */
router.get("/", async (req, res, next) => {
  try {
    const { q, categoria, disponibles } = req.query;
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const limite = Math.min(Math.max(parseInt(req.query.limite) || 24, 1), 100);

    const filtro = {};
    if (categoria) filtro.categoria = categoria;
    if (disponibles === "1") filtro.ejemplaresDisponibles = { $gt: 0 };
    if (q && q.trim()) {
      const rx = new RegExp(escapar(q.trim()), "i");
      filtro.$or = [{ titulo: rx }, { autores: rx }, { isbn: rx }];
    }

    const [libros, total] = await Promise.all([
      Libro.find(filtro)
        .sort({ titulo: 1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .lean(),
      Libro.countDocuments(filtro),
    ]);
    res.json({ libros, total, pagina, paginas: Math.ceil(total / limite) });
  } catch (e) {
    next(e);
  }
});

/* GET /api/libros/categorias -> [{ categoria, total, disponibles }] */
router.get("/categorias", async (_req, res, next) => {
  try {
    const datos = await Libro.aggregate([
      {
        $group: {
          _id: "$categoria",
          total: { $sum: 1 },
          disponibles: { $sum: "$ejemplaresDisponibles" },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, categoria: "$_id", total: 1, disponibles: 1 } },
    ]);
    res.json(datos);
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const b = req.body;
    const total = Number(b.ejemplaresTotales ?? 1);
    const autores = Array.isArray(b.autores)
      ? b.autores
      : String(b.autores || "").split(",").map((a) => a.trim()).filter(Boolean);
    const libro = await Libro.create({
      titulo: b.titulo,
      autores,
      isbn: b.isbn,
      categoria: b.categoria,
      edicion: b.edicion || "1a",
      ejemplaresTotales: total,
      ejemplaresDisponibles: total,
    });
    res.status(201).json(libro);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const activos = await Prestamo.countDocuments({ libro: req.params.id, estado: { $ne: "Devuelto" } });
    if (activos > 0) {
      return res.status(409).json({ error: "No se puede eliminar: el libro tiene préstamos activos." });
    }
    const r = await Libro.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: "Libro no encontrado." });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
