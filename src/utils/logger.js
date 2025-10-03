/**
 * Configuración de logging con Winston
 * Maneja logs estructurados para desarrollo y producción
 */

const winston = require('winston')
const path = require('path')
const config = require('../config')

// Crear directorio de logs si no existe
const fs = require('fs')
const logDir = path.dirname(config.logging.file)
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
)

// Formato para consola en desarrollo
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`
    }
    
    return log
  })
)

// Configuración de transportes
const transports = []

// Transporte de consola
if (config.nodeEnv !== 'test') {
  transports.push(
    new winston.transports.Console({
      level: config.nodeEnv === 'development' ? 'debug' : 'info',
      format: config.nodeEnv === 'development' ? consoleFormat : logFormat
    })
  )
}

// Transporte de archivo
transports.push(
  new winston.transports.File({
    filename: config.logging.file,
    level: config.logging.level,
    format: logFormat,
    maxsize: this.parseSize(config.logging.maxSize),
    maxFiles: this.parseTime(config.logging.maxFiles)
  })
)

// Transporte de archivo para errores
transports.push(
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: this.parseSize(config.logging.maxSize),
    maxFiles: this.parseTime(config.logging.maxFiles)
  })
)

// Crear logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false
})

// Función para parsear tamaño de archivo
function parseSize (size) {
  const units = { k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 }
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(k|m|g)?b?$/i)
  
  if (!match) return 20 * 1024 * 1024 // 20MB por defecto
  
  const value = parseFloat(match[1])
  const unit = match[2] || 'm'
  
  return Math.floor(value * (units[unit] || 1))
}

// Función para parsear tiempo
function parseTime (time) {
  const units = { d: 1, h: 1/24, m: 1/(24*60) }
  const match = time.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(d|h|m)?$/i)
  
  if (!match) return 14 // 14 días por defecto
  
  const value = parseFloat(match[1])
  const unit = match[2] || 'd'
  
  return Math.floor(value * (units[unit] || 1))
}

// Agregar métodos de utilidad
logger.parseSize = parseSize
logger.parseTime = parseTime

// Método para logging de requests HTTP
logger.httpRequest = (req, res, responseTime) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id || 'anonymous'
  })
}

// Método para logging de errores de aplicación
logger.appError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context
  })
}

// Método para logging de operaciones de base de datos
logger.database = (operation, table, details = {}) => {
  logger.info('Database Operation', {
    operation,
    table,
    ...details
  })
}

// Método para logging de operaciones de HeadlessX
logger.headlessX = (operation, details = {}) => {
  logger.info('HeadlessX Operation', {
    operation,
    ...details
  })
}

// Método para logging de cambios detectados
logger.changeDetected = (competitorId, changeDetails) => {
  logger.info('Change Detected', {
    competitorId,
    ...changeDetails
  })
}

// Método para logging de métricas de rendimiento
logger.performance = (operation, duration, details = {}) => {
  logger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    ...details
  })
}

// Método para logging de auditoría
logger.audit = (action, userId, details = {}) => {
  logger.info('Audit Log', {
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  })
}

// Configurar manejo de excepciones no capturadas
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'exceptions.log'),
    format: logFormat
  })
)

// Configurar manejo de rechazos de promesas no manejados
logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'rejections.log'),
    format: logFormat
  })
)

module.exports = logger
