const { db2 } = require('../config/database.js');

const getProductos = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const searchTerm = req.query.searchTerm || '';
    const offset = (page - 1) * limit;
    const orderStock = req.query.orderStock;

    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const orderClause = orderStock === '1' ? 'ORDER BY stock_actual DESC' : 'ORDER BY id DESC';

        const [productos] = await db2.query(
            `SELECT vp.*, p.id, p.nombre, p.keywords
            FROM vista_productos vp
            LEFT JOIN Producto p ON vp.id = p.id
            WHERE p.codigo LIKE ? OR p.descripcion LIKE ?
            ${orderClause}
            LIMIT ? OFFSET ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
        );

        const [[{ total }]] = await db2.query(
            `SELECT COUNT(*) AS total 
            FROM vista_productos
            WHERE codigo LIKE ? OR descripcion LIKE ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`]
        );

        res.json({
            totalProductos: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            pageSize: limit,
            productos
        });

    } catch (err) {
        console.error('Error al obtener los productos:', err);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};

const getProductosECINFO = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const searchTerm = req.query.searchTerm || '';
    const offset = (page - 1) * limit;
    const orderStock = req.query.orderStock;

    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const orderClause = orderStock === '1' ? 'ORDER BY vp.stock_actual DESC' : 'ORDER BY vp.id DESC';

        const [productos] = await db2.query(
            `SELECT 
                vp.*,
                p.nombre,
                p.estado,
                p.url_slug,
                p.keywords,
                p.alt_texto,
                p.foto,
                p.cajas,
                p.cantidad_por_caja
            FROM vista_productos vp
            INNER JOIN Producto p ON vp.id = p.id
            WHERE vp.codigo LIKE ? OR vp.descripcion LIKE ?
            ${orderClause}
            LIMIT ? OFFSET ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
        );

        const [[{ total }]] = await db2.query(
            `SELECT COUNT(*) AS total 
            FROM vista_productos vp
            INNER JOIN Producto p ON vp.id = p.id
            WHERE vp.codigo LIKE ? OR vp.descripcion LIKE ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`]
        );

        res.json({
            totalProductos: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            pageSize: limit,
            productos
        });

    } catch (err) {
        console.error('Error al obtener los productos:', err);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};

const updateProducto = async (req, res) => {
    const { id } = req.params;
    const {
        codigo,
        nombre,
        descripcion,
        cajas,
        cantidad_por_caja,
        precio_dolares,
        porcentaje_ganancia,
        estado,
        url_slug,
        keywords,
        alt_texto,
        foto
    } = req.body;

    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const [result] = await db2.query(
            `UPDATE Producto 
             SET codigo = ?, 
                 nombre = ?,
                 descripcion = ?,
                 cajas = ?,
                 cantidad_por_caja = ?,
                 precio_dolares = ?,
                 porcentaje_ganancia = ?,
                 estado = ?,
                 url_slug = ?,
                 keywords = ?,
                 alt_texto = ?,
                 foto = ?
             WHERE id = ?`,
            [
                codigo,
                nombre,
                descripcion,
                cajas,
                cantidad_por_caja,
                precio_dolares,
                porcentaje_ganancia,
                estado,
                url_slug,
                keywords,
                alt_texto,
                foto,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                message: 'Producto no encontrado' 
            });
        }

        res.json({ 
            success: true,
            message: 'Producto actualizado correctamente'
        });

    } catch (err) {
        console.error('Error al actualizar el producto:', err);
        res.status(500).json({ 
            error: 'Error al actualizar el producto' 
        });
    }
};

