const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const {
    uploadProductImage,
    getProductImages,
    updateImageOrder,
    deleteImage,
    setPrincipal
} = require('../controllers/productos_imagen.controller.js');

const { verificarTokenEmpleado } = require('../config/auth.middleware.js');

router.post('/upload', verificarTokenEmpleado, upload.single('imagen'), uploadProductImage);
router.get('/producto/:producto_id', getProductImages);
router.put('/order', verificarTokenEmpleado, updateImageOrder);
router.put('/producto/principal/:id', setPrincipal);
router.delete('/:id', verificarTokenEmpleado, deleteImage);

module.exports = router;