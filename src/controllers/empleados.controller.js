const { db2 } = require('../config/database.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_super_segura';

const login = async (req, res) => {
  try {
    const { email, passwd } = req.body;

    if (!email || !passwd) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    const [usuarios] = await db2.query(
      'SELECT id_usuario, email, passwd, nombre, apellido, dni_empleado FROM Usuario WHERE email = ?',
      [email]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const usuario = usuarios[0];

    const passwordMatch = await bcrypt.compare(passwd, usuario.passwd);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Update ultima_conexion
    await db2.query(
      'UPDATE Usuario SET ultima_conexion = NOW() WHERE id_usuario = ?',
      [usuario.id_usuario]
    );

    const token = jwt.sign(
      { 
        id: usuario.id_usuario,
        dni: usuario.dni_empleado,
        role: 'empleado',
        email: usuario.email, 
        nombre: `${usuario.nombre} ${usuario.apellido}` 
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id_usuario,
        dni: usuario.dni_empleado,
        email: usuario.email,
        nombre: `${usuario.nombre} ${usuario.apellido}`
      }
    });

  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
  }
};

const verificarTokenEmpleado = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No tiene autorización para ingresar.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(403).json({ error: 'Token inválido' });
  }
};

const getEmpleado = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const [usuarios] = await db2.query(
      `SELECT 
        id_usuario AS id,
        nombre,
        apellido,
        email AS correo,
        ultima_conexion
      FROM Usuario
      ORDER BY nombre ASC`
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'No se encontraron usuarios' });
    }

    res.json(usuarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
};

const registrarUsuario = async (req, res) => {
  try {
    const usuarioId = req.usuario?.id;

    console.log('Usuario ID:', usuarioId);

    const { nombre, apellido, dni_empleado, email, passwd } = req.body;

    if (!nombre || !apellido || !email || !dni_empleado || !passwd) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Verificar si el email ya existe
    const [existingUser] = await db2.query(
      'SELECT id_usuario FROM Usuario WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(passwd, 10);

    const [result] = await db2.query(
      `INSERT INTO Usuario (dni_empleado, nombre, apellido, email, passwd, ultima_conexion) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [dni_empleado, nombre, apellido, email, hashedPassword]
    );

    res.status(201).json({ 
      success: true,
      message: 'Usuario creado exitosamente', 
      id_usuario: result.insertId 
    });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor', 
      detalle: err.message 
    });
  }
};

module.exports = { 
  getEmpleado, 
  login,
  verificarTokenEmpleado,
  registrarUsuario
};