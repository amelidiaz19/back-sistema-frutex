const express = require('express');
const router = express.Router();
const { getEmpleado, login, verificarTokenEmpleado, registrarUsuario } = require('../controllers/empleados.controller');

router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

router.get('/', verificarTokenEmpleado, getEmpleado);
router.post('/login', login);
router.post('/registrar', registrarUsuario);

module.exports = router;