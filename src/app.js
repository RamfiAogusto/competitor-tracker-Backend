/**
 * Aplicación principal del backend de Competitor Tracker
 * Configuración central de Express y middleware
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const cookieParser = require('cookie-parser')

// Configuración y utilidades
const config = require('./config')
const logger = require('./utils/logger')
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler')
const { testConnection, syncModels } = require('./database/config')

// Rutas
const apiRoutes = require('./routes')

class App {
  constructor () {
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
  }

  /**
   * Configuración de middleware
   */
  setupMiddleware () {
    // Seguridad
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }))

    // CORS
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }))

    // Compresión
    if (config.compression.enabled) {
      this.app.use(compression({
        level: config.compression.level,
        threshold: 1024
      }))
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      skipSuccessfulRequests: config.rateLimit.skipSuccessfulRequests,
      message: {
        error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false
    })
    this.app.use('/api', limiter)

    // Logging
    if (config.nodeEnv !== 'test') {
      this.app.use(morgan('combined', {
        stream: {
          write: (message) => logger.info(message.trim())
        }
      }))
    }

    // Parsing de cookies
    this.app.use(cookieParser())

    // Parsing de JSON y URL-encoded con UTF-8
    this.app.use(express.json({ 
      limit: '10mb',
      type: 'application/json'
    }))
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      type: 'application/x-www-form-urlencoded'
    }))

    // Headers de seguridad y encoding
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Frame-Options', 'DENY')
      res.setHeader('X-XSS-Protection', '1; mode=block')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      next()
    })
  }

  /**
   * Configuración de rutas
   */
  setupRoutes () {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: process.env.npm_package_version || '1.0.0'
      })
    })

    // API routes
    this.app.use('/api', apiRoutes)

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Competitor Tracker API',
        version: '1.0.0',
        documentation: '/api/docs',
        health: '/health'
      })
    })
  }

  /**
   * Configuración de manejo de errores
   */
  setupErrorHandling () {
    // 404 handler
    this.app.use(notFoundHandler)

    // Global error handler
    this.app.use(errorHandler)
  }

  /**
   * Obtener instancia de la aplicación
   */
  getApp () {
    return this.app
  }

  /**
   * Iniciar servidor
   */
  async start () {
    try {
      // Probar conexión a base de datos
      logger.info('🔌 Probando conexión a base de datos...')
      const dbConnected = await testConnection()
      
      if (!dbConnected) {
        logger.error('❌ No se pudo conectar a la base de datos')
        process.exit(1)
      }

      // Sincronizar modelos en desarrollo
      if (config.nodeEnv === 'development') {
        logger.info('🔄 Sincronizando modelos de base de datos...')
        await syncModels()
      }

      const port = config.server.port
      const server = this.app.listen(port, () => {
        logger.info(`🚀 Servidor iniciado en puerto ${port}`)
        logger.info(`🌍 Entorno: ${config.nodeEnv}`)
        logger.info(`📊 Health check: http://localhost:${port}/health`)
        logger.info(`🔗 API: http://localhost:${port}/api`)
        logger.info(`🗄️ Base de datos: ${config.database.name} en ${config.database.host}:${config.database.port}`)
      })

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown(server))
      process.on('SIGINT', () => this.shutdown(server))

      return server
    } catch (error) {
      logger.error('Error iniciando servidor:', error)
      process.exit(1)
    }
  }

  /**
   * Cierre graceful del servidor
   */
  shutdown (server) {
    logger.info('🛑 Recibida señal de cierre, cerrando servidor...')
    
    server.close(() => {
      logger.info('✅ Servidor cerrado correctamente')
      process.exit(0)
    })

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      logger.error('⚠️ Forzando cierre del servidor')
      process.exit(1)
    }, 10000)
  }
}

module.exports = App
