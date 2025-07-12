const { db2 } = require('../config/database.js');

const getCuadreDiario = async (req, res) => {
    const { fecha } = req.query;
    const fechaInicio = fecha ? fecha : new Date().toISOString().split('T')[0];
    
    try {
        // First, get the main summary
        const [resumenGeneral] = await db2.query(
            `SELECT 
                DATE(v.fecha_venta) as fecha,
                COUNT(DISTINCT v.id_venta) as total_ventas,
                SUM(v.total) as venta_total
            FROM Venta v
            WHERE DATE(v.fecha_venta) = ?
            GROUP BY DATE(v.fecha_venta)`,
            [fechaInicio]
        );

        // Get payment methods summary
        const [resumenPagos] = await db2.query(
            `SELECT 
                vp.metodo_pago,
                SUM(vp.monto) as total,
                COUNT(vp.id) as cantidad_transacciones
            FROM VentaPago vp
            JOIN Venta v ON vp.id_venta = v.id_venta
            WHERE DATE(v.fecha_venta) = ?
            GROUP BY vp.metodo_pago`,
            [fechaInicio]
        );

        // Get detailed sales
        const [detalleVentas] = await db2.query(
            `SELECT 
                v.id_venta,
                TIME(v.fecha_venta) as hora,
                v.total,
                v.tipo_venta,
                CONCAT(c.nombre, ' ', c.apellido) as cliente,
                CONCAT(u.nombre, ' ', u.apellido) as vendedor,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'metodo', vp.metodo_pago,
                            'monto', vp.monto
                        )
                    )
                    FROM VentaPago vp
                    WHERE vp.id_venta = v.id_venta
                ) as metodos_pago,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'nombre', p.nombre,
                            'cantidad', vd.cantidad,
                            'precio_unitario', vd.precio_unitario,
                            'subtotal', vd.subtotal
                        )
                    )
                    FROM VentaDetalle vd
                    JOIN Producto p ON vd.id_producto = p.id
                    WHERE vd.id_venta = v.id_venta
                ) as productos
            FROM Venta v
            LEFT JOIN Cliente c ON v.dni_cliente = c.dni_cliente
            LEFT JOIN Usuario u ON v.id_usuario = u.id_usuario
            WHERE DATE(v.fecha_venta) = ?
            ORDER BY v.fecha_venta`,
            [fechaInicio]
        );

        // Process the results
        const resumen = {
            fecha: fechaInicio,
            total_ventas: resumenGeneral?.[0]?.total_ventas || 0,
            venta_total: resumenGeneral?.[0]?.venta_total || 0,
            resumen_pagos: resumenPagos || [],
            detalle_ventas: detalleVentas.map(venta => ({
                ...venta,
                metodos_pago: JSON.parse(venta.metodos_pago || '[]'),
                productos: JSON.parse(venta.productos || '[]')
            }))
        };

        res.json({
            success: true,
            resumen
        });

    } catch (error) {
        console.error('Error al obtener el cuadre diario:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener el cuadre diario' 
        });
    }
};

