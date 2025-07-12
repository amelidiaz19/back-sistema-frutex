const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

const UPLOAD_DIR = '/home/importa1/public_html/uploads/banners';
const CONFIG_PATH = '/home/importa1/public_html/uploads/banners/config.json';

const uploadBanner = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        const filename = `banner-${Date.now()}.webp`;
        const outputPath = path.join(UPLOAD_DIR, filename);

        await sharp(req.file.buffer)
            .resize(1920, 600, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(outputPath);

        // Update config file
        const config = await loadConfig();
        config.banners[filename] = { active: true, createdAt: new Date().toISOString() };
        await saveConfig(config);

        res.json({ success: true, filename });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const toggleBannerStatus = async (req, res) => {
    try {
        const { filename } = req.params;
        const config = await loadConfig();

        if (!config.banners[filename]) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }

        config.banners[filename].active = !config.banners[filename].active;
        await saveConfig(config);

        res.json({ 
            success: true, 
            active: config.banners[filename].active 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getActiveBanners = async (req, res) => {
    try {
        const config = await loadConfig();
        const activeBanners = Object.entries(config.banners)
            .filter(([_, data]) => data.active)
            .map(([filename, data]) => ({
                filename,
                path: `/uploads/banners/${filename}`,
                ...data
            }));

        res.json({ success: true, banners: activeBanners });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getBanners = async (req, res) => {
    try {
        const config = await loadConfig();
        const allBanners = Object.entries(config.banners)
            .map(([filename, data]) => ({
                filename,
                path: `/uploads/banners/${filename}`,
                ...data
            }));

        res.json({ success: true, banners: allBanners });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateBannerOrder = async (req, res) => {
    try {
        const orderData = req.body;
        const config = await loadConfig();

        // Update order in config
        orderData.forEach(item => {
            if (config.banners[item.filename]) {
                config.banners[item.filename].order = item.order;
            }
        });

        await saveConfig(config);

        res.json({ success: true, message: 'Order updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper functions
async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { banners: {} };
    }
}

async function saveConfig(config) {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
    uploadBanner,
    toggleBannerStatus,
    getActiveBanners,
    getBanners,
    updateBannerOrder
};