/**
 * Rutas para gestión de usuarios
 * Registro, login, autenticación y perfil
 */

const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../middleware/errorHandler')
const { validateUser } = require('../middleware/validation')
const { generateTokens, authenticateToken } = require('../middleware/auth')
const logger = require('../utils/logger')
const { User } = require('../models')

/**
 * POST /api/users/test-create
 * Endpoint de prueba para crear usuario
 */
router.post('/test-create', asyncHandler(async (req, res) => {
  const { email, password, name } = req.body

  logger.info('Test: Creando usuario directamente', { email, name })

  try {
    const newUser = await User.create({
      email,
      password,
      name,
      role: 'user'
    })

    logger.info('Test: Usuario creado', { userId: newUser.id })

    res.status(201).json({
      success: true,
      message: 'Usuario creado en test',
      data: {
        user: newUser.toJSON()
      }
    })
  } catch (error) {
    logger.error('Test: Error creando usuario:', error)
    throw error
  }
}))

/**
 * POST /api/users/register
 * Registro de nuevo usuario
 */
router.post('/register', validateUser.register, asyncHandler(async (req, res) => {
  const { email, password, name } = req.body

  logger.info('Registro de nuevo usuario', {
    email,
    name
  })

  try {
    logger.info('Paso 1: Verificando email existente', { email })
    
    // 1. Verificar que el email no exista
    const existingUser = await User.findOne({
      where: { email }
    })

    if (existingUser) {
      logger.info('Paso 1: Email ya existe', { email })
      return res.status(409).json({
        success: false,
        message: 'El email ya está registrado'
      })
    }

    logger.info('Paso 2: Creando usuario en base de datos', { email, name })
    
    // 2. Crear usuario en base de datos (el hashing se hace automáticamente en el hook)
    const newUser = await User.create({
      email,
      password, // Se hashea automáticamente
      name,
      role: 'user'
    })

    logger.info('Paso 3: Usuario creado exitosamente', { 
      userId: newUser.id, 
      email: newUser.email 
    })

    // 3. Generar tokens JWT
    const tokens = generateTokens({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    })

    logger.info('Paso 4: Tokens generados', { 
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken 
    })

    // 4. Obtener datos públicos del usuario (sin contraseña)
    const userData = newUser.toJSON()

    logger.info('Paso 5: Enviando respuesta', { userId: userData.id })

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: userData,
        tokens
      }
    })
  } catch (error) {
    logger.error('Error en registro de usuario:', error)
    
    // Manejar errores específicos de validación
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => ({
        field: err.path,
        message: err.message
      }))
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        details: validationErrors
      })
    }

    // Manejar error de email duplicado
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'El email ya está registrado'
      })
    }

    throw error
  }
}))

/**
 * POST /api/users/login
 * Inicio de sesión
 */
router.post('/login', validateUser.login, asyncHandler(async (req, res) => {
  const { email, password } = req.body

  logger.info('Intento de login', {
    email
  })

  try {
    // 1. Buscar usuario por email
    const user = await User.findOne({
      where: { 
        email,
        isActive: true 
      }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      })
    }

    // 2. Verificar contraseña
    const isValidPassword = await user.validatePassword(password)

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      })
    }

    // 3. Actualizar último login
    await user.update({ lastLoginAt: new Date() })

    // 4. Generar tokens JWT
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    })

    // 5. Obtener datos públicos del usuario (sin contraseña)
    const userData = user.toJSON()

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: userData,
        tokens
      }
    })
  } catch (error) {
    logger.error('Error en login:', error)
    throw error
  }
}))

/**
 * POST /api/users/refresh
 * Renovar token de acceso
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token requerido'
    })
  }

  try {
    // 1. Verificar refresh token
    const jwt = require('jsonwebtoken')
    const config = require('../config')
    
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret)
    
    // 2. Buscar usuario en base de datos
    const user = await User.findOne({
      where: { 
        id: decoded.id,
        isActive: true 
      }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      })
    }

    // 3. Generar nuevos tokens
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    })

    res.json({
      success: true,
      message: 'Token renovado exitosamente',
      data: {
        tokens
      }
    })
  } catch (error) {
    logger.error('Error en refresh token:', error)
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      })
    }

    throw error
  }
}))

/**
 * GET /api/users/profile
 * Obtener perfil del usuario actual
 */
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const user = req.user

  try {
    // Obtener datos completos del usuario desde BD
    const userData = await User.findByPk(user.id)

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Retornar datos públicos (sin contraseña)
    const publicUserData = userData.toJSON()

    res.json({
      success: true,
      data: publicUserData
    })
  } catch (error) {
    logger.error('Error obteniendo perfil:', error)
    throw error
  }
}))

/**
 * PUT /api/users/profile
 * Actualizar perfil del usuario
 */
router.put('/profile', authenticateToken, validateUser.update, asyncHandler(async (req, res) => {
  const user = req.user
  const updateData = req.body

  logger.info('Actualizando perfil de usuario', {
    userId: user.id,
    updateData
  })

  try {
    // Buscar usuario en base de datos
    const userData = await User.findByPk(user.id)

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Si se está actualizando el email, verificar que no esté duplicado
    if (updateData.email && updateData.email !== userData.email) {
      const existingUser = await User.findOne({
        where: {
          email: updateData.email,
          id: { [require('sequelize').Op.ne]: user.id }
        }
      })

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'El email ya está en uso'
        })
      }
    }

    // Actualizar usuario
    await userData.update(updateData)

    // Obtener datos actualizados (sin contraseña)
    const updatedUserData = userData.toJSON()

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: updatedUserData
    })
  } catch (error) {
    logger.error('Error actualizando perfil:', error)
    
    // Manejar errores específicos de validación
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => ({
        field: err.path,
        message: err.message
      }))
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        details: validationErrors
      })
    }

    // Manejar error de email duplicado
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'El email ya está en uso'
      })
    }

    throw error
  }
}))

/**
 * POST /api/users/logout
 * Cerrar sesión
 */
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // En una implementación completa, aquí se invalidarían los tokens
    // agregándolos a una blacklist en Redis o base de datos
    // Por ahora, simplemente confirmamos el logout
    
    logger.info('Usuario cerró sesión', {
      userId: req.user?.id,
      email: req.user?.email
    })

    res.json({
      success: true,
      message: 'Logout exitoso'
    })
  } catch (error) {
    logger.error('Error en logout:', error)
    throw error
  }
}))

module.exports = router
