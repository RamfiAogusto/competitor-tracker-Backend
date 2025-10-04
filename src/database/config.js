/**
 * Configuración de base de datos con Sequelize
 * Maneja la conexión a PostgreSQL
 */

const { Sequelize } = require('sequelize')
const config = require('../config')
const logger = require('../utils/logger')

// Configuración de Sequelize
const sequelize = new Sequelize({
  host: 'localhost',
  port: 5432,
  database: 'Tracker',
  username: 'postgres',
  password: '2004',
  dialect: 'postgres',
  logging: config.database.logging ? (msg) => logger.debug(msg) : false,
  pool: config.database.pool,
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false,
    charset: 'utf8'
  }
})

// Debug: mostrar configuración de conexión
logger.debug('Configuración de Sequelize:', {
  host: 'localhost',
  port: 5432,
  database: 'Tracker',
  username: 'postgres',
  password: '***',
  dialect: 'postgres'
})

// Función para probar la conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate()
    logger.info('✅ Conexión a PostgreSQL establecida correctamente')
    return true
  } catch (error) {
    logger.error('❌ Error conectando a PostgreSQL:', error.message)
    return false
  }
}

// Función para sincronizar modelos (solo en desarrollo)
const syncModels = async (force = false) => {
  try {
    if (config.nodeEnv === 'development' || force) {
      await sequelize.sync({ force })
      logger.info('🔄 Modelos sincronizados con la base de datos')
      return true
    } else {
      logger.warn('⚠️ Sincronización automática deshabilitada en producción')
      return false
    }
  } catch (error) {
    logger.error('❌ Error sincronizando modelos:', error.message)
    return false
  }
}

// Función para cerrar la conexión
const closeConnection = async () => {
  try {
    await sequelize.close()
    logger.info('🔌 Conexión a base de datos cerrada')
  } catch (error) {
    logger.error('❌ Error cerrando conexión:', error.message)
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncModels,
  closeConnection
}
