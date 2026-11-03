const router = require("express").Router();
const { Usuario } = require("../models");

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* GET /api/usuarios            -> todos
   GET /api/usuarios?q=texto    -> busca por nombre, boleta/identificador o correo (max. 8) */
router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json(await Usuario.find().sort({ nombre: 1 }).lean());

    const rx = new RegExp(escapar(q), "i");
    const datos = await Usuario.find({
      $or: [{ nombre: rx }, { correo: rx }, { identificador: rx }],
    })
      .sort({ nombre: 1 })
      .limit(8)
      .lean();
    res.json(datos);
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { nombre, correo, rol, identificador } = req.body;
    const u = await Usuario.create({ nombre, correo, rol, identificador, estadoCuenta: "activa" });
    res.status(201).json(u);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
