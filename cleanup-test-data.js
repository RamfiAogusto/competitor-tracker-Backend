/**
 * Script para limpiar datos de prueba
 */

const { testConnection, syncModels } = require('./src/database/config')
const { User, Competitor, Snapshot } = require('./src/models')

async function cleanupTestData() {
  console.log('🧹 Limpiando datos de prueba...')
  
  try {
    // Probar conexión
    const connected = await testConnection()
    if (!connected) {
      throw new Error('No se pudo conectar a la base de datos')
    }

    // Eliminar todos los datos de prueba
    console.log('1. Eliminando todos los snapshots...')
    const deletedSnapshots = await Snapshot.destroy({
      where: {}
    })
    console.log(`✅ ${deletedSnapshots} snapshots eliminados`)

    console.log('2. Eliminando todos los competidores...')
    const deletedCompetitors = await Competitor.destroy({
      where: {}
    })
    console.log(`✅ ${deletedCompetitors} competidores eliminados`)

    console.log('3. Eliminando todos los usuarios...')
    const deletedUsers = await User.destroy({
      where: {}
    })
    console.log(`✅ ${deletedUsers} usuarios eliminados`)

    console.log('\n🎉 ¡Limpieza completada exitosamente!')
    
  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error.message)
  } finally {
    process.exit(0)
  }
}

cleanupTestData()
