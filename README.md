# Sistema de Gestión Bibliotecaria

Materia: Bases de Datos NoSQL (6CM68) — UPIICSA, IPN
Stack: MongoDB · Mongoose · Node.js · Express · HTML/CSS/JavaScript

Aplicación web sencilla conectada a MongoDB: catálogo con búsqueda y filtros por
género, módulo de usuarios y control de préstamos y devoluciones.

## Requisitos

- Node.js 18 o superior
- MongoDB corriendo en `127.0.0.1:27017` (el mismo que usa MongoDB Compass)

## Puesta en marcha

```bash
npm install
npm run seed     # carga los 281 libros y 3 usuarios de ejemplo en la base "libreria"
npm start        # abre http://localhost:3000
```

- `npm run seed` se puede ejecutar varias veces sin duplicar libros (usa el ISBN como llave).
- `npm run seed -- --reset` vacía las colecciones y vuelve a cargar todo.
- Para usar otra base o servidor: `MONGO_URI="mongodb://host:27017/otra_bd" npm start`
  (en Windows PowerShell: `$env:MONGO_URI="mongodb://127.0.0.1:27017/libreria"; npm start`).

## Estructura

```
data/        JSON de libros por género (7 archivos, 281 libros)
models/      Esquemas Mongoose (libros, usuarios, prestamos)
routes/      API REST
public/      Interfaz web
seed.js      Carga de datos e índices
server.js    Servidor Express
```

## API REST

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/libros?q=&categoria=&disponibles=1&pagina=` | Búsqueda con filtros y paginación |
| GET | `/api/libros/categorias` | Géneros con total de libros (agregación) |
| POST | `/api/libros` | Agrega un libro |
| DELETE | `/api/libros/:id` | Elimina un libro (si no tiene préstamos activos) |
| GET / POST | `/api/usuarios` | Lista y alta de usuarios |
| GET | `/api/prestamos?estado=` | Lista préstamos (`$lookup` con libro y usuario) |
| POST | `/api/prestamos` | Registra un préstamo (7 días) |
| POST | `/api/prestamos/:id/devolver` | Registra la devolución |
| GET | `/api/prestamos/reportes/mas-solicitados` | Reporte de libros más solicitados |

## Decisiones de diseño (NoSQL)

- **Autores embebidos:** `autores` es un arreglo dentro del documento del libro.
- **Referencias por ObjectId:** `prestamos` apunta a `usuarios` y `libros`.
- **Descuento atómico de ejemplares:** el préstamo usa
  `findOneAndUpdate({ ejemplaresDisponibles: { $gt: 0 } }, { $inc: { ejemplaresDisponibles: -1 } })`,
  de modo que dos préstamos simultáneos nunca dejan el inventario en negativo.
- **Reglas de negocio:** no se presta a cuentas suspendidas ni a usuarios con préstamos vencidos.
- **Vencidos:** al consultar préstamos, los activos con fecha límite pasada se marcan `Vencido`.

## Nota sobre los datos

Los títulos y autores son de obras reales. Los ISBN de los géneros agregados
(escolares, infantiles, terror, romance y ciencia ficción) son valores generados
para pruebas y no corresponden a ediciones reales.
