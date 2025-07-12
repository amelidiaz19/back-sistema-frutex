const { db2 } = require('../config/database.js');

const getTipoCambio = async (req, res) => {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Get both exchange rates
        const [yuanDolar] = await db2.query('SELECT tipo_cambio FROM TC_yuan_dolar ORDER BY id DESC LIMIT 1');
        const [dolarSoles] = await db2.query('SELECT tipo_cambio FROM TC_dolar_soles ORDER BY id DESC LIMIT 1');

        res.json({ 
            yuan_dolar: yuanDolar[0].tipo_cambio,
            dolar_soles: dolarSoles[0].tipo_cambio
        });
        
    } catch (err) {
        console.error('Error al obtener tipos de cambio:', err);
        res.status(500).json({ error: 'Error al obtener tipos de cambio' });
    }
};

const updateTipoCambio = async (req, res) => {
    const { yuan_dolar, dolar_soles } = req.body;

    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (yuan_dolar) {
            await db2.query(
                'INSERT INTO TC_yuan_dolar (tipo_cambio) VALUES (?)',
                [yuan_dolar]
            );
        }

        if (dolar_soles) {
            await db2.query(
                'INSERT INTO TC_dolar_soles (tipo_cambio) VALUES (?)',
                [dolar_soles]
            );
        }

        res.json({ 
            message: 'Tipos de cambio actualizados correctamente',
            yuan_dolar: yuan_dolar || 'no modificado',
            dolar_soles: dolar_soles || 'no modificado'
        });
        
    } catch (err) {
        console.error('Error al actualizar tipos de cambio:', err);
        res.status(500).json({ error: 'Error al actualizar tipos de cambio' });
    }
};

module.exports = { 
    updateTipoCambio,
    getTipoCambio
};