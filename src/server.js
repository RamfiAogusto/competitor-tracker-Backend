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
    console.log('\n' + '='.repeat(60))
    console.log('⚡ INICIANDO COMPETITOR TRACKER BACKEND...')
    console.log('='.repeat(60))
    console.log(`📋 Entorno: ${config.nodeEnv}`)
    console.log(`📡 Puerto configurado: ${config.server.port}`)
    console.log('='.repeat(60) + '\n')
    
    logger.info('🚀 Iniciando Competitor Tracker Backend...')
    logger.info(`📋 Configuración cargada para entorno: ${config.nodeEnv}`)

    // Crear instancia de la aplicación
    const app = new App()
    
    // Iniciar servidor
    await app.start()
    
  } catch (error) {
    console.error('\n' + '='.repeat(60))
    console.error('💥 ERROR FATAL AL INICIAR EL BACKEND')
    console.error('='.repeat(60))
    console.error('Tipo de error:', error.constructor.name)
    console.error('Mensaje:', error.message)
    console.error('Stack:', error.stack)
    console.error('='.repeat(60) + '\n')
    
    logger.error('💥 Error fatal iniciando la aplicación:', error)
    process.exit(1)
  }
}

// Ejecutar siempre que se cargue directamente
// No usamos require.main === module porque puede no funcionar en Windows
if (!module.parent || process.argv[1]?.includes('server.js')) {
  main().catch(error => {
    console.error('\n❌ ERROR FATAL:')
    console.error(error)
    console.error('\nStack trace:')
    console.error(error.stack)
    process.exit(1)
  })
}

module.exports = main