const actualizarStockProducto = async (productos, detalleVenta) => {
    try {
        let estadoInicial;
        if (detalleVenta.tipo_venta === 'web') {
            estadoInicial = detalleVenta.tipo_entrega === 'recojo' ? 'pendiente_recojo' : 'pendiente_envio';
        } else {
            estadoInicial = 'completada';
        }

        // Create single venta record
        const [ventaResult] = await db2.query(
            `INSERT INTO Venta (
                tipo_venta, tipo_entrega, id_pedido, 
                id_usuario, dni_cliente, total, 
                estado, fecha_recojo, local_recojo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                detalleVenta.tipo_venta,
                detalleVenta.tipo_entrega || 'envio',
                detalleVenta.id_pedido || null,
                detalleVenta.id_usuario,
                detalleVenta.dni_cliente,
                detalleVenta.total,
                estadoInicial,
                detalleVenta.recojo?.fecha_recojo || null,
                detalleVenta.recojo?.local || null
            ]
        );

        // Register payments for the entire sale
        for (const pago of detalleVenta.pagos) {
            await db2.query(
                `INSERT INTO VentaPago (
                    id_venta, metodo_pago, monto,
                    estado_pago
                ) VALUES (?, ?, ?, ?)`,
                [
                    ventaResult.insertId,
                    pago.metodo,
                    pago.monto,
                    pago.estado || 'completado'
                ]
            );
        }

        // Process each product
        for (const producto of productos) {
            // Get current product info
            const [productoInfo] = await db2.query(
                `SELECT p.id, p.codigo, p.nombre, p.descripcion, 
                        p.cajas, p.cantidad_por_caja, p.stock_actual
                 FROM Producto p
                 WHERE p.id = ?`,
                [producto.id]
            );

            if (!productoInfo || productoInfo.length === 0) {
                throw new Error(`Producto ${producto.id} no encontrado`);
            }

            const stockActual = productoInfo[0].stock_actual;
            const stockRestante = stockActual - producto.cantidad;
            const cantidadPorCaja = productoInfo[0].cantidad_por_caja;
            const cajasRestantes = Math.ceil(stockRestante / cantidadPorCaja);

            if (stockRestante < 0) {
                throw new Error(`Stock insuficiente para producto ${productoInfo[0].codigo}. Stock actual: ${stockActual}, Solicitado: ${producto.cantidad}`);
            }

            // Create venta detalle
            await db2.query(
                `INSERT INTO VentaDetalle (
                    id_venta, id_producto, cantidad,
                    precio_unitario, tipo_precio, subtotal,
                    stock_anterior, stock_nuevo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    ventaResult.insertId,
                    producto.id,
                    producto.cantidad,
                    producto.precio_unitario,
                    producto.tipo_precio || 'normal',
                    producto.precio_unitario * producto.cantidad,
                    stockActual,
                    stockRestante
                ]
            );

            // Update stock
            await db2.query(
                `UPDATE Producto 
                 SET stock_actual = ?,
                     cajas = ?,
                     updated_at = NOW()
                 WHERE id = ?`,
                [stockRestante, cajasRestantes, producto.id]
            );

            // Register stock movement
            await db2.query(
                `INSERT INTO MovimientoStock (
                    id_producto, tipo_movimiento, cantidad,
                    stock_anterior, stock_nuevo, tipo_venta,
                    id_venta, tipo_entrega
                ) VALUES (?, 'salida', ?, ?, ?, ?, ?, ?)`,
                [
                    producto.id,
                    producto.cantidad,
                    stockActual,
                    stockRestante,
                    detalleVenta.tipo_venta,
                    ventaResult.insertId,
                    detalleVenta.tipo_entrega || 'envio'
                ]
            );
        }

        // Register initial state
        await db2.query(
            `INSERT INTO VentaEstado (
                id_venta, estado, fecha
            ) VALUES (?, ?, NOW())`,
            [ventaResult.insertId, estadoInicial]
        );

        // Get complete sale information
        const [[venta]] = await db2.query(
            `SELECT 
                v.*, 
                COALESCE(c.nombre, 'Cliente Genérico') as nombre_cliente,
                COALESCE(c.email, 'clientedefault@correo.com') as email_cliente,
                COALESCE(c.telefono, '000000000') as telefono,
                CONCAT(u.nombre, ' ', u.apellido) as nombre_usuario,
                u.email as email_usuario
            FROM Venta v
            LEFT JOIN Cliente c ON v.dni_cliente = c.dni_cliente
            LEFT JOIN Usuario u ON v.id_usuario = u.id_usuario
            WHERE v.id_venta = ?`,
            [ventaResult.insertId]
        );

        // Get sale details
        const [productos_venta] = await db2.query(
            `SELECT 
                vd.*, 
                p.codigo, 
                p.nombre, 
                p.descripcion
            FROM VentaDetalle vd
            JOIN Producto p ON vd.id_producto = p.id
            WHERE vd.id_venta = ?`,
            [ventaResult.insertId]
        );

        // Get payments
        const [pagos] = await db2.query(
            `SELECT * FROM VentaPago WHERE id_venta = ?`,
            [ventaResult.insertId]
        );

        // Get stock movements
        const [movimientos] = await db2.query(
            `SELECT * FROM MovimientoStock WHERE id_venta = ?`,
            [ventaResult.insertId]
        );

        return {
            success: true,
            venta: {
                ...venta,
                productos: productos_venta,
                pagos,
                movimientos
            }
        };

    } catch (error) {
        console.error('Error al actualizar stock:', error);
        throw error;
    }
};


module.exports = { 
    getProductos,
    updateProducto,
    getProductosECINFO,
    actualizarStockProducto
};