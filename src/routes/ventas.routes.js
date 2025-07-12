const express = require('express');
const router = express.Router();
const { 
    getVentas,
    getDetalleVenta
} = require('../controllers/ventas.controller.js');
const { verificarTokenEmpleado } = require('../config/auth.middleware.js');

router.get('/', verificarTokenEmpleado, getVentas);
router.get('/:id', verificarTokenEmpleado, getDetalleVenta);

module.exports = router;