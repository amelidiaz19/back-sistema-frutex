const express = require('express');
const router = express.Router();
const { updateTipoCambio, getTipoCambio } = require('../controllers/tipocambio.controller');
const { verificarTokenEmpleado } = require('../config/auth.middleware');

router.get('/', verificarTokenEmpleado, getTipoCambio);
router.put('/', verificarTokenEmpleado, updateTipoCambio);

module.exports = router;