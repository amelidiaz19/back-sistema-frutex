const { db2 } = require('../config/database.js');

const crearCliente = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    try {
        const {
            dni_cliente,
            nombre,
            apellido,
            email = null,
            telefono,
            calle = '',
            numero = '',
            distrito = '',
            referencia = '',
            metodo_pago = 'efectivo',
            tipo_entrega = 'recojo',
            notas = ''
        } = req.body;

        // Validate required fields
        if (!dni_cliente || !nombre || !apellido || !telefono) {
            return res.status(400).json({
                error: 'Los campos número de documento, nombre, apellido y telefono son obligatorios'
            });
        }

        // Check if client exists
        const [existingClient] = await db2.query(
            'SELECT dni_cliente FROM Cliente WHERE dni_cliente = ?',
            [dni_cliente]
        );

        if (existingClient.length > 0) {
            return res.status(400).json({
                error: 'Ya existe un cliente con este número de documento'
            });
        }

        if (email) {
            const [existingEmail] = await db2.query(
                'SELECT dni_cliente FROM Cliente WHERE email = ? AND dni_cliente != ?',
                [email, dni_cliente]
            );

            if (existingEmail.length > 0) {
                return res.status(400).json({
                    error: 'Ya existe un cliente con este correo electrónico'
                });
            }
        }

        const [result] = await db2.query(
            `INSERT INTO Cliente (
                dni_cliente, nombre, apellido, email, telefono,
                calle, numero, distrito, referencia,
                metodo_pago, tipo_entrega, notas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                dni_cliente,
                nombre,
                apellido,
                email || null,
                telefono,
                calle,
                numero,
                distrito,
                referencia,
                metodo_pago,
                tipo_entrega,
                notas
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Cliente creado exitosamente',
            cliente: {
                dni_cliente,
                nombre,
                apellido,
                email,
                telefono,
                calle,
                numero,
                distrito,
                referencia,
                metodo_pago,
                tipo_entrega,
                notas
            }
        });

    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear el cliente'
        });
    }
};

const verificarCliente = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const { numeroDocumento } = req.params;

        // Bloquear al default
        if (numeroDocumento === '00000000') {
            return res.status(403).json({
                success: false,
                message: 'Cliente no permitido'
            });
        }

        // Validar formato del número de documento
        if (!numeroDocumento || numeroDocumento.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Número de documento inválido'
            });
        }

        // Buscar cliente por número de documento
        const [clientes] = await db2.query(
            'SELECT * FROM Cliente WHERE dni_cliente = ?',
            [numeroDocumento]
        );

        // Devolver true si existe, false si no existe
        res.json({
            success: true,
            exists: clientes.length > 0,
            cliente: clientes.length > 0 ? clientes[0] : null
        });

    } catch (error) {
        console.error('Error al verificar cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al verificar cliente'
        });
    }
};

const listarClientes = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const searchTerm = req.query.searchTerm || '';
    const offset = (page - 1) * limit;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const [clientes] = await db2.query(
            `SELECT * FROM Cliente 
            WHERE dni_cliente LIKE ? OR nombre LIKE ? OR apellido LIKE ?
            ORDER BY dni_cliente DESC
            LIMIT ? OFFSET ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
        );

        const [[{ total }]] = await db2.query(
            `SELECT COUNT(*) AS total 
            FROM Cliente
            WHERE dni_cliente LIKE ? OR nombre LIKE ? OR apellido LIKE ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
        );
        
        res.json({
            success: true,
            totalClientes: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            pageSize: limit,
            clientes
        });
    } catch (error) {
        console.error('Error al listar clientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la lista de clientes'
        });
    }
};

const editarCliente = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const { dni_cliente } = req.params;
        const {
            nombre,
            apellido,
            email,
            telefono,
            calle,
            numero,
            distrito,
            referencia,
            metodo_pago,
            tipo_entrega,
            notas
        } = req.body;

        // Validar campos requeridos
        if (!nombre || !apellido || !telefono) {
            return res.status(400).json({
                success: false,
                message: 'Los campos nombre, apellido y teléfono son obligatorios'
            });
        }

        if (email) {
            const [existingEmail] = await db2.query(
                'SELECT dni_cliente FROM Cliente WHERE email = ? AND dni_cliente != ?',
                [email, dni_cliente]
            );

            if (existingEmail.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un cliente con este correo electrónico'
                });
            }
        }

        const [result] = await db2.query(
            `UPDATE Cliente 
             SET nombre = ?, 
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
             WHERE dni_cliente = ?`,
            [
                nombre,
                apellido,
                email,
                telefono,
                calle,
                numero,
                distrito,
                referencia,
                metodo_pago,
                tipo_entrega,
                notas,
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
            message: 'Cliente actualizado exitosamente',
            cliente: {
                dni_cliente,
                nombre,
                apellido,
                email,
                telefono,
                calle,
                numero,
                distrito,
                referencia,
                metodo_pago,
                tipo_entrega,
                notas
            }
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
    verificarCliente,
    listarClientes,
    editarCliente
};