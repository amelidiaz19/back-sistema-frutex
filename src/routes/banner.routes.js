const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
    uploadBanner, 
    toggleBannerStatus, 
    getBanners, 
    getActiveBanners,
    updateBannerOrder } = require('../controllers/banner.controller');
const { verificarTokenEmpleado } = require('../config/auth.middleware');

// Configure multer for image upload
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'));
        }
    }
});

// Routes
router.post('/upload', upload.single('image'), verificarTokenEmpleado, uploadBanner);
router.get('/list',verificarTokenEmpleado, getBanners);
router.get('/images', getActiveBanners);
router.put('/order', verificarTokenEmpleado, updateBannerOrder);
router.put('/toggle/:filename', verificarTokenEmpleado, toggleBannerStatus);

module.exports = router;