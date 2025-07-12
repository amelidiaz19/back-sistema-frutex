const { db2 } = require('../config/database.js');

const getProductosEC = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const searchTerm = req.query.searchTerm || '';
    const offset = (page - 1) * limit;

    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const [productos] = await db2.query(`
            SELECT 
                p.*,
                vp.stock_actual,
                vp.precio_costo_soles,
                vp.precio_caja,
                vp.precio_docena,
                vp.precio_unidad
            FROM Producto p
            INNER JOIN vista_productos vp ON p.id = vp.id
            WHERE (p.codigo LIKE ? OR p.descripcion LIKE ?)
            AND p.estado = "ACTIVO"
            AND vp.stock_actual > 0
            ORDER BY p.nombre
            LIMIT ? OFFSET ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
        );

        const [[{ total }]] = await db2.query(`
            SELECT COUNT(*) AS total 
            FROM Producto p
            INNER JOIN vista_productos vp ON p.id = vp.id
            WHERE (p.codigo LIKE ? OR p.nombre LIKE ?)
            AND p.estado = "ACTIVO"
            AND vp.stock_actual > 0`,
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
        console.error('Error al obtener productos:', err);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};

const getProductosECK = async (req, res) => {
    const keywords = req.query.keywords ? req.query.keywords.split(',') : [];
    const search = req.query.search;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    try {
        let conditions = ['p.estado = "ACTIVO"', 'vp.stock_actual > 0'];
        let params = [];

        // Add keyword conditions if present
        if (keywords.length > 0) {
            const keywordConditions = keywords.map(() => 'FIND_IN_SET(?, p.keywords) > 0');
            conditions.push(`(${keywordConditions.join(' OR ')})`);
            params.push(...keywords);
        }

        // Add search condition if present
        if (search) {
            conditions.push('(p.nombre LIKE ? OR p.codigo LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT 
                p.id,
                p.codigo,
                p.descripcion,
                p.nombre,
                p.estado,
                p.url_slug,
                p.keywords,
                p.alt_texto,
                p.foto,
                p.created_at,
                p.updated_at,
                ROUND(vp.precio_costo_soles, 2) as precio_costo_soles,
                ROUND(vp.precio_caja, 2) as precio_caja,
                ROUND(vp.precio_docena, 2) as precio_docena,
                ROUND(vp.precio_unidad, 2) as precio_unidad,
                vp.stock_actual
            FROM vista_productos vp
            LEFT JOIN Producto p ON vp.id = p.id
            ${whereClause}
            LIMIT ? OFFSET ?
        `;

        const [productos] = await db2.query(query, [...params, limit, offset]);

        // Count total matching products
        const [[{ total }]] = await db2.query(
            `SELECT COUNT(*) AS total 
            FROM vista_productos vp
            LEFT JOIN Producto p ON vp.id = p.id
            ${whereClause}`,
            params
        );

        const totalPages = Math.ceil(total / limit);

        res.json({
            totalProductos: total,
            totalPages,
            currentPage: page,
            pageSize: limit,
            productos
        });

    } catch (err) {
        console.error('Error al obtener productos:', err);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};

const getAllKeywords = async (req, res) => {
    try {
        const [result] = await db2.query(
            `SELECT DISTINCT 
                TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.keywords, ',', numbers.n), ',', -1)) as keyword
            FROM 
                (SELECT 1 + units.i + tens.i * 10 n
                FROM 
                    (SELECT 0 i UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) units,
                    (SELECT 0 i UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) tens
                ) numbers
            INNER JOIN Producto p
            WHERE numbers.n <= 1 + (LENGTH(p.keywords) - LENGTH(REPLACE(p.keywords, ',', '')))
            AND TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.keywords, ',', numbers.n), ',', -1)) != ''
            ORDER BY keyword`
        );

        const keywords = result.map(row => row.keyword);
        res.json(keywords);
    } catch (err) {
        console.error('Error al obtener keywords:', err);
        res.status(500).json({ error: 'Error al obtener keywords' });
    }
};

const getProductoById = async (req, res) => {
    try {
        const [producto] = await db2.query(
            `SELECT 
                p.id,
                p.codigo,
                p.descripcion,
                p.nombre,
                p.estado,
                p.url_slug,
                p.keywords,
                p.alt_texto,
                p.foto,
                p.cajas,
                p.cantidad_por_caja,
                ROUND(vp.precio_caja, 2) as precio_caja,
                ROUND(vp.precio_docena, 2) as precio_docena,
                ROUND(vp.precio_unidad, 2) as precio_unidad,
                vp.stock_actual
            FROM vista_productos vp
            LEFT JOIN Producto p ON vp.id = p.id
            WHERE vp.id = ?`,
            [req.params.id]
        );

        if (producto.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(producto[0]);
    } catch (err) {
        console.error('Error al obtener el producto:', err);
        res.status(500).json({ error: 'Error al obtener el producto' });
    }
};

module.exports = { 
    getProductosEC,
    getProductosECK,
    getAllKeywords,
    getProductoById
};