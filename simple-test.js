/**
 * Script simple para probar el sistema paso a paso
 */

const { testConnection, syncModels } = require('./src/database/config')
const { User, Competitor, Snapshot } = require('./src/models')

async function simpleTest() {
  console.log('🔌 Iniciando prueba simple...')
  
  try {
    // Probar conexión
    console.log('1. Probando conexión a base de datos...')
    const connected = await testConnection()
    console.log(`✅ Conexión: ${connected ? 'OK' : 'FALLO'}`)
    
    if (!connected) {
      throw new Error('No se pudo conectar a la base de datos')
    }

    // Sincronizar modelos
    console.log('2. Sincronizando modelos...')
    await syncModels()
    console.log('✅ Modelos sincronizados')

    // Crear usuario de prueba
    console.log('3. Creando usuario de prueba...')
    const [user, created] = await User.findOrCreate({
      where: { email: 'test@competitortracker.com' },
      defaults: {
        name: 'Usuario de Prueba',
        password: 'test123456',
        role: 'admin'
      }
    })
    console.log(`✅ Usuario ${created ? 'creado' : 'encontrado'}: ${user.name}`)

    // Crear competidor de prueba
    console.log('4. Creando competidor de prueba...')
    const [competitor, competitorCreated] = await Competitor.findOrCreate({
      where: { 
        userId: user.id,
        name: 'Competidor de Prueba'
      },
      defaults: {
        userId: user.id,
        name: 'Competidor de Prueba',
        url: 'https://competidor-de-prueba.com',
        description: 'Sitio web de prueba para el sistema de versionado',
        monitoringEnabled: true,
        checkInterval: 3600
      }
    })
    console.log(`✅ Competidor ${competitorCreated ? 'creado' : 'encontrado'}: ${competitor.name}`)

    // Crear snapshot de prueba
    console.log('5. Creando snapshot de prueba...')
    const snapshot = await Snapshot.create({
      competitorId: competitor.id,
      versionNumber: 1,
      fullHtml: '<html><body><h1>Test HTML</h1></body></html>',
      isFullVersion: true,
      isCurrent: true,
      changeCount: 0,
      changePercentage: 0,
      severity: 'low'
    })
    console.log(`✅ Snapshot creado: ID ${snapshot.id}, Versión ${snapshot.versionNumber}`)

    // Verificar que se guardó correctamente
    console.log('6. Verificando datos guardados...')
    const savedSnapshot = await Snapshot.findByPk(snapshot.id)
    console.log(`✅ Snapshot recuperado: ${savedSnapshot ? 'OK' : 'FALLO'}`)
    
    if (savedSnapshot) {
      console.log(`   - Versión: ${savedSnapshot.versionNumber}`)
      console.log(`   - Es completa: ${savedSnapshot.isFullVersion}`)
      console.log(`   - HTML: ${savedSnapshot.fullHtml.length} caracteres`)
    }

    console.log('\n🎉 ¡Prueba simple completada exitosamente!')
    
  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message)
    console.error(error.stack)
  } finally {
    process.exit(0)
  }
}

simpleTest()
