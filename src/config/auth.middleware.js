const jwt = require('jsonwebtoken');

const verificarTokenEmpleado = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No tiene acceso para ingresar.' });
    }

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_super_segura';
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.role !== 'empleado') {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de empleado.' });
        }

        req.usuario = decoded;
        next();
    } catch (error) {
        console.error('Error al verificar token:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        return res.status(403).json({ error: 'Token inválido' });
    }
};

const verificarTokenCliente = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No tiene acceso para ingresar.' });
    }

    try {
        const JWT_CLIENTE_SECRET = process.env.JWT_CLIENTE_SECRET || 'clave_secreta_clientes';
        const decoded = jwt.verify(token, JWT_CLIENTE_SECRET);
        
        if (decoded.role !== 'cliente') {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de cliente.' });
        }

        req.cliente = decoded;
        next();
    } catch (error) {
        console.error('Error al verificar token de cliente:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        return res.status(403).json({ error: 'Token inválido' });
    }
};

module.exports = {
  verificarTokenEmpleado,
  verificarTokenCliente
};