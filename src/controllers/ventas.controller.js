const { db2 } = require('../config/database.js');

const getVentas = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const tipoVenta = req.query.tipoVenta;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const searchTerm = req.query.searchTerm || '';

    try {
        let whereClause = '';
        let params = [];

        if (searchTerm) {
            whereClause += ` AND (v.id_venta LIKE ? OR CONCAT(c.nombre, ' ', c.apellido) LIKE ?)`;
            params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }

        if (tipoVenta) {
            whereClause += ' AND v.tipo_venta = ?';
            params.push(tipoVenta);
        }

        if (startDate && endDate) {
            whereClause += ' AND DATE(v.fecha_venta) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        // Rest of the query remains the same
        const [ventas] = await db2.query(
            `SELECT 
                v.id_venta,
                v.fecha_venta,
                v.tipo_venta,
                v.total,
                v.estado,
                c.dni_cliente,
                CONCAT(c.nombre, ' ', c.apellido) as nombre_cliente,
                u.id_usuario,
                CONCAT(u.nombre, ' ', u.apellido) as nombre_usuario,
                GROUP_CONCAT(DISTINCT vp.metodo_pago) as metodos_pago,
                COALESCE(
                    JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id_producto', p.id,
                            'codigo', p.codigo,
                            'nombre', p.nombre,
                            'cantidad', vd.cantidad,
                            'precio_unitario', vd.precio_unitario,
                            'subtotal', vd.subtotal
                        )
                    ),
                    JSON_ARRAY()
                ) as productos,
                COALESCE(
                    JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'metodo_pago', vp.metodo_pago,
                            'monto', vp.monto
                        )
                    ),
                    JSON_ARRAY()
                ) as pagos
            FROM Venta v
            LEFT JOIN Cliente c ON v.dni_cliente = c.dni_cliente
            LEFT JOIN Usuario u ON v.id_usuario = u.id_usuario
            LEFT JOIN VentaPago vp ON v.id_venta = vp.id_venta
            LEFT JOIN VentaDetalle vd ON v.id_venta = vd.id_venta
            LEFT JOIN Producto p ON vd.id_producto = p.id
            WHERE 1=1 ${whereClause}
            GROUP BY 
                v.id_venta, 
                v.fecha_venta,
                v.tipo_venta,
                v.total,
                v.estado,
                c.dni_cliente,
                c.nombre,
                c.apellido,
                u.id_usuario,
                u.nombre,
                u.apellido
            ORDER BY v.fecha_venta DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Parse JSON strings to objects
        const ventasProcessed = ventas.map(venta => ({
            ...venta,
            productos: typeof venta.productos === 'string' ? JSON.parse(venta.productos) : venta.productos,
            pagos: typeof venta.pagos === 'string' ? JSON.parse(venta.pagos) : venta.pagos,
        }));

        // Update count query to include search term
        const [[{ total }]] = await db2.query(
            `SELECT COUNT(DISTINCT v.id_venta) as total
             FROM Venta v
             LEFT JOIN Cliente c ON v.dni_cliente = c.dni_cliente
             WHERE 1=1 ${whereClause}`,
            params
        );

        res.json({
            success: true,
            totalVentas: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            pageSize: limit,
            ventas: ventasProcessed
        });

    } catch (error) {
        console.error('Error al obtener las ventas:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener las ventas' 
        });
    }
};

const getDetalleVenta = async (req, res) => {
    const { id } = req.params;

    try {
        const [[venta]] = await db2.query(
            `SELECT 
                v.*,
                CONCAT(c.nombre, ' ', c.apellido) as nombre_cliente,
                c.email as email_cliente,
                c.telefono,
                c.calle,
                c.numero,
                c.distrito,
                c.referencia,
                c.tipo_entrega as preferencia_entrega,
                CONCAT(u.nombre, ' ', u.apellido) as nombre_usuario,
                u.email as email_usuario,
                COALESCE(
                    JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', vd.id,
                            'id_venta', vd.id_venta,
                            'id_producto', vd.id_producto,
                            'cantidad', vd.cantidad,
                            'precio_unitario', vd.precio_unitario,
                            'tipo_precio', vd.tipo_precio,
                            'subtotal', vd.subtotal,
                            'stock_anterior', vd.stock_anterior,
                            'stock_nuevo', vd.stock_nuevo,
                            'codigo', p.codigo,
                            'nombre', p.nombre,
                            'descripcion', p.descripcion
                        )
                    ),
                    JSON_ARRAY()
                ) as productos,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', vp.id,
                            'id_venta', vp.id_venta,
                            'metodo_pago', vp.metodo_pago,
                            'monto', vp.monto,
                            'estado_pago', vp.estado_pago,
                            'fecha_pago', vp.fecha_pago
                        )
                    )
                    FROM VentaPago vp
                    WHERE vp.id_venta = v.id_venta
                ) as pagos,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', ms.id,
                            'id_producto', ms.id_producto,
                            'tipo_movimiento', ms.tipo_movimiento,
                            'cantidad', ms.cantidad,
                            'stock_anterior', ms.stock_anterior,
                            'stock_nuevo', ms.stock_nuevo,
                            'tipo_venta', ms.tipo_venta,
                            'id_venta', ms.id_venta,
                            'tipo_entrega', ms.tipo_entrega,
                            'fecha_movimiento', ms.fecha_movimiento
                        )
                    )
                    FROM MovimientoStock ms
                    WHERE ms.id_venta = v.id_venta
                    ORDER BY ms.fecha_movimiento
                ) as movimientos
            FROM Venta v
            LEFT JOIN Cliente c ON v.dni_cliente = c.dni_cliente
            LEFT JOIN Usuario u ON v.id_usuario = u.id_usuario
            LEFT JOIN VentaDetalle vd ON v.id_venta = vd.id_venta
            LEFT JOIN Producto p ON vd.id_producto = p.id
            WHERE v.id_venta = ?
            GROUP BY 
                v.id_venta,
                v.tipo_venta,
                v.tipo_entrega,
                v.id_pedido,
                v.id_usuario,
                v.dni_cliente,
                v.total,
                v.estado,
                v.fecha_venta,
                v.fecha_recojo,
                v.local_recojo,
                c.nombre,
                c.apellido,
                c.email,
                c.telefono,
                c.calle,
                c.numero,
                c.distrito,
                c.referencia,
                c.tipo_entrega,
                u.nombre,
                u.apellido,
                u.email`,
            [id]
        );

        if (!venta) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada'
            });
        }

        // Parse JSON strings
        //venta.productos = JSON.parse(venta.productos || '[]');
        //venta.pagos = JSON.parse(venta.pagos || '[]');
        //venta.movimientos = JSON.parse(venta.movimientos || '[]');

        venta.productos= typeof venta.productos === 'string' ? JSON.parse(venta.productos) : venta.productos,
        venta.pagos= typeof venta.pagos === 'string' ? JSON.parse(venta.pagos) : venta.pagos,
        venta.movimientos = typeof venta.movimientos  === 'string' ? JSON.parse(venta.movimientos) : venta.movimientos;

        res.json({
            success: true,
            venta
        });

    } catch (error) {
        console.error('Error al obtener el detalle de la venta:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener el detalle de la venta' 
        });
    }
};

module.exports = {
    getVentas,
    getDetalleVenta
};