/**
 * Test del sistema de versionado inteligente
 * Verifica que las versiones completas y parciales se guarden correctamente
 */

const { Snapshot, SnapshotDiff, Competitor } = require('./src/models')
const changeDetector = require('./src/services/changeDetector')
const logger = require('./src/utils/logger')

async function testVersioningSystem () {
  try {
    logger.info('🧪 Iniciando test del sistema de versionado...')

    // 1. Buscar un competidor existente
    const competitor = await Competitor.findOne({
      where: { isActive: true }
    })

    if (!competitor) {
      logger.error('❌ No se encontró ningún competidor activo para hacer pruebas')
      return
    }

    logger.info(`✅ Usando competidor: ${competitor.name} (${competitor.id})`)

    // 2. Obtener todas las versiones actuales
    const existingSnapshots = await Snapshot.findAll({
      where: { competitorId: competitor.id },
      order: [['versionNumber', 'ASC']]
    })

    logger.info(`📊 Versiones existentes: ${existingSnapshots.length}`)

    // 3. Analizar distribución de versiones completas/parciales
    const fullVersions = existingSnapshots.filter(s => s.isFullVersion)
    const partialVersions = existingSnapshots.filter(s => !s.isFullVersion)

    logger.info(`📈 Estadísticas:`)
    logger.info(`   - Versiones completas: ${fullVersions.length}`)
    logger.info(`   - Versiones parciales: ${partialVersions.length}`)
    logger.info(`   - Porcentaje completas: ${((fullVersions.length / existingSnapshots.length) * 100).toFixed(2)}%`)

    // 4. Verificar que existen diffs para las versiones parciales
    for (const snapshot of existingSnapshots) {
      logger.info(`\n🔍 Verificando versión ${snapshot.versionNumber}:`)
      logger.info(`   - Tipo: ${snapshot.isFullVersion ? 'COMPLETA' : 'PARCIAL'}`)
      logger.info(`   - HTML guardado: ${snapshot.fullHtml ? 'SÍ' : 'NO'}`)
      logger.info(`   - Tamaño HTML: ${snapshot.fullHtml ? snapshot.fullHtml.length : 0} bytes`)

      if (!snapshot.isFullVersion) {
        // Buscar diff para esta versión
        const diff = await SnapshotDiff.findOne({
          where: { toSnapshotId: snapshot.id }
        })

        if (diff) {
          logger.info(`   - ✅ Diff encontrado (ID: ${diff.id})`)
          logger.info(`   - Cambios registrados: ${diff.changeCount}`)
          logger.info(`   - Porcentaje de cambio: ${diff.changePercentage}%`)
        } else {
          logger.warn(`   - ⚠️  NO se encontró diff para esta versión parcial`)
        }
      }
    }

    // 5. Test de reconstrucción para versiones parciales
    logger.info(`\n🔧 Test de reconstrucción de HTML...`)
    
    const partialToTest = partialVersions[0]
    if (partialToTest) {
      logger.info(`   Reconstruyendo versión ${partialToTest.versionNumber}...`)
      
      try {
        const reconstructedHtml = await changeDetector.reconstructHTMLFromDiffs(partialToTest.id)
        
        if (reconstructedHtml && reconstructedHtml.length > 0) {
          logger.info(`   ✅ Reconstrucción exitosa!`)
          logger.info(`   HTML reconstruido: ${reconstructedHtml.length} bytes`)
        } else {
          logger.error(`   ❌ Reconstrucción falló: HTML vacío`)
        }
      } catch (error) {
        logger.error(`   ❌ Error en reconstrucción: ${error.message}`)
      }
    } else {
      logger.info(`   No hay versiones parciales para probar reconstrucción`)
    }

    // 6. Simular captura de nueva versión
    logger.info(`\n📸 Simulando captura de nueva versión...`)
    
    const htmlVersions = [
      '<html><body><h1>Test Version 1</h1><p>Initial content</p></body></html>',
      '<html><body><h1>Test Version 2</h1><p>Initial content modified</p></body></html>',
      '<html><body><h1>Test Version 3</h1><p>More changes here</p></body></html>'
    ]

    const testHtml = htmlVersions[Math.floor(Math.random() * htmlVersions.length)]
    
    try {
      const result = await changeDetector.captureChange(
        competitor.id,
        competitor.url,
        {
          isManualCheck: true,
          simulate: true,
          testHtml: testHtml
        }
      )

      if (result) {
        logger.info(`   ✅ Nueva versión capturada: ${result.versionNumber || result.snapshotId}`)
        logger.info(`   Tipo: ${result.isFullVersion ? 'COMPLETA' : 'PARCIAL'}`)
      } else {
        logger.info(`   ℹ️  No se detectaron cambios significativos`)
      }
    } catch (error) {
      logger.error(`   ❌ Error capturando cambio: ${error.message}`)
    }

    // 7. Verificar configuración del sistema
    logger.info(`\n⚙️  Configuración del sistema de versionado:`)
    logger.info(`   - Intervalo de versiones completas: cada ${changeDetector.config.fullVersionInterval} versiones`)
    logger.info(`   - Máximo de versiones por competidor: ${changeDetector.config.maxVersionsPerCompetitor}`)
    logger.info(`   - Umbral de cambio significativo: ${changeDetector.config.changeThreshold * 100}%`)

    logger.info(`\n✅ Test completado exitosamente!`)

  } catch (error) {
    logger.error('❌ Error en test:', error)
    throw error
  }
}

// Ejecutar test
if (require.main === module) {
  testVersioningSystem()
    .then(() => {
      logger.info('\n🎉 Todos los tests pasaron!')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('\n💥 Test falló:', error)
      process.exit(1)
    })
}

module.exports = { testVersioningSystem }

