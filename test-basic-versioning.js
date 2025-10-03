/**
 * Script básico para probar el versionado sin ChangeDetector
 */

const fs = require('fs').promises
const path = require('path')
const { testConnection, syncModels } = require('./src/database/config')
const { User, Competitor, Snapshot } = require('./src/models')

async function testBasicVersioning() {
  console.log('🔌 Iniciando prueba básica de versionado...')
  
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
        name: 'Competidor HTML Test'
      },
      defaults: {
        userId: user.id,
        name: 'Competidor HTML Test',
        url: 'https://competidor-html-test.com',
        description: 'Sitio web de prueba para el sistema de versionado HTML',
        monitoringEnabled: true,
        checkInterval: 3600
      }
    })
    console.log(`✅ Competidor ${competitorCreated ? 'creado' : 'encontrado'}: ${competitor.name}`)

    // Cargar y procesar versiones HTML
    console.log('5. Cargando versiones HTML...')
    const versions = ['v1', 'v2', 'v3']
    const htmlVersions = []
    
    for (const version of versions) {
      const filePath = path.join(__dirname, 'test-data', `test-page-${version}.html`)
      try {
        const html = await fs.readFile(filePath, 'utf8')
        htmlVersions.push({
          version,
          html,
          timestamp: new Date()
        })
        console.log(`✅ Cargada versión ${version} (${html.length} caracteres)`)
      } catch (error) {
        console.error(`❌ Error cargando ${version}:`, error.message)
      }
    }

    // Crear snapshots manualmente
    console.log('6. Creando snapshots manualmente...')
    
    for (let i = 0; i < htmlVersions.length; i++) {
      const htmlVersion = htmlVersions[i]
      const versionNumber = i + 1
      
      // Marcar versión anterior como no actual
      if (i > 0) {
        await Snapshot.update(
          { isCurrent: false },
          { where: { competitorId: competitor.id } }
        )
      }
      
      // Crear nuevo snapshot
      const snapshot = await Snapshot.create({
        competitorId: competitor.id,
        versionNumber: versionNumber,
        fullHtml: htmlVersion.html,
        isFullVersion: versionNumber === 1, // Solo la primera es completa por ahora
        isCurrent: true,
        changeCount: versionNumber === 1 ? 0 : Math.floor(Math.random() * 50) + 1,
        changePercentage: versionNumber === 1 ? 0 : Math.random() * 10,
        severity: versionNumber === 1 ? 'low' : ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        changeSummary: versionNumber === 1 ? null : `Cambios detectados en versión ${versionNumber}`
      })
      
      console.log(`✅ Snapshot creado: Versión ${versionNumber}, ID ${snapshot.id}`)
      console.log(`   - Tamaño HTML: ${htmlVersion.html.length} caracteres`)
      console.log(`   - Es completa: ${snapshot.isFullVersion}`)
      console.log(`   - Cambios: ${snapshot.changeCount}`)
      console.log(`   - Severidad: ${snapshot.severity}`)
    }

    // Verificar snapshots
    console.log('7. Verificando snapshots guardados...')
    const snapshots = await Snapshot.findAll({
      where: { competitorId: competitor.id },
      order: [['versionNumber', 'ASC']]
    })

    console.log(`📋 Se encontraron ${snapshots.length} snapshots:`)
    
    for (const snapshot of snapshots) {
      console.log(`\n📄 Versión ${snapshot.versionNumber}:`)
      console.log(`   - ID: ${snapshot.id}`)
      console.log(`   - Es completa: ${snapshot.isFullVersion}`)
      console.log(`   - Es actual: ${snapshot.isCurrent}`)
      console.log(`   - Cambios: ${snapshot.changeCount}`)
      console.log(`   - Porcentaje: ${snapshot.changePercentage}%`)
      console.log(`   - Severidad: ${snapshot.severity}`)
      console.log(`   - HTML: ${snapshot.fullHtml ? snapshot.fullHtml.length : 0} caracteres`)
      console.log(`   - Fecha: ${snapshot.createdAt}`)
      
      // Mostrar vista previa del HTML
      if (snapshot.fullHtml) {
        const preview = snapshot.fullHtml.substring(0, 100).replace(/\s+/g, ' ')
        console.log(`   - Vista previa: ${preview}...`)
      }
    }

    // Actualizar competidor
    console.log('8. Actualizando estadísticas del competidor...')
    await Competitor.update({
      totalVersions: snapshots.length,
      lastCheckedAt: new Date(),
      lastChangeAt: snapshots.length > 1 ? snapshots[snapshots.length - 1].createdAt : null
    }, {
      where: { id: competitor.id }
    })

    console.log('\n🎉 ¡Prueba básica de versionado completada exitosamente!')
    console.log(`📊 Resumen:`)
    console.log(`   - Competidor: ${competitor.name}`)
    console.log(`   - Versiones creadas: ${snapshots.length}`)
    console.log(`   - Versiones completas: ${snapshots.filter(s => s.isFullVersion).length}`)
    console.log(`   - Versiones diferenciales: ${snapshots.filter(s => !s.isFullVersion).length}`)
    
  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message)
    console.error(error.stack)
  } finally {
    process.exit(0)
  }
}

testBasicVersioning()