const getCuadrePorRango = async (req, res) => {
    const { fechaInicio, fechaFin } = req.query;
    
    try {
        // Get daily summary and sales detail
        const [resumenDiario] = await db2.query(
            `SELECT 
                DATE(v.fecha_venta) as fecha,
                COUNT(DISTINCT v.id_venta) as total_ventas,
                SUM(v.total) as venta_total,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'hora', TIME(v.fecha_venta),
                        'total', v.total,
                        'cliente', CONCAT(c.nombre, ' ', c.apellido),
                        'vendedor', CONCAT(u.nombre, ' ', u.apellido),
                        'tipo_venta', v.tipo_venta,
                        'metodos_pago', (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'metodo', vp.metodo_pago,
                                    'monto', vp.monto
                                )
                            )
                            FROM VentaPago vp
                            WHERE vp.id_venta = v.id_venta
                        ),
                        'productos', (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'nombre', p.nombre,
                                    'cantidad', vd.cantidad,
                                    'precio_unitario', vd.precio_unitario,
                                    'subtotal', vd.subtotal
                                )
                            )
                            FROM VentaDetalle vd
                            JOIN Producto p ON vd.id_producto = p.id
                            WHERE vd.id_venta = v.id_venta
                        )
                    )
                ) as ventas_del_dia
            FROM Venta v
            LEFT JOIN Cliente c ON v.dni_cliente = c.dni_cliente
            LEFT JOIN Usuario u ON v.id_usuario = u.id_usuario
            WHERE DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY DATE(v.fecha_venta)
            ORDER BY fecha`,
            [fechaInicio, fechaFin]
        );

        // Get payment methods summary for each day
        const [resumenPagos] = await db2.query(
            `SELECT 
                DATE(v.fecha_venta) as fecha,
                vp.metodo_pago,
                SUM(vp.monto) as total,
                COUNT(vp.id) as cantidad_transacciones
            FROM VentaPago vp
            JOIN Venta v ON vp.id_venta = v.id_venta
            WHERE DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY DATE(v.fecha_venta), vp.metodo_pago
            ORDER BY fecha, metodo_pago`,
            [fechaInicio, fechaFin]
        );

        // Process and combine the results
        const resumen = resumenDiario.map(dia => {
            const pagosDia = resumenPagos.filter(pago => 
                pago.fecha.toISOString().split('T')[0] === dia.fecha.toISOString().split('T')[0]
            );
            
            return {
                fecha: dia.fecha,
                total_ventas: dia.total_ventas,
                venta_total: dia.venta_total,
                resumen_pagos: pagosDia,
                ventas: JSON.parse(dia.ventas_del_dia || '[]')
            };
        });

        res.json({
            success: true,
            fechaInicio,
            fechaFin,
            resumen
        });

    } catch (error) {
        console.error('Error al obtener el cuadre por rango:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener el cuadre por rango' 
        });
    }
};

const getResumenMetodosPago = async (req, res) => {
    const { fecha } = req.query;
    const fechaInicio = fecha ? fecha : new Date().toISOString().split('T')[0];

    try {
        const [resultado] = await db2.query(
            `SELECT 
                vp.metodo_pago,
                COUNT(DISTINCT vp.id_venta) as cantidad_ventas,
                SUM(vp.monto) as total,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id_venta', v.id_venta,
                        'monto', vp.monto,
                        'hora', TIME(v.fecha_venta),
                        'cliente', CONCAT(c.nombre, ' ', c.apellido)
                    )
                ) as detalle_ventas
            FROM VentaPago vp
            JOIN Venta v ON vp.id_venta = v.id_venta
            LEFT JOIN Cliente c ON v.dni_cliente = c.dni_cliente
            WHERE DATE(v.fecha_venta) = ?
            GROUP BY vp.metodo_pago`,
            [fechaInicio]
        );

        const resumen = resultado.map(metodo => ({
            ...metodo,
            detalle_ventas: JSON.parse(metodo.detalle_ventas || '[]')
        }));

        res.json({
            success: true,
            fecha: fechaInicio,
            resumen
        });

    } catch (error) {
        console.error('Error al obtener el resumen por métodos de pago:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener el resumen por métodos de pago' 
        });
    }
};

const getVentasPorVendedor = async (req, res) => {
    const { fecha } = req.query;
    const fechaInicio = fecha ? fecha : new Date().toISOString().split('T')[0];

    try {
        const [resultado] = await db2.query(
            `SELECT 
                u.id_usuario,
                CONCAT(u.nombre, ' ', u.apellido) as vendedor,
                COUNT(DISTINCT v.id_venta) as total_ventas,
                SUM(v.total) as venta_total,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id_venta', v.id_venta,
                        'hora', TIME(v.fecha_venta),
                        'total', v.total,
                        'cliente', CONCAT(c.nombre, ' ', c.apellido),
                        'tipo_venta', v.tipo_venta
                    )
                ) as detalle_ventas
            FROM Venta v
            JOIN Usuario u ON v.id_usuario = u.id_usuario
            LEFT JOIN Cliente c ON v.dni_cliente = c.dni_cliente
            WHERE DATE(v.fecha_venta) = ?
            GROUP BY u.id_usuario`,
            [fechaInicio]
        );

        const resumen = resultado.map(vendedor => ({
            ...vendedor,
            detalle_ventas: JSON.parse(vendedor.detalle_ventas || '[]')
        }));

        res.json({
            success: true,
            fecha: fechaInicio,
            resumen
        });

    } catch (error) {
        console.error('Error al obtener las ventas por vendedor:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener las ventas por vendedor' 
        });
    }
};

module.exports = {
    getCuadreDiario,
    getCuadrePorRango,
    getResumenMetodosPago,
    getVentasPorVendedor
};