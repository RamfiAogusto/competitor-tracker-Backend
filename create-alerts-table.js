/**
 * Script para crear la tabla de alertas en la base de datos
 */

const { sequelize } = require('./src/database/config')
const { Alert } = require('./src/models')

async function createAlertsTable() {
  try {
    console.log('🔧 Creando tabla de alertas...')
    
    // Sincronizar el modelo Alert
    await Alert.sync({ force: false })
    
    console.log('✅ Tabla de alertas creada exitosamente')
    
    // Verificar que la tabla existe
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'alerts'
    `)
    
    if (results.length > 0) {
      console.log('✅ Tabla "alerts" verificada en la base de datos')
    } else {
      console.log('⚠️  Tabla "alerts" no encontrada')
    }
    
  } catch (error) {
    console.error('❌ Error creando tabla de alertas:', error.message)
    throw error
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  createAlertsTable()
    .then(() => {
      console.log('🎉 Script completado')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Error:', error.message)
      process.exit(1)
    })
}

module.exports = { createAlertsTable }
