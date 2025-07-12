const { db2 } = require('../config/database.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const crearCliente = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    try {
        const {
            numero_documento,
            nombre,
            apellido,
            email,
            passwd,
            telefono,
            direccion = {
                calle: '',
                numero: '',
                distrito: '',
                referencia: ''
            },
            metodoPago = 'efectivo',
            tipoEntrega = 'recojo',
            notas = ''
        } = req.body;

        // Validate required fields
        if (!numero_documento || !nombre || !apellido || !passwd) {
            return res.status(400).json({
                error: 'Los campos número de documento, nombre, apellido y contraseña son obligatorios'
            });
        }

        // Check if client exists
        const [existingClient] = await db2.query(
            'SELECT dni_cliente FROM Cliente WHERE dni_cliente = ?',
            [numero_documento]
        );

        if (existingClient.length > 0) {
            return res.status(400).json({
                error: 'Ya existe un cliente con este número de documento'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(passwd, 10);

        const [result] = await db2.query(
            `INSERT INTO Cliente (
                dni_cliente, nombre, apellido, email, passwd, telefono,
                calle, numero, distrito, referencia,
                metodo_pago, tipo_entrega, notas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                numero_documento,
                nombre,
                apellido,
                email || null,
                hashedPassword,
                telefono || null,
                direccion.calle,
                direccion.numero,
                direccion.distrito,
                direccion.referencia,
                metodoPago,
                tipoEntrega,
                notas
            ]
        );

        res.status(201).json({
            message: 'Cliente creado exitosamente',
            id: result.insertId,
            cliente: {
                numero_documento,
                nombre,
                apellido,
                email,
                telefono,
                direccion,
                metodoPago,
                tipoEntrega,
                notas
            }
        });

    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({
            error: 'Error al crear el cliente'
        });
    }
};

const loginCliente = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const { email, passwd } = req.body;

        if (!email || !passwd) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son requeridos'
            });
        }

        const [clientes] = await db2.query(
            `SELECT 
                dni_cliente as dni,
                nombre,
                apellido,
                email,
                telefono,
                passwd,
                calle,
                numero,
                distrito,
                referencia,
                metodo_pago,
                tipo_entrega
            FROM Cliente 
            WHERE email = ?`,
            [email]
        );

        if (clientes.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        const cliente = clientes[0];
        
        const passwordMatch = await bcrypt.compare(passwd, cliente.passwd);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        const token = jwt.sign(
            { 
                id: cliente.dni,
                role: 'cliente',
                email: cliente.email 
            },
            process.env.JWT_CLIENTE_SECRET || 'clave_secreta_clientes',
            { expiresIn: '2h' }
        );

        // Remove password from response
        delete cliente.passwd;

        // Structure address data
        cliente.direccion = {
            calle: cliente.calle,
            numero: cliente.numero,
            distrito: cliente.distrito,
            referencia: cliente.referencia
        };

        delete cliente.calle;
        delete cliente.numero;
        delete cliente.distrito;
        delete cliente.referencia;

        res.json({
            success: true,
            message: 'Login exitoso',
            token,
            cliente
        });

    } catch (error) {
        console.error('Error en login de cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el proceso de login'
        });
    }
};

const editarCliente = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const dni_cliente = parseInt(req.params.dni_cliente);
        const clienteAutenticado = parseInt(req.cliente.id);

        if (dni_cliente !== clienteAutenticado) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para editar este perfil'
            });
        }

        const {
            nombre,
            apellido,
            email,
            telefono,
            direccion = {},
            metodoPago,
            tipoEntrega,
            notas
        } = req.body;

        // Validar campos requeridos
        if (!nombre || !apellido || !email) {
            return res.status(400).json({
                success: false,
                message: 'Los campos nombre, apellido y email son obligatorios'
            });
        }

        const [result] = await db2.query(
            `UPDATE Cliente SET 
                nombre = ?, 
                apellido = ?, 
                email = ?, 
                telefono = ?,
                calle = ?,
                numero = ?,
                distrito = ?,
                referencia = ?,
                metodo_pago = ?,
                tipo_entrega = ?,
                notas = ?
            WHERE dni_cliente = ?`, // <-- Usar dni_cliente
            [
                nombre,
                apellido,
                email,
                telefono || null,
                direccion.calle || '',
                direccion.numero || '',
                direccion.distrito || '',
                direccion.referencia || '',
                metodoPago || 'efectivo',
                tipoEntrega || 'recojo',
                notas || '',
                dni_cliente
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Cliente actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al editar cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el cliente'
        });
    }
};

module.exports = {
    crearCliente,
    loginCliente,
    editarCliente
};