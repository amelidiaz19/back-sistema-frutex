const { db2 } = require('../config/database.js');
const { actualizarStockProducto } = require('./productos.controller.js');

const crearPedido = async (req, res) => {
    try {
        const dniCliente = req.cliente.id;

        const { dni_cliente } = req.params;

        if (dni_cliente && dni_cliente !== dniCliente) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para acceder a este perfil'
            });
        }

        const { items, total, metodoPago, tipoEntrega, notas, direccion } = req.body;

        // Create order
        const [result] = await db2.query(
            `INSERT INTO Pedido (
                dni_cliente, total, metodo_pago, tipo_entrega, notas,
                calle, numero, distrito, referencia
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                dniCliente, 
                Number(total) || 0, 
                metodoPago, 
                tipoEntrega, 
                notas || '',
                direccion?.calle || '',
                direccion?.numero || '',
                direccion?.distrito || '',
                direccion?.referencia || ''
            ]
        );

        const idPedido = result.insertId;

        // Create order details
        for (const item of items) {
            const subtotal = Number(item.precio_unitario) * Number(item.cantidad);
            await db2.query(
                `INSERT INTO DetallePedido (
                    id_pedido, id_producto, cantidad, 
                    precio_unitario, tipo_venta, subtotal
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    idPedido,
                    Number(item.id_producto),
                    Number(item.cantidad),
                    Number(item.precio_unitario),
                    item.tipo_venta,
                    subtotal
                ]
            );
        }

        res.status(201).json({
            success: true,
            message: 'Pedido creado exitosamente',
            idPedido
        });

    } catch (error) {
        console.error('Error al crear pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear el pedido'
        });
    }
};

const obtenerPedidosCliente = async (req, res) => {
    try {
        const dniCliente = req.cliente.id;
        const { dni_cliente } = req.params;

        if (dni_cliente && dni_cliente !== dniCliente) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para acceder a este perfil'
            });
        }

        const [pedidos] = await db2.query(
            `SELECT p.*, 
                    dp.id_producto, dp.cantidad, dp.precio_unitario, 
                    dp.tipo_venta, dp.subtotal,
                    pr.nombre as nombre_producto
             FROM Pedido p
             LEFT JOIN DetallePedido dp ON p.id_pedido = dp.id_pedido
             LEFT JOIN Producto pr ON dp.id_producto = pr.id
             WHERE p.dni_cliente = ?
             ORDER BY p.fecha_creacion DESC`,
            [dniCliente]
        );

        // Group order details by order
        const pedidosAgrupados = pedidos.reduce((acc, row) => {
            if (!acc[row.id_pedido]) {
                acc[row.id_pedido] = {
                    id: row.id_pedido,
                    fecha: row.fecha_creacion,
                    estado: row.estado,
                    total: row.total,
                    metodoPago: row.metodo_pago,
                    tipoEntrega: row.tipo_entrega,
                    notas: row.notas,
                    direccion: {
                        calle: row.calle || '',
                        numero: row.numero || '',
                        distrito: row.distrito || '',
                        referencia: row.referencia || ''
                    },
                    items: []
                };
            }
            if (row.id_producto) {
                acc[row.id_pedido].items.push({
                    id_producto: row.id_producto,
                    nombre: row.nombre_producto,
                    cantidad: row.cantidad,
                    precio_unitario: row.precio_unitario,
                    tipo_venta: row.tipo_venta,
                    subtotal: row.subtotal
                });
            }
            return acc;
        }, {});

        res.json({
            success: true,
            pedidos: Object.values(pedidosAgrupados)
        });

    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los pedidos'
        });
    }
};

const obtenerTodosPedidos = async (req, res) => {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const searchTerm = req.query.searchTerm || '';
        const offset = (page - 1) * limit;

        const [pedidos] = await db2.query(
            `SELECT p.*, 
                    c.nombre, c.apellido, c.email, c.telefono,
                    dp.id_producto, dp.cantidad, dp.precio_unitario, 
                    dp.tipo_venta, dp.subtotal,
                    pr.nombre as nombre_producto
             FROM pedido p
             JOIN cliente c ON p.dni_cliente = c.dni_cliente
             LEFT JOIN detallepedido dp ON p.id_pedido = dp.id_pedido
             LEFT JOIN producto pr ON dp.id_producto = pr.id
             WHERE p.id_pedido LIKE ? 
                OR c.nombre LIKE ? 
                OR c.apellido LIKE ?
                OR c.dni_cliente LIKE ?
             GROUP BY p.id_pedido, p.fecha_creacion, p.estado, p.total, p.metodo_pago, 
                      p.tipo_entrega, p.notas, p.calle, p.numero, p.distrito, p.referencia,
                      p.dni_cliente, c.nombre, c.apellido, c.email, c.telefono,
                      dp.id_producto, dp.cantidad, dp.precio_unitario, dp.tipo_venta, dp.subtotal,
                      pr.nombre
             ORDER BY p.fecha_creacion DESC
             LIMIT ? OFFSET ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
        );

        const [[{ total }]] = await db2.query(
            `SELECT COUNT(DISTINCT p.id_pedido) as total
             FROM Pedido p
             JOIN Cliente c ON p.dni_cliente = c.dni_cliente
             WHERE p.id_pedido LIKE ? 
                OR c.nombre LIKE ? 
                OR c.apellido LIKE ?
                OR c.dni_cliente LIKE ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
        );

        const pedidosAgrupados = pedidos.reduce((acc, row) => {
            if (!acc[row.id_pedido]) {
                acc[row.id_pedido] = {
                    id: row.id_pedido,
                    fecha: row.fecha_creacion,
                    estado: row.estado,
                    total: row.total,
                    metodoPago: row.metodo_pago,
                    tipoEntrega: row.tipo_entrega,
                    notas: row.notas,
                    direccion: {
                        calle: row.calle || '',
                        numero: row.numero || '',
                        distrito: row.distrito || '',
                        referencia: row.referencia || ''
                    },
                    cliente: {
                        dni: row.dni_cliente,
                        nombre: row.nombre,
                        apellido: row.apellido,
                        email: row.email,
                        telefono: row.telefono
                    },
                    items: []
                };
            }
            if (row.id_producto) {
                acc[row.id_pedido].items.push({
                    id_producto: row.id_producto,
                    nombre: row.nombre_producto,
                    cantidad: row.cantidad,
                    precio_unitario: row.precio_unitario,
                    tipo_venta: row.tipo_venta,
                    subtotal: row.subtotal
                });
            }
            return acc;
        }, {});

        res.json({
            success: true,
            totalPedidos: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            pageSize: limit,
            pedidos: Object.values(pedidosAgrupados)
        });

    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los pedidos'
        });
    }
};

const actualizarEstadoPedido = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        // Validate estado values
        const estadosValidos = ['en_proceso', 'confirmado', 'entregado', 'anulado'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                message: 'Estado no válido'
            });
        }

        const [result] = await db2.query(
            'UPDATE Pedido SET estado = ? WHERE id_pedido = ?',
            [estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }

        if (estado === 'entregado') {
            // Get complete order and customer details
            const [[pedido]] = await db2.query(
                `SELECT p.*, c.dni_cliente, c.nombre, c.apellido, c.email, c.telefono
                FROM Pedido p
                JOIN Cliente c ON p.dni_cliente = c.dni_cliente
                WHERE p.id_pedido = ?`,
                [id]
            );

            // Get order details with product info
            const [detalles] = await db2.query(
                `SELECT dp.*, p.nombre as nombre_producto
                FROM DetallePedido dp
                JOIN Producto p ON dp.id_producto = p.id
                WHERE dp.id_pedido = ?`,
                [id]
            );
        
            // Prepare products array
            const productos = detalles.map(detalle => ({
                id: detalle.id_producto,
                cantidad: detalle.cantidad,
                precio_unitario: detalle.precio_unitario,
                tipo_precio: detalle.tipo_venta
            }));

            const detalleVenta = {
                tipo_venta: 'web',
                tipo_entrega: pedido.tipo_entrega,
                id_pedido: pedido.id_pedido,
                id_usuario: req.usuario.id,
                dni_cliente: pedido.dni_cliente,
                total: pedido.total,
                pagos: [{
                    metodo: pedido.metodo_pago,
                    monto: pedido.total,
                    estado: 'completado'
                }]
            };

            // Add delivery info if applicable
            if (pedido.tipo_entrega === 'recojo') {
                detalleVenta.recojo = {
                    fecha_recojo: pedido.fecha_recojo || new Date(),
                    local: pedido.local_recojo || 'principal'
                };
            }

            const ventaResult = await actualizarStockProducto(productos, detalleVenta);

            // Update sale status to completed
            if (ventaResult.venta.id_venta) {
                await db2.query(
                    `UPDATE Venta SET estado = 'completada' WHERE id_venta = ?`,
                    [ventaResult.venta.id_venta]
                );
                
                await db2.query(
                    `INSERT INTO VentaEstado (id_venta, estado, fecha) 
                     VALUES (?, 'completada', NOW())`,
                    [ventaResult.venta.id_venta]
                );
            }
        }

        res.json({
            success: true,
            message: 'Estado del pedido actualizado correctamente'
        });

    } catch (error) {
        console.error('Error al actualizar estado del pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el estado del pedido'
        });
    }
};

module.exports = {
    crearPedido,
    obtenerPedidosCliente,
    obtenerTodosPedidos,
    actualizarEstadoPedido
};