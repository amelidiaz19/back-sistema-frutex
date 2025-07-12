const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { db2 } = require('../config/database.js');

// Cambiar la ruta para desarrollo local
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const uploadProductImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se subió ninguna imagen' });
        }

        const { producto_id, es_principal, alt_texto } = req.body;
        
        // Convertir es_principal a boolean
        const esPrincipalBool = es_principal === 'true' || es_principal === true;

        // Create directory if it doesn't exist
        await fs.mkdir(UPLOAD_DIR, { recursive: true });

        // Generate unique filename using product code and timestamp
        const [product] = await db2.query('SELECT codigo FROM Producto WHERE id = ?', [producto_id]);
        if (!product || product.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado' });
        }

        const codigo = product[0].codigo;
        const timestamp = Date.now();
        const filename = `${codigo}-${timestamp}.webp`;
        const outputPath = path.join(UPLOAD_DIR, filename);

        // Process and save image
        await sharp(req.file.buffer)
            .resize(800, 800, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .webp({ quality: 80 })
            .toFile(outputPath);

        // If this is the principal image, update other images to not be principal
        if (esPrincipalBool) {
            await db2.query(
                'UPDATE Producto SET foto = ? WHERE id = ?',
                [filename, producto_id]
            );
        } else {
            // Verificar si el producto no tiene foto aún
            const [[prod]] = await db2.query(
                'SELECT foto FROM Producto WHERE id = ?',
                [producto_id]
            );

            if (!prod.foto) {
                await db2.query(
                    'UPDATE Producto SET foto = ? WHERE id = ?',
                    [filename, producto_id]
                );
            }
        }

        // Get the highest order number for this product
        const [[{ maxOrden }]] = await db2.query(
            'SELECT COALESCE(MAX(orden), 0) as maxOrden FROM ProductoImagenes WHERE producto_id = ?',
            [producto_id]
        );

        // Insert image record
        const [result] = await db2.query(
            `INSERT INTO ProductoImagenes 
            (producto_id, imagen_url, alt_texto, es_principal, orden) 
            VALUES (?, ?, ?, ?, ?)`,
            [producto_id, filename, alt_texto || '', esPrincipalBool, maxOrden + 1]
        );

        // If this is the first image, update the product's main foto field
        if (esPrincipalBool || maxOrden === 0) {
            await db2.query(
                'UPDATE Producto SET foto = ? WHERE id = ?',
                [filename, producto_id]
            );
        }

        res.json({ 
            success: true, 
            imagen_id: result.insertId,
            filename,
            url: `/uploads/${filename}`
        });

    } catch (error) {
        console.error('Error al subir imagen:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getProductImages = async (req, res) => {
    try {
        const { producto_id } = req.params;
        
        const [imagenes] = await db2.query(
            `SELECT * FROM ProductoImagenes 
            WHERE producto_id = ? 
            ORDER BY es_principal DESC, orden ASC`,
            [producto_id]
        );

        const imagenesConUrl = imagenes.map(img => ({
            ...img,
            url: `/uploads/${img.imagen_url}`
        }));

        res.json({ success: true, imagenes: imagenesConUrl });
    } catch (error) {
        console.error('Error al obtener imágenes:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateImageOrder = async (req, res) => {
    try {
        const { imagenes } = req.body;
        
        for (const img of imagenes) {
            await db2.query(
                'UPDATE ProductoImagenes SET orden = ? WHERE id = ?',
                [img.orden, img.id]
            );
        }

        res.json({ success: true, message: 'Orden actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar orden:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteImage = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get image info before deleting
        const [imagen] = await db2.query(
            'SELECT * FROM ProductoImagenes WHERE id = ?',
            [id]
        );

        if (!imagen || imagen.length === 0) {
            return res.status(404).json({ success: false, message: 'Imagen no encontrada' });
        }

        // Delete file - usar path.join para construir la ruta correctamente
        const filepath = path.join(UPLOAD_DIR, imagen[0].imagen_url);
        
        try {
            await fs.unlink(filepath);
        } catch (unlinkError) {
            console.warn('No se pudo eliminar el archivo físico:', unlinkError.message);
            // Continuar con la eliminación de la base de datos aunque no se pueda eliminar el archivo
        }

        // Delete from database
        await db2.query('DELETE FROM ProductoImagenes WHERE id = ?', [id]);

        // If it was the principal image, set another image as principal
        if (imagen[0].es_principal) {
            const [nextImage] = await db2.query(
                'SELECT * FROM ProductoImagenes WHERE producto_id = ? ORDER BY orden ASC LIMIT 1',
                [imagen[0].producto_id]
            );

            if (nextImage && nextImage.length > 0) {
                await db2.query(
                    'UPDATE ProductoImagenes SET es_principal = TRUE WHERE id = ?',
                    [nextImage[0].id]
                );
                await db2.query(
                    'UPDATE Producto SET foto = ? WHERE id = ?',
                    [nextImage[0].imagen_url, imagen[0].producto_id]
                );
            } else {
                await db2.query(
                    'UPDATE Producto SET foto = "" WHERE id = ?',
                    [imagen[0].producto_id]
                );
            }
        }

        res.json({ success: true, message: 'Imagen eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const setPrincipal = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get image info
        const [imagen] = await db2.query(
            'SELECT * FROM ProductoImagenes WHERE id = ?',
            [id]
        );

        if (!imagen || imagen.length === 0) {
            return res.status(404).json({ success: false, message: 'Imagen no encontrada' });
        }

        // Update all images to not be principal
        await db2.query(
            'UPDATE ProductoImagenes SET es_principal = FALSE WHERE producto_id = ?',
            [imagen[0].producto_id]
        );

        // Set the selected image as principal
        await db2.query(
            'UPDATE ProductoImagenes SET es_principal = TRUE WHERE id = ?',
            [id]
        );

        // Update product's main photo
        await db2.query(
            'UPDATE Producto SET foto = ? WHERE id = ?',
            [imagen[0].imagen_url, imagen[0].producto_id]
        );

        res.json({ success: true, message: 'Imagen principal actualizada correctamente' });
    } catch (error) {
        console.error('Error al establecer imagen principal:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    uploadProductImage,
    getProductImages,
    updateImageOrder,
    deleteImage,
    setPrincipal
};