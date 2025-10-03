/**
 * Middleware global para manejo de errores
 * Captura y procesa todos los errores de la aplicación
 */

const logger = require('../utils/logger')
const config = require('../config')

class AppError extends Error {
  constructor (message, statusCode, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'

    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Middleware de manejo de errores
 */
const errorHandler = (error, req, res, next) => {
  let err = { ...error }
  err.message = error.message

  // Log del error
  logger.error('Error capturado:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  })

  // Error de validación de Mongoose/Sequelize
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map(val => val.message).join(', ')
    err = new AppError(message, 400)
  }

  // Error de duplicado de Sequelize
  if (error.name === 'SequelizeUniqueConstraintError') {
    const message = 'Recurso duplicado'
    err = new AppError(message, 409)
  }

  // Error de foreign key de Sequelize
  if (error.name === 'SequelizeForeignKeyConstraintError') {
    const message = 'Referencia inválida'
    err = new AppError(message, 400)
  }

  // Error de JWT
  if (error.name === 'JsonWebTokenError') {
    const message = 'Token inválido'
    err = new AppError(message, 401)
  }

  // Error de JWT expirado
  if (error.name === 'TokenExpiredError') {
    const message = 'Token expirado'
    err = new AppError(message, 401)
  }

  // Error de sintaxis JSON
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    const message = 'JSON inválido'
    err = new AppError(message, 400)
  }

  // Error de límite de tamaño
  if (error.code === 'LIMIT_FILE_SIZE') {
    const message = 'Archivo demasiado grande'
    err = new AppError(message, 413)
  }

  // Error de HeadlessX
  if (error.name === 'HeadlessXError') {
    const message = 'Error en servicio de scraping'
    err = new AppError(message, 502)
  }

  // Error de timeout
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    const message = 'Timeout de conexión'
    err = new AppError(message, 408)
  }

  // Error de conexión
  if (error.code === 'ECONNREFUSED') {
    const message = 'Servicio no disponible'
    err = new AppError(message, 503)
  }

  // Determinar el mensaje de respuesta
  let message = err.message || 'Error interno del servidor'
  let statusCode = err.statusCode || 500

  // En producción, no exponer detalles del error
  if (config.nodeEnv === 'production' && !err.isOperational) {
    message = 'Algo salió mal'
    statusCode = 500
  }

  // Respuesta de error
  const errorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    }
  }

  // Incluir stack trace solo en desarrollo
  if (config.nodeEnv === 'development') {
    errorResponse.error.stack = error.stack
    errorResponse.error.details = error
  }

  res.status(statusCode).json(errorResponse)
}

/**
 * Middleware para manejar rutas no encontradas
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Ruta ${req.originalUrl} no encontrada`, 404)
  next(error)
}

/**
 * Middleware para manejar errores asíncronos
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Función para crear errores personalizados
 */
const createError = (message, statusCode, isOperational = true) => {
  return new AppError(message, statusCode, isOperational)
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError,
  AppError
}
