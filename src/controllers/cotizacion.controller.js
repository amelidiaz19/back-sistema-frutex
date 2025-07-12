const { db2 } = require('../config/database.js');

const obtenerCotizaciones = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const searchTerm = req.query.searchTerm || '';
    const offset = (page - 1) * limit;

    try {
        const [cotizaciones] = await db2.query(
            `SELECT c.*, u.nombre as vendedor_nombre 
             FROM Cotizaciones c 
             LEFT JOIN Usuario u ON c.vendedor_id = u.id_usuario 
             WHERE c.cliente_nombre LIKE ? OR c.cliente_documento LIKE ?
             ORDER BY c.fecha_creacion DESC
             LIMIT ? OFFSET ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
        );

        const [[{ total }]] = await db2.query(
            `SELECT COUNT(*) AS total 
             FROM Cotizaciones c
             WHERE c.cliente_nombre LIKE ? OR c.cliente_documento LIKE ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`]
        );

        res.json({
            success: true,
            totalCotizaciones: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            pageSize: limit,
            cotizaciones
        });

    } catch (error) {
        console.error('Error al obtener cotizaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las cotizaciones'
        });
    }
};

const obtenerDetalleCotizacion = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const { id } = req.params;

        const [cotizacion] = await db2.query(
            `SELECT c.*, u.nombre as vendedor_nombre 
             FROM Cotizaciones c 
             LEFT JOIN Usuario u ON c.vendedor_id = u.id_usuario 
             WHERE c.id = ?`,
            [id]
        );

        if (!cotizacion.length) {
            return res.status(404).json({
                success: false,
                message: 'Cotización no encontrada'
            });
        }

        const [detalles] = await db2.query(
            `SELECT d.*, p.descripcion as producto_nombre, p.codigo as producto_codigo
             FROM DetalleCotizacion d 
             LEFT JOIN Producto p ON d.producto_id = p.id 
             WHERE d.cotizacion_id = ?`,
            [id]
        );

        res.json({
            success: true,
            cotizacion: cotizacion[0],
            detalles
        });

    } catch (error) {
        console.error('Error al obtener detalle de cotización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el detalle de la cotización'
        });
    }
};

const guardarCotizacion = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const connection = await db2.getConnection();

    try {
        const {
            productos,
            dni_cliente,
            vendedor_id,
            cliente_nombre,
            cliente_telefono,
            observaciones = ''
        } = req.body;

        if (!productos || !productos.length || !dni_cliente || !vendedor_id) {
            return res.status(400).json({
                success: false,
                error: 'Faltan datos requeridos para la cotización'
            });
        }

        const total_amount = productos.reduce((sum, p) => sum + p.precio_total, 0);

        await connection.beginTransaction();

        try {
            const [cotizacionResult] = await connection.query(
                `INSERT INTO Cotizaciones (
                    cliente_documento,
                    cliente_nombre,
                    cliente_telefono,
                    vendedor_id,
                    total_amount,
                    observaciones,
                    fecha_creacion
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [
                    dni_cliente,
                    cliente_nombre,
                    cliente_telefono,
                    vendedor_id,
                    total_amount,
                    observaciones
                ]
            );

            const cotizacionId = cotizacionResult.insertId;

            for (const producto of productos) {
                await connection.query(
                    `INSERT INTO DetalleCotizacion (
                        cotizacion_id,
                        producto_id,
                        cantidad,
                        tipo_venta,
                        precio_unitario,
                        precio_total,
                        descripcion_personalizada,
                        precio_original_unidad,
                        precio_original_docena,
                        precio_original_caja,
                        precio_costo
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        cotizacionId,
                        producto.producto_id,
                        producto.cantidad,
                        producto.tipo_venta,
                        producto.precio_unitario,
                        producto.precio_total,
                        producto.descripcion_personalizada || '',
                        producto.product.precio_unidad,
                        producto.product.precio_docena,
                        producto.product.precio_caja,
                        producto.product.precio_costo_soles
                    ]
                );
            }

            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Cotización guardada exitosamente',
                data: {
                    id: cotizacionId,
                    cliente_documento: dni_cliente,
                    cliente_nombre,
                    total_amount,
                    fecha_creacion: new Date(),
                    productos: productos.length
                }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error al guardar cotización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al guardar la cotización',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

const actualizarEstadoCotizacion = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (!estado) {
            return res.status(400).json({
                success: false,
                message: 'El estado es requerido'
            });
        }

        const [result] = await db2.query(
            'UPDATE cotizaciones SET estado = ? WHERE id = ?',
            [estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cotización no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Estado de cotización actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar estado de cotización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el estado de la cotización'
        });
    }
};

module.exports = {
    obtenerCotizaciones,
    obtenerDetalleCotizacion,
    guardarCotizacion,
    actualizarEstadoCotizacion
};