const { db2 } = require('../config/database.js');

const generateSlug = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const registrarProducto = async (req, res) => {
    try {
        const { productos, empleado_id } = req.body;

        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de productos'
            });
        }

        try {
            const registeredProducts = [];

            for (const producto of productos) {
                const {
                    id,
                    codigo,
                    nombre,
                    descripcion,
                    keywords,
                    cajas,
                    cantidad_por_caja,
                    precio_dolares,
                    porcentaje_ganancia,
                    foto,
                    alt_texto,
                    estado
                } = producto;

                const stock_actual = cajas * cantidad_por_caja;

                let productId;

                if (id) {
                    // Update existing product
                    await db2.query(
                        'UPDATE Producto SET cajas = cajas + ?, stock_actual = stock_actual + ? WHERE id = ?',
                        [cajas, stock_actual, id]
                    );
                    productId = id;
                } else {
                    // Insert new product
                    const url_slug = generateSlug(nombre);
                    const [productResult] = await db2.query(
                        'INSERT INTO Producto (codigo, nombre, descripcion, url_slug, keywords, cajas, cantidad_por_caja, precio_dolares, porcentaje_ganancia, foto, alt_texto, estado, stock_actual, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
                        [codigo, nombre, descripcion, url_slug, keywords, cajas, cantidad_por_caja, precio_dolares, porcentaje_ganancia, foto, alt_texto, estado, stock_actual]
                    );
                    productId = productResult.insertId;
                }

                // Calculate total value for history
                const total_valor = cajas * cantidad_por_caja * precio_dolares;

                // Insert entry history
                await db2.query(
                    'INSERT INTO Almacen (producto_id, usuario_id, cantidad_cajas, cantidad_por_caja, precio_unitario, total_valor, fecha_ingreso) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                    [productId, empleado_id, cajas, cantidad_por_caja, precio_dolares, total_valor]
                );

                registeredProducts.push({
                    productId,
                    codigo,
                    nombre,
                    cajas
                });
            }

            res.status(201).json({
                success: true,
                message: 'Productos procesados exitosamente con su historial de ingreso',
                products: registeredProducts
            });

        } catch (error) {
            throw error;
        }

    } catch (error) {
        console.error('Error al procesar productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar los productos',
            error: error.message
        });
    }
};

const obtenerHistorial = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const searchTerm = req.query.searchTerm || '';
    const offset = (page - 1) * limit;

    try {
        const [historial] = await db2.query(`
            SELECT 
                h.id,
                h.fecha_ingreso,
                h.cantidad_cajas,
                h.cantidad_por_caja,
                h.precio_unitario,
                h.total_valor,
                p.codigo as producto_codigo,
                p.nombre as producto_nombre,
                e.nombre as empleado_nombre,
                e.apellido as empleado_apellido
            FROM Almacen h
            INNER JOIN Producto p ON h.producto_id = p.id
            INNER JOIN Usuario e ON h.usuario_id = e.id_usuario
            WHERE p.codigo LIKE ? OR p.nombre LIKE ?
            ORDER BY h.fecha_ingreso DESC
            LIMIT ? OFFSET ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
        );

        const [[{ total }]] = await db2.query(`
            SELECT COUNT(*) as total
            FROM Almacen h
            INNER JOIN Producto p ON h.producto_id = p.id
            WHERE p.codigo LIKE ? OR p.nombre LIKE ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`]
        );

        res.json({
            success: true,
            totalRegistros: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            pageSize: limit,
            data: historial
        });

    } catch (error) {
        console.error('Error al obtener historial de ingresos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el historial de ingresos',
            error: error.message
        });
    }
};

module.exports = {
    registrarProducto,
    obtenerHistorial
};