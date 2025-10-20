/**
 * Middleware para manejo de uploads de archivos
 * Configuración de multer para subir avatares
 */

const multer = require('multer')
const path = require('path')
const fs = require('fs')
const logger = require('../utils/logger')

// Asegurar que el directorio de uploads existe
const uploadDir = path.join(__dirname, '../../public/uploads/avatars')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
  logger.info('Directorio de uploads creado:', uploadDir)
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    // Generar nombre único: userId-timestamp.extension
    const userId = req.user.id
    const timestamp = Date.now()
    const ext = path.extname(file.originalname)
    const filename = `${userId}-${timestamp}${ext}`
    cb(null, filename)
  }
})

// Filtro de archivos - solo imágenes
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, WEBP, GIF)'), false)
  }
}

// Configuración de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
})

module.exports = {
  uploadAvatar: upload.single('avatar')
}

