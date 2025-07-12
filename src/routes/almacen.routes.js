const router = require('express').Router();
const { verificarTokenEmpleado } = require('../config/auth.middleware');
const { registrarProducto, obtenerHistorial } = require('../controllers/almacen.controller');

router.post('/', verificarTokenEmpleado, registrarProducto);
router.get('/historial', verificarTokenEmpleado, obtenerHistorial);

module.exports = router;