const express = require('express');
const router = express.Router();
const { 
    getProductos,
    updateProducto,
    getProductosECINFO,
    actualizarStockProducto
} = require('../controllers/productos.controller.js');
const { verificarTokenEmpleado } = require('../config/auth.middleware.js');

router.get('/', verificarTokenEmpleado, getProductos);
router.get('/sis', verificarTokenEmpleado, getProductosECINFO);
router.put('/actualizar/:id', verificarTokenEmpleado, updateProducto);
router.put('/stock', verificarTokenEmpleado, async (req, res) => {
    try {
        const { productos, detalleVenta } = req.body;

        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Los productos son requeridos y deben ser un array no vacío' 
            });
        }

        // Validate required fields for sale
        if (!detalleVenta.tipo_venta || !detalleVenta.dni_cliente || !detalleVenta.pagos) {
            return res.status(400).json({
                success: false,
                message: 'Faltan datos requeridos para la venta'
            });
        }

        // Add user ID from the authenticated request
        detalleVenta.id_usuario = req.usuario.id;

        // Calculate total amount for all products
        const total = productos.reduce((sum, prod) => 
            sum + (prod.precio_unitario * prod.cantidad), 0);
        detalleVenta.total = total;

        // Process all products in a single sale
        const resultado = await actualizarStockProducto(productos, detalleVenta);

        res.json({ 
            success: true, 
            message: 'Venta registrada y stock actualizado correctamente',
            data: resultado
        });
    } catch (error) {
        console.error('Error en la ruta de venta:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error al procesar la venta',
            error: error.message 
        });
    }
});

module.exports = router;