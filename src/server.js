/**
 * Punto de entrada del servidor
 * Inicializa la aplicación y maneja el ciclo de vida del servidor
 */

require('dotenv').config()

const App = require('./app')
const config = require('./config')
const logger = require('./utils/logger')

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Función principal
async function main () {
  try {
    logger.info('🚀 Iniciando Competitor Tracker Backend...')
    logger.info(`📋 Configuración cargada para entorno: ${config.nodeEnv}`)

    // Crear instancia de la aplicación
    const app = new App()
    
    // Iniciar servidor
    await app.start()
    
  } catch (error) {
    logger.error('💥 Error fatal iniciando la aplicación:', error)
    process.exit(1)
  }
}

// Solo ejecutar si es el archivo principal
if (require.main === module) {
  main()
}

module.exports = main
