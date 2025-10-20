/**
 * Configuración central de la aplicación
 * Carga variables de entorno y proporciona configuración estructurada
 */

require('dotenv').config()

const config = {
  // Configuración del servidor
  server: {
    port: parseInt(process.env.PORT, 10) || 3002,
    host: process.env.HOST || '0.0.0.0'
  },

  // Entorno
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v1',

  // Base de datos
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'Tracker',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '2004',
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: process.env.DB_LOGGING === 'true' || false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },

  // HeadlessX
  headlessX: {
    url: process.env.HEADLESSX_URL || 'http://localhost:3000',
    token: process.env.HEADLESSX_TOKEN || '',
    timeout: parseInt(process.env.HEADLESSX_TIMEOUT, 10) || 60000
  },

  // Autenticación JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d', // Extendido para pruebas
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '90d' // Extendido para pruebas
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutos
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 1000, // Aumentado para desarrollo
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true' || false
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d'
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: process.env.CORS_CREDENTIALS === 'true' || true
  },

  // Compresión
  compression: {
    enabled: process.env.COMPRESSION_ENABLED === 'true' || true,
    level: parseInt(process.env.COMPRESSION_LEVEL, 10) || 6
  },

  // Monitoreo
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true' || true,
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000
  },

  // Sistema de versionado
  versioning: {
    maxVersionsPerCompetitor: parseInt(process.env.MAX_VERSIONS_PER_COMPETITOR, 10) || 30,
    fullVersionInterval: parseInt(process.env.FULL_VERSION_INTERVAL, 10) || 10,
    changeThreshold: parseFloat(process.env.CHANGE_THRESHOLD) || 0.05,
    significantChangeThreshold: parseInt(process.env.SIGNIFICANT_CHANGE_THRESHOLD, 10) || 100,
    compressionEnabled: process.env.VERSION_COMPRESSION_ENABLED === 'true' || true
  },

  // Limpieza automática
  cleanup: {
    enabled: process.env.CLEANUP_ENABLED === 'true' || true,
    schedule: process.env.CLEANUP_SCHEDULE || '0 2 * * *' // 2 AM diario
  },

  // Webhooks (opcional)
  webhooks: {
    secret: process.env.WEBHOOK_SECRET || '',
    url: process.env.WEBHOOK_URL || ''
  },

  // Redis (opcional)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB, 10) || 0
  },

  // Email (opcional)
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    },
    from: process.env.SMTP_FROM || 'Competitor Tracker <noreply@competitortracker.com>'
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3002/api/auth/google/callback'
  },

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
}

// Validación de configuración crítica
function validateConfig () {
  const required = [
    'jwt.secret',
    'headlessX.url',
    'headlessX.token'
  ]

  const missing = required.filter(key => {
    const value = key.split('.').reduce((obj, k) => obj && obj[k], config)
    return !value || value === 'your-super-secret-key' || value === 'your-refresh-secret'
  })

  if (missing.length > 0) {
    throw new Error(`Configuración faltante: ${missing.join(', ')}`)
  }
}

// Validar configuración en desarrollo
if (config.nodeEnv === 'development') {
  try {
    validateConfig()
  } catch (error) {
    console.warn('⚠️ Advertencia de configuración:', error.message)
  }
}

module.exports = config
