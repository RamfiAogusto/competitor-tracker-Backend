/**
 * Servicio para procesamiento de imágenes
 * Usa sharp para redimensionar y optimizar imágenes
 */

const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const logger = require('../utils/logger')

class ImageService {
  /**
   * Procesar y optimizar avatar
   * @param {string} filePath - Ruta del archivo original
   * @returns {Promise<string>} - Ruta del archivo procesado
   */
  async processAvatar (filePath) {
    try {
      const dir = path.dirname(filePath)
      const ext = path.extname(filePath)
      const basename = path.basename(filePath, ext)
      const outputPath = path.join(dir, `${basename}-processed.webp`)

      // Procesar imagen: redimensionar a 400x400 y convertir a webp
      await sharp(filePath)
        .resize(400, 400, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toFile(outputPath)

      // Eliminar archivo original
      fs.unlinkSync(filePath)

      logger.info('Avatar procesado exitosamente', {
        original: filePath,
        processed: outputPath
      })

      return outputPath
    } catch (error) {
      logger.error('Error procesando avatar:', error)
      throw new Error('Error al procesar la imagen')
    }
  }

  /**
   * Eliminar archivo de avatar
   * @param {string} filePath - Ruta del archivo a eliminar
   */
  deleteAvatar (filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        logger.info('Avatar eliminado', { filePath })
      }
    } catch (error) {
      logger.error('Error eliminando avatar:', error)
    }
  }

  /**
   * Obtener URL pública del avatar
   * @param {string} filename - Nombre del archivo
   * @returns {string} - URL pública
   */
  getAvatarUrl (filename) {
    if (!filename) return null
    
    // Si es una URL completa (de Google, etc.), devolverla tal cual
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename
    }
    
    // Si es un archivo local, devolver la ruta relativa
    return `/uploads/avatars/${path.basename(filename)}`
  }
}

module.exports = new ImageService()

