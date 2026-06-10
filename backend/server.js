require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CREDENCIALES (desde .env) ──────────────────────────────────────────────────
const ADMIN_USER = process.env.ADMIN_USER || '';
const ADMIN_PASS = process.env.ADMIN_PASS || '';

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('ERROR: ADMIN_USER y ADMIN_PASS deben estar definidos en .env');
  process.exit(1);
}

// ── SESIONES EN MEMORIA ────────────────────────────────────────────────────────
// Map<token, { creadoEn: number }>
const sesiones = new Map();

// ── DATOS ──────────────────────────────────────────────────────────────────────
const archivoAspirantes = path.join(__dirname, 'data', 'aspirantes.json');

const dirData = path.dirname(archivoAspirantes);
if (!fs.existsSync(dirData)) fs.mkdirSync(dirData, { recursive: true });
if (!fs.existsSync(archivoAspirantes)) fs.writeFileSync(archivoAspirantes, '[]', 'utf-8');

// ── HELPERS ────────────────────────────────────────────────────────────────────
function leerAspirantes() {
  const raw = fs.readFileSync(archivoAspirantes, 'utf-8');
  return JSON.parse(raw);
}

function guardarAspirantes(lista) {
  fs.writeFileSync(archivoAspirantes, JSON.stringify(lista, null, 2));
}

function siguienteId(lista) {
  return Math.max(0, ...lista.map(a => Number(a.id) || 0)) + 1;
}

// ── MIDDLEWARE ─────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

function autenticar(req, res, next) {
  const cabecera = req.headers['authorization'] || '';
  const token    = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  if (!token || !sesiones.has(token)) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  next();
}

// ── RUTAS ESTÁTICAS ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── LOGIN (público) ────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body || {};

  if (!usuario || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
  }

  if (usuario !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sesiones.set(token, { creadoEn: Date.now() });

  res.json({ message: 'Acceso correcto', token });
});

// ── LOGOUT (requiere token) ────────────────────────────────────────────────────
app.post('/api/logout', autenticar, (req, res) => {
  const token = req.headers['authorization'].slice(7);
  sesiones.delete(token);
  res.json({ message: 'Sesión cerrada' });
});

// ── ASPIRANTES — crear (público, formulario) ───────────────────────────────────
app.post('/api/aspirantes', (req, res) => {
  const data = req.body;

  const obligatorios = ['nombre', 'edad', 'telefono', 'email', 'descripcion'];
  if (obligatorios.some(c => !data[c] || String(data[c]).trim() === '')) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  if (parseInt(data.edad, 10) < 18) {
    return res.status(422).json({ message: 'Debes tener al menos 18 años.' });
  }

  let lista;
  try { lista = leerAspirantes(); }
  catch { return res.status(500).json({ message: 'Error al leer los datos' }); }

  const emailNorm    = data.email.trim().toLowerCase();
  const telefonoNorm = data.telefono.trim();

  if (lista.some(a => a.email.toLowerCase() === emailNorm)) {
    return res.status(400).json({ message: 'Correo ya registrado' });
  }
  if (lista.some(a => a.telefono === telefonoNorm)) {
    return res.status(400).json({ message: 'Teléfono ya registrado' });
  }

  const ahora = new Date().toISOString();
  const nuevo = {
    id:               siguienteId(lista),
    nombre:           data.nombre.trim(),
    edad:             data.edad.trim(),
    telefono:         telefonoNorm,
    email:            emailNorm,
    descripcion:      data.descripcion.trim(),
    estado:           'Nuevo',
    timestamp:        ahora,
    historialEstados: [{ estado: 'Nuevo', fecha: ahora, nota: 'Solicitud registrada' }],
  };

  lista.push(nuevo);
  guardarAspirantes(lista);

  res.json({ message: 'Solicitud guardada' });
});

// ── ASPIRANTES — leer (protegido) ──────────────────────────────────────────────
app.get('/api/aspirantes', autenticar, (req, res) => {
  try {
    res.json(leerAspirantes());
  } catch {
    res.status(500).json({ message: 'Error al cargar aspirantes' });
  }
});

// ── ASPIRANTES — actualizar estado (protegido) ─────────────────────────────────
app.put('/api/aspirantes/:id/estado', autenticar, (req, res) => {
  const id     = Number(req.params.id);
  const { estado } = req.body;

  const permitidos = ['Nuevo', 'Contactado', 'En proceso', 'Aprobado', 'Rechazado'];
  if (!permitidos.includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido' });
  }

  let lista;
  try { lista = leerAspirantes(); }
  catch { return res.status(500).json({ message: 'Error al leer los datos' }); }

  const aspirante = lista.find(a => a.id === id);
  if (!aspirante) return res.status(404).json({ message: 'Aspirante no encontrado' });

  aspirante.estado = estado;
  if (!aspirante.historialEstados) aspirante.historialEstados = [];
  aspirante.historialEstados.push({
    estado,
    fecha: new Date().toISOString(),
    nota:  'Estado actualizado desde el panel',
  });

  guardarAspirantes(lista);
  res.json({ message: 'Estado actualizado' });
});

// ── ASPIRANTES — eliminar (protegido) ──────────────────────────────────────────
app.delete('/api/aspirantes/:id', autenticar, (req, res) => {
  const id = Number(req.params.id);

  let lista;
  try { lista = leerAspirantes(); }
  catch { return res.status(500).json({ message: 'Error al leer los datos' }); }

  const existe = lista.some(a => a.id === id);
  if (!existe) return res.status(404).json({ message: 'Aspirante no encontrado' });

  guardarAspirantes(lista.filter(a => a.id !== id));
  res.json({ message: 'Eliminado' });
});

// ── ARRANQUE ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
