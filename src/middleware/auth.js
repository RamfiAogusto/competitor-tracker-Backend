/**
 * Middleware de autenticación y autorización
 * Maneja JWT tokens y verificación de usuarios
 */

const jwt = require('jsonwebtoken')
const { AppError, createError } = require('./errorHandler')
const config = require('../config')

/**
 * Middleware de autenticación JWT
 */
const authenticateToken = (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      throw createError('Token de acceso requerido', 401)
    }

    // Verificar token
    const decoded = jwt.verify(token, config.jwt.secret)
    
    // Agregar información del usuario al request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    }

    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(createError('Token inválido', 401))
    }
    if (error.name === 'TokenExpiredError') {
      return next(createError('Token expirado', 401))
    }
    next(error)
  }
}

/**
 * Middleware de autorización por roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError('Usuario no autenticado', 401))
    }

    if (!roles.includes(req.user.role)) {
      return next(createError('No tienes permisos para acceder a este recurso', 403))
    }

    next()
  }
}

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret)
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'user'
      }
    }

    next()
  } catch (error) {
    // En caso de error, continuar sin usuario autenticado
    next()
  }
}

/**
 * Middleware para verificar que el usuario es el propietario del recurso
 */
const checkOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError('Usuario no autenticado', 401))
    }

    // Si es admin, permitir acceso
    if (req.user.role === 'admin') {
      return next()
    }

    // Verificar ownership
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField]
    
    if (resourceUserId && resourceUserId !== req.user.id) {
      return next(createError('No tienes permisos para acceder a este recurso', 403))
    }

    next()
  }
}

/**
 * Middleware para verificar límites de rate limiting por usuario
 */
const userRateLimit = (maxRequests = 100, windowMs = 900000) => {
  const userRequests = new Map()

  return (req, res, next) => {
    if (!req.user) {
      return next()
    }

    const userId = req.user.id
    const now = Date.now()
    const windowStart = now - windowMs

    // Limpiar requests antiguos
    if (userRequests.has(userId)) {
      const requests = userRequests.get(userId)
      userRequests.set(userId, requests.filter(time => time > windowStart))
    }

    // Verificar límite
    const currentRequests = userRequests.get(userId) || []
    
    if (currentRequests.length >= maxRequests) {
      return next(createError('Límite de solicitudes excedido para tu cuenta', 429))
    }

    // Agregar request actual
    currentRequests.push(now)
    userRequests.set(userId, currentRequests)

    // Agregar headers de información
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': maxRequests - currentRequests.length,
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    })

    next()
  }
}

/**
 * Función para generar tokens JWT
 */
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role || 'user'
  }

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  })

  const refreshToken = jwt.sign(
    { id: user.id },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  )

  return { accessToken, refreshToken }
}

/**
 * Función para verificar refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret)
  } catch (error) {
    throw createError('Refresh token inválido', 401)
  }
}

module.exports = {
  authenticateToken,
  authorize,
  optionalAuth,
  checkOwnership,
  userRateLimit,
  generateTokens,
  verifyRefreshToken
}
