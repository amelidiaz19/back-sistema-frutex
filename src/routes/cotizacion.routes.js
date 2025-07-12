const express = require('express');
const router = express.Router();
const { 
    guardarCotizacion, 
    obtenerCotizaciones, 
    obtenerDetalleCotizacion
} = require('../controllers/cotizacion.controller.js');
const { verificarTokenEmpleado } = require('../config/auth.middleware.js');

router.post('/', verificarTokenEmpleado, guardarCotizacion);
router.get('/', verificarTokenEmpleado, obtenerCotizaciones);
router.get('/:id', verificarTokenEmpleado, obtenerDetalleCotizacion);
module.exports = router;