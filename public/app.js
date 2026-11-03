/* Frontend sencillo en JavaScript puro: consume la API REST. */
const $ = (s) => document.querySelector(s);
const estado = { pagina: 1, paginas: 1 };

/* ---------- utilidades ---------- */
async function api(url, opciones = {}) {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opciones,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || "Error en la solicitud");
  return datos;
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("ver");
  setTimeout(() => t.classList.remove("ver"), 2600);
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = (d) => (d ? new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/* ---------- modal generico ---------- */
function abrirModal(titulo, camposHtml, alEnviar) {
  $("#modalTitulo").textContent = titulo;
  $("#modalCampos").innerHTML = camposHtml;
  $("#modalError").textContent = "";
  const m = $("#modal");
  m.showModal();
  $("#modalForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await alEnviar(Object.fromEntries(new FormData($("#modalForm"))));
      m.close();
    } catch (err) {
      $("#modalError").textContent = err.message;
    }
  };
}
$("#modalCancelar").onclick = () => $("#modal").close();
const campo = (n, etiqueta, tipo = "text", extra = "") =>
  `<label class="campo">${etiqueta}<input name="${n}" type="${tipo}" ${extra}></label>`;

/* ---------- navegacion ---------- */
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("activa", x === b));
    document.querySelectorAll(".vista").forEach((v) => v.classList.add("oculta"));
    $("#vista-" + b.dataset.vista).classList.remove("oculta");
    if (b.dataset.vista === "catalogo") cargarLibros();
    if (b.dataset.vista === "prestamos") cargarPrestamos();
    if (b.dataset.vista === "usuarios") cargarUsuarios();
  })
);

/* ---------- buscador de usuarios (para prestamos) ---------- */
function activarBuscadorUsuarios() {
  const input = $("#buscaUsuario");
  const lista = $("#resultadosUsuario");
  const oculto = $("#usuarioId");
  const info = $("#usuarioSel");
  let timer, resultados = [];

  const elegir = (u) => {
    oculto.value = u._id;
    $("#modalError").textContent = "";
    input.value = u.nombre;
    lista.innerHTML = "";
    info.textContent = `Seleccionado: ${u.nombre} · ${u.rol} · ${u.identificador || u.correo}`;
  };

  input.addEventListener("input", () => {
    oculto.value = ""; /* si vuelve a escribir, se pierde la seleccion anterior */
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) {
      lista.innerHTML = "";
      info.textContent = "Escribe al menos 2 letras o números.";
      return;
    }
    timer = setTimeout(async () => {
      try {
        resultados = await api("/api/usuarios?q=" + encodeURIComponent(q));
        info.textContent = resultados.length ? "Elige un usuario de la lista:" : "Sin coincidencias.";
        lista.innerHTML = resultados
          .map((u, i) => `<li data-i="${i}">
              <strong>${esc(u.nombre)}</strong>
              <span>${u.rol} · ${esc(u.identificador || "sin boleta")} · ${esc(u.correo)}${u.estadoCuenta !== "activa" ? " · SUSPENDIDA" : ""}</span>
            </li>`)
          .join("");
      } catch (err) {
        info.textContent = err.message;
      }
    }, 200);
  });

  /* Enter elige el primer resultado en lugar de enviar el formulario */
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (resultados[0] && !oculto.value) elegir(resultados[0]);
    }
  });
  lista.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-i]");
    if (li) elegir(resultados[li.dataset.i]);
  });
  input.focus();
}

/* ---------- catalogo ---------- */
async function cargarCategorias() {
  const cats = await api("/api/libros/categorias");
  const sel = $("#categoria");
  const actual = sel.value;
  sel.innerHTML =
    `<option value="">Todas las categorías</option>` +
    cats.map((c) => `<option value="${esc(c.categoria)}">${esc(c.categoria)} (${c.total})</option>`).join("");
  sel.value = actual;
}

async function cargarLibros() {
  const p = new URLSearchParams({
    q: $("#q").value,
    categoria: $("#categoria").value,
    pagina: estado.pagina,
    limite: 24,
  });
  if ($("#soloDisp").checked) p.set("disponibles", "1");
  const { libros, total, pagina, paginas } = await api("/api/libros?" + p);
  estado.paginas = paginas || 1;
  $("#resumen").textContent = `${total} libro${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}`;
  $("#pagInfo").textContent = `Página ${pagina} de ${estado.paginas}`;
  $("#prev").disabled = pagina <= 1;
  $("#next").disabled = pagina >= estado.paginas;

  $("#grid").innerHTML = libros.length
    ? libros
        .map((l) => {
          const d = l.ejemplaresDisponibles;
          const clase = d === 0 ? "bad" : d <= 1 ? "warn" : "ok";
          return `<article class="libro">
            <h3>${esc(l.titulo)}</h3>
            <div class="aut">${esc((l.autores || []).join(", "))}</div>
            <div class="meta"><span>${esc(l.categoria)} · ISBN ${esc(l.isbn)}</span></div>
            <div class="meta"><span class="pill ${clase}">${d} de ${l.ejemplaresTotales ?? "?"} disponibles</span></div>
            <div class="acc">
              <button data-prestar="${l._id}" data-titulo="${esc(l.titulo)}" ${d === 0 ? "disabled" : ""}>Prestar</button>
              <button class="sec del" data-borrar="${l._id}" title="Eliminar">🗑</button>
            </div>
          </article>`;
        })
        .join("")
    : `<p class="vacio">No se encontraron libros.</p>`;
}

let tBusqueda;
$("#q").addEventListener("input", () => {
  clearTimeout(tBusqueda);
  tBusqueda = setTimeout(() => { estado.pagina = 1; cargarLibros(); }, 250);
});
$("#categoria").onchange = $("#soloDisp").onchange = () => { estado.pagina = 1; cargarLibros(); };
$("#prev").onclick = () => { estado.pagina--; cargarLibros(); };
$("#next").onclick = () => { estado.pagina++; cargarLibros(); };

$("#grid").addEventListener("click", async (e) => {
  const prestar = e.target.closest("[data-prestar]");
  const borrar = e.target.closest("[data-borrar]");
  if (prestar) {
    abrirModal(
      "Prestar libro",
      `<p><strong>${prestar.dataset.titulo}</strong></p>
       <label class="campo">Buscar usuario
         <input type="search" id="buscaUsuario" placeholder="Nombre, boleta o correo…" autocomplete="off">
       </label>
       <input type="hidden" name="usuarioId" id="usuarioId">
       <ul id="resultadosUsuario" class="resultados"></ul>
       <p id="usuarioSel" class="muted">Escribe al menos 2 letras o números.</p>
       <p class="muted">El préstamo dura 7 días.</p>`,
      async (d) => {
        if (!d.usuarioId) throw new Error("Busca y selecciona un usuario de la lista.");
        await api("/api/prestamos", { method: "POST", body: { usuarioId: d.usuarioId, libroId: prestar.dataset.prestar } });
        toast("Préstamo registrado");
        cargarLibros();
      }
    );
    activarBuscadorUsuarios();
  }
  if (borrar && confirm("¿Eliminar este libro del catálogo?")) {
    try {
      await api("/api/libros/" + borrar.dataset.borrar, { method: "DELETE" });
      toast("Libro eliminado");
      cargarLibros();
      cargarCategorias();
    } catch (err) {
      toast(err.message);
    }
  }
});

$("#btnNuevoLibro").onclick = () =>
  abrirModal(
    "Agregar libro",
    campo("titulo", "Título", "text", "required") +
      campo("autores", "Autores (separados por coma)", "text", "required") +
      campo("isbn", "ISBN", "text", "required") +
      campo("categoria", "Categoría", "text", "required") +
      campo("edicion", "Edición", "text", 'placeholder="1a"') +
      campo("ejemplaresTotales", "Ejemplares", "number", 'min="1" value="1" required'),
    async (d) => {
      await api("/api/libros", { method: "POST", body: d });
      toast("Libro agregado");
      cargarCategorias();
      cargarLibros();
    }
  );

/* ---------- prestamos ---------- */
async function cargarPrestamos() {
  const est = $("#filtroEstado").value;
  const datos = await api("/api/prestamos" + (est ? "?estado=" + est : ""));
  $("#tbPrestamos").innerHTML = datos.length
    ? datos
        .map((p) => {
          const clase = p.estado === "Activo" ? "ok" : p.estado === "Vencido" ? "bad" : "";
          return `<tr>
            <td>${esc(p.libro?.titulo ?? "(libro eliminado)")}</td>
            <td>${esc(p.usuario?.nombre ?? "(usuario eliminado)")}</td>
            <td>${fecha(p.fechaPrestamo)}</td>
            <td>${fecha(p.fechaLimite)}</td>
            <td><span class="pill ${clase}">${p.estado}</span></td>
            <td>${p.estado !== "Devuelto" ? `<button data-devolver="${p._id}">Devolver</button>` : fecha(p.fechaDevolucion)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="vacio">Sin préstamos todavía.</td></tr>`;

  const top = await api("/api/prestamos/reportes/mas-solicitados");
  $("#topLibros").innerHTML = top.length
    ? top.map((t) => `<li>${esc(t.titulo)} — ${t.prestamos} préstamo${t.prestamos === 1 ? "" : "s"}</li>`).join("")
    : `<li class="muted">Aún no hay datos.</li>`;
}
$("#filtroEstado").onchange = cargarPrestamos;
$("#tbPrestamos").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-devolver]");
  if (!b) return;
  try {
    await api(`/api/prestamos/${b.dataset.devolver}/devolver`, { method: "POST" });
    toast("Libro devuelto");
    cargarPrestamos();
  } catch (err) {
    toast(err.message);
  }
});

/* ---------- usuarios ---------- */
async function cargarUsuarios() {
  const datos = await api("/api/usuarios");
  $("#tbUsuarios").innerHTML = datos
    .map((u) => `<tr><td>${esc(u.nombre)}</td><td>${esc(u.correo)}</td><td>${u.rol}</td><td>${esc(u.identificador ?? "")}</td>
      <td><span class="pill ${u.estadoCuenta === "activa" ? "ok" : "bad"}">${u.estadoCuenta}</span></td></tr>`)
    .join("");
}
$("#btnNuevoUsuario").onclick = () =>
  abrirModal(
    "Agregar usuario",
    campo("nombre", "Nombre", "text", "required") +
      campo("correo", "Correo", "email", "required") +
      `<label class="campo">Rol<select name="rol"><option value="estudiante">Estudiante</option><option value="profesor">Profesor</option></select></label>` +
      campo("identificador", "Boleta / No. de empleado"),
    async (d) => {
      await api("/api/usuarios", { method: "POST", body: d });
      toast("Usuario agregado");
      cargarUsuarios();
    }
  );

/* ---------- inicio ---------- */
cargarCategorias().then(cargarLibros).catch((e) => toast(e.message));
