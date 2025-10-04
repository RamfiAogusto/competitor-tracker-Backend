/**
 * Middleware de validación de datos
 * Utiliza express-validator para validar request bodies, params y queries
 */

const { body, param, query, validationResult } = require('express-validator')
const { createError } = require('./errorHandler')

/**
 * Middleware para manejar resultados de validación
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }))

    return next(createError('Datos de entrada inválidos', 400, {
      details: errorMessages
    }))
  }

  next()
}

/**
 * Validaciones para competidores
 */
const validateCompetitor = {
  create: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('El nombre es requerido')
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    
    body('url')
      .trim()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('URL inválida'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('La descripción no puede exceder 500 caracteres'),
    
    body('monitoringEnabled')
      .optional()
      .isBoolean()
      .withMessage('monitoringEnabled debe ser un booleano'),
    
    body('checkInterval')
      .optional()
      .isInt({ min: 300, max: 86400 })
      .withMessage('El intervalo de verificación debe estar entre 300 y 86400 segundos'),
    
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('La prioridad debe ser low, medium o high'),
    
    handleValidationErrors
  ],

  update: [
    param('id')
      .isUUID()
      .withMessage('ID de competidor inválido'),
    
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    
    body('url')
      .optional()
      .trim()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('URL inválida'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('La descripción no puede exceder 500 caracteres'),
    
    body('monitoringEnabled')
      .optional()
      .isBoolean()
      .withMessage('monitoringEnabled debe ser un booleano'),
    
    body('checkInterval')
      .optional()
      .isInt({ min: 300, max: 86400 })
      .withMessage('El intervalo de verificación debe estar entre 300 y 86400 segundos'),
    
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('La prioridad debe ser low, medium o high'),
    
    handleValidationErrors
  ],

  getById: [
    param('id')
      .isUUID()
      .withMessage('ID de competidor inválido'),
    
    handleValidationErrors
  ],

  list: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('La página debe ser un número entero mayor a 0'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('El límite debe estar entre 1 y 100'),
    
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('La búsqueda no puede exceder 100 caracteres'),
    
    query('sortBy')
      .optional()
      .isIn(['name', 'url', 'createdAt', 'updatedAt'])
      .withMessage('Campo de ordenamiento inválido'),
    
    query('sortOrder')
      .optional()
      .isIn(['ASC', 'DESC'])
      .withMessage('Orden inválido'),
    
    handleValidationErrors
  ]
}

/**
 * Validaciones para capturas de cambios
 */
const validateCapture = {
  create: [
    param('competitorId')
      .isUUID()
      .withMessage('ID de competidor inválido'),
    
    body('options')
      .optional()
      .isObject()
      .withMessage('Las opciones deben ser un objeto'),
    
    body('options.waitFor')
      .optional()
      .isInt({ min: 0, max: 30000 })
      .withMessage('waitFor debe estar entre 0 y 30000 ms'),
    
    body('options.viewport')
      .optional()
      .isObject()
      .withMessage('viewport debe ser un objeto'),
    
    handleValidationErrors
  ],

  getHistory: [
    param('competitorId')
      .isUUID()
      .withMessage('ID de competidor inválido'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('El límite debe estar entre 1 y 50'),
    
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('El offset debe ser un número entero mayor o igual a 0'),
    
    handleValidationErrors
  ],

  getVersion: [
    param('competitorId')
      .isUUID()
      .withMessage('ID de competidor inválido'),
    
    param('versionNumber')
      .isInt({ min: 1 })
      .withMessage('Número de versión inválido'),
    
    handleValidationErrors
  ]
}

/**
 * Validaciones para alertas
 */
const validateAlert = {
  create: [
    body('competitorId')
      .isUUID()
      .withMessage('ID de competidor inválido'),
    
    body('type')
      .isIn(['content_change', 'price_change', 'new_page', 'page_removed', 'error'])
      .withMessage('Tipo de alerta inválido'),
    
    body('severity')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Severidad inválida'),
    
    body('message')
      .trim()
      .notEmpty()
      .withMessage('El mensaje es requerido')
      .isLength({ max: 1000 })
      .withMessage('El mensaje no puede exceder 1000 caracteres'),
    
    handleValidationErrors
  ],

  update: [
    param('id')
      .isUUID()
      .withMessage('ID de alerta inválido'),
    
    body('status')
      .optional()
      .isIn(['unread', 'read', 'archived'])
      .withMessage('Estado de alerta inválido'),
    
    handleValidationErrors
  ]
}

/**
 * Validaciones para usuarios
 */
const validateUser = {
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email inválido'),
    
    body('password')
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
    
    body('name')
      .trim()
      .notEmpty()
      .withMessage('El nombre es requerido')
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    
    handleValidationErrors
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email inválido'),
    
    body('password')
      .notEmpty()
      .withMessage('La contraseña es requerida'),
    
    handleValidationErrors
  ],

  update: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Email inválido'),
    
    handleValidationErrors
  ]
}

/**
 * Validaciones generales
 */
const validateGeneral = {
  uuid: [
    param('id')
      .isUUID()
      .withMessage('ID inválido'),
    
    handleValidationErrors
  ],

  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('La página debe ser un número entero mayor a 0'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('El límite debe estar entre 1 y 100'),
    
    handleValidationErrors
  ]
}

module.exports = {
  handleValidationErrors,
  validateCompetitor,
  validateCapture,
  validateAlert,
  validateUser,
  validateGeneral
}
