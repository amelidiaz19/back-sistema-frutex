const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/caja.controller');
const { verificarTokenEmpleado } = require('../config/auth.middleware');

router.get('/cuadre-diario', verificarTokenEmpleado, cajaController.getCuadreDiario);
router.get('/cuadre-rango', verificarTokenEmpleado, cajaController.getCuadrePorRango);
router.get('/resumen-metodos-pago', verificarTokenEmpleado, cajaController.getResumenMetodosPago);
router.get('/ventas-por-vendedor', verificarTokenEmpleado, cajaController.getVentasPorVendedor);

// Exportar el router
module.exports = router;