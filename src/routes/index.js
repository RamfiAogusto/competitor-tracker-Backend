/**
 * Rutas principales de la API
 * Centraliza todas las rutas de la aplicación
 */

const express = require('express')
const router = express.Router()

// Importar rutas específicas
const competitorRoutes = require('./competitors')
const captureRoutes = require('./captures')
const alertRoutes = require('./alerts')
const userRoutes = require('./users')
const dashboardRoutes = require('./dashboard')
const changeRoutes = require('./changes')

// Middleware de autenticación
const { authenticateToken } = require('../middleware/auth')

// Rutas públicas
router.use('/users', userRoutes)

// Rutas protegidas (requieren autenticación)
router.use('/competitors', authenticateToken, competitorRoutes)
router.use('/captures', authenticateToken, captureRoutes)
router.use('/alerts', authenticateToken, alertRoutes)
router.use('/dashboard', authenticateToken, dashboardRoutes)
router.use('/changes', authenticateToken, changeRoutes)

// Ruta de información de la API
router.get('/info', (req, res) => {
  res.json({
    name: 'Competitor Tracker API',
    version: '1.0.0',
    description: 'API para monitoreo de competidores y detección de cambios',
    endpoints: {
      competitors: '/api/competitors',
      captures: '/api/captures',
      alerts: '/api/alerts',
      users: '/api/users',
      dashboard: '/api/dashboard',
      changes: '/api/changes'
    },
    documentation: '/api/docs',
    health: '/health'
  })
})

// Ruta de estado de servicios
router.get('/status', async (req, res) => {
  try {
    const headlessXService = require('../services/headlessXService')
    const headlessXStatus = await headlessXService.checkHealth()
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        headlessX: headlessXStatus.status,
        database: 'connected', // TODO: Implementar verificación de BD
        redis: 'connected' // TODO: Implementar verificación de Redis
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    })
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Error verificando estado de servicios',
      error: error.message
    })
  }
})

module.exports = router
