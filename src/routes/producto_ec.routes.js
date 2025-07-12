const express = require('express');
const router = express.Router();
const { 
    getProductosEC,
    getProductosECK,
    getAllKeywords,
    getProductoById
} = require('../controllers/productos_ec.controller.js');

router.get('/ec', getProductosEC);
router.get('/ec/search', getProductosECK);
router.get('/ec/search/keywords', getAllKeywords);
router.get('/ec/search/:id', getProductoById);

module.exports = router;