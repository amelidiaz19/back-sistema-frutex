const express = require('express');
const router = express.Router();
const { 
  crearCliente, 
  verificarCliente,
  listarClientes, 
  editarCliente } = require('../controllers/cliente.controller.js');
const { verificarTokenEmpleado } = require('../config/auth.middleware.js');

router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

router.post('/', verificarTokenEmpleado, crearCliente);
router.get('/:numeroDocumento', verificarTokenEmpleado, verificarCliente);

router.get('/', verificarTokenEmpleado, listarClientes);
router.put('/:dni_cliente', verificarTokenEmpleado, editarCliente);

module.exports = router;