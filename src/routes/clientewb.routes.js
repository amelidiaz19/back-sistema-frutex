const express = require('express');
const router = express.Router();
const { crearCliente, loginCliente, obtenerPerfil, editarCliente } = require('../controllers/clientewb.controller.js');
const { verificarTokenCliente } = require('../config/auth.middleware.js');

router.post('/login', loginCliente);
router.post('/crear', crearCliente);

router.put('/perfil/:dni_cliente', verificarTokenCliente, editarCliente);

module.exports = router;