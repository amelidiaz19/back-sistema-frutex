const express = require('express');
const router = express.Router();
const { crearPedido, obtenerPedidosCliente, obtenerTodosPedidos, actualizarEstadoPedido } = require('../controllers/pedido.controller');
const { verificarTokenCliente } = require('../config/auth.middleware.js');
const { verificarTokenEmpleado } = require('../config/auth.middleware.js');


router.post('/crear', verificarTokenCliente, crearPedido);
router.get('/cliente', verificarTokenCliente, obtenerPedidosCliente);

router.get('/todos', verificarTokenEmpleado, obtenerTodosPedidos);
router.put('/actualizar/:id', verificarTokenEmpleado, actualizarEstadoPedido);

module.exports = router;