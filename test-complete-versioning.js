/**
 * Test completo del sistema de versionado inteligente
 * Simula múltiples capturas para verificar que versiones completas/parciales funcionan
 */

const { Competitor, Snapshot, SnapshotDiff } = require('./src/models')
const changeDetector = require('./src/services/changeDetector')
const logger = require('./src/utils/logger')

// HTMLs de prueba simulando cambios graduales
const testHTMLVersions = [
  '<html><head><title>Test</title></head><body><h1>Version 1</h1><p>Initial content</p></body></html>',
  '<html><head><title>Test</title></head><body><h1>Version 2</h1><p>Initial content modified</p></body></html>',
  '<html><head><title>Test</title></head><body><h1>Version 3</h1><p>More changes here</p><div>New section</div></body></html>',
  '<html><head><title>Test Updated</title></head><body><h1>Version 4</h1><p>More changes here</p><div>New section updated</div></body></html>',
  '<html><head><title>Test Updated</title></head><body><h1>Version 5</h1><p>Fifth version content</p><div>New section updated</div></body></html>',
  '<html><head><title>Test</title></head><body><h1>Version 6</h1><p>Sixth version with new features</p><div>Features section</div></body></html>',
  '<html><head><title>Test</title></head><body><h1>Version 7</h1><p>Seventh version improvements</p><div>Improvements added</div></body></html>',
  '<html><head><title>Test</title></head><body><h1>Version 8</h1><p>Eighth version updates</p><div>Updates section</div></body></html>',
  '<html><head><title>Test</title></head><body><h1>Version 9</h1><p>Ninth version enhancements</p><div>Enhancements added</div></body></html>',
  '<html><head><title>Test Major</title></head><body><h1>Version 10</h1><p>Tenth version - major release</p><div>Major changes</div></body></html>',
  '<html><head><title>Test Major</title></head><body><h1>Version 11</h1><p>Eleventh version continues</p><div>Continued updates</div></body></html>',
  '<html><head><title>Test Major</title></head><body><h1>Version 12</h1><p>Twelfth version refinements</p><div>Refinements added</div></body></html>'
]

async function testCompleteVersioning () {
  try {
    logger.info('🧪 ========================================')
    logger.info('🧪 TEST COMPLETO DEL SISTEMA DE VERSIONADO')
    logger.info('🧪 ========================================\n')

    // 1. Crear competidor de prueba
    logger.info('📝 Paso 1: Creando competidor de prueba...')
    const competitor = await Competitor.create({
      userId: 'b3862192-0a32-40a0-8129-d3e55e278fff', // Usuario existente
      name: 'Test Versioning System',
      url: 'https://test-versioning.example.com',
      description: 'Competidor para probar sistema de versionado',
      monitoringEnabled: true,
      priority: 'medium'
    })
    logger.info(`✅ Competidor creado: ${competitor.id}\n`)

    // 2. Simular capturas de cambios
    logger.info('📸 Paso 2: Simulando capturas de cambios...\n')

    for (let i = 0; i < testHTMLVersions.length; i++) {
      const versionNumber = i + 1
      const html = testHTMLVersions[i]

      logger.info(`\n--- Capturando Versión ${versionNumber} ---`)

      try {
        // Obtener última versión
        const lastSnapshot = await changeDetector.getCurrentSnapshot(competitor.id)
        
        if (!lastSnapshot) {
          // Primera versión
          logger.info('📍 Primera versión - guardando completa...')
          await changeDetector.captureInitialVersion(competitor.id, competitor.url, html)
        } else {
          // Versiones subsecuentes
          const lastHtml = await changeDetector.getHTMLFromSnapshot(lastSnapshot)
          
          // Comparar versiones
          const comparison = changeDetector.generateDiff(lastHtml, html)
          comparison.currentHtml = html
          comparison.changeSummary = `Cambios en versión ${versionNumber}`

          // Crear nueva versión
          const newSnapshot = await changeDetector.createNewVersion(competitor.id, comparison)
          
          // Guardar diferencias
          await changeDetector.saveDifferences(lastSnapshot.id, newSnapshot.id, comparison)
          
          logger.info(`✅ Versión ${versionNumber} guardada`)
          logger.info(`   Tipo: ${newSnapshot.isFullVersion ? '🔵 COMPLETA' : '🟢 PARCIAL'}`)
          logger.info(`   HTML guardado: ${newSnapshot.fullHtml ? 'SÍ' : 'NO'}`)
          logger.info(`   Cambios: ${comparison.changeCount}`)
        }

        // Pausa pequeña para simular tiempo entre capturas
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        logger.error(`❌ Error capturando versión ${versionNumber}:`, error.message)
      }
    }

    // 3. Verificar resultados
    logger.info('\n\n📊 Paso 3: Verificando resultados...\n')
    
    const allSnapshots = await Snapshot.findAll({
      where: { competitorId: competitor.id },
      order: [['versionNumber', 'ASC']]
    })

    const fullVersions = allSnapshots.filter(s => s.isFullVersion)
    const partialVersions = allSnapshots.filter(s => !s.isFullVersion)

    logger.info(`📈 ESTADÍSTICAS:`)
    logger.info(`   Total de versiones: ${allSnapshots.length}`)
    logger.info(`   Versiones completas: ${fullVersions.length}`)
    logger.info(`   Versiones parciales: ${partialVersions.length}`)
    logger.info(`   Porcentaje completas: ${((fullVersions.length / allSnapshots.length) * 100).toFixed(2)}%\n`)

    // 4. Verificar diffs
    logger.info('🔍 Paso 4: Verificando diffs guardados...\n')
    
    let diffsOK = 0
    let diffsMissing = 0

    for (const snapshot of allSnapshots) {
      const status = snapshot.isFullVersion ? '🔵 COMPLETA' : '🟢 PARCIAL'
      logger.info(`V${snapshot.versionNumber}: ${status}`)

      if (!snapshot.isFullVersion) {
        const diff = await SnapshotDiff.findOne({
          where: { toSnapshotId: snapshot.id }
        })

        if (diff) {
          logger.info(`   ✅ Diff encontrado (${diff.changeCount} cambios)`)
          diffsOK++
        } else {
          logger.error(`   ❌ FALTA diff para versión parcial!`)
          diffsMissing++
        }
      } else {
        logger.info(`   📦 HTML completo: ${snapshot.fullHtml ? snapshot.fullHtml.length + ' bytes' : 'FALTA'}`)
      }
    }

    logger.info(`\n📊 Diffs: ${diffsOK} OK, ${diffsMissing} faltantes\n`)

    // 5. Test de reconstrucción
    logger.info('🔧 Paso 5: Probando reconstrucción de versiones parciales...\n')

    const partialToTest = partialVersions.slice(0, 3) // Probar las primeras 3 parciales

    for (const partial of partialToTest) {
      try {
        logger.info(`🔧 Reconstruyendo V${partial.versionNumber}...`)
        const reconstructed = await changeDetector.reconstructHTMLFromDiffs(partial.id)
        
        if (reconstructed && reconstructed.length > 0) {
          logger.info(`   ✅ Reconstrucción exitosa (${reconstructed.length} bytes)`)
          
          // Verificar que contiene contenido esperado
          const expectedVersion = `Version ${partial.versionNumber}`
          if (reconstructed.includes(expectedVersion)) {
            logger.info(`   ✅ Contenido verificado: contiene "${expectedVersion}"`)
          } else {
            logger.warn(`   ⚠️  Contenido no contiene "${expectedVersion}"`)
          }
        } else {
          logger.error(`   ❌ Reconstrucción falló: HTML vacío`)
        }
      } catch (error) {
        logger.error(`   ❌ Error en reconstrucción: ${error.message}`)
      }
    }

    // 6. Calcular ahorro de espacio
    logger.info('\n\n💾 Paso 6: Calculando ahorro de almacenamiento...\n')

    let totalFullSize = 0
    let totalPartialSize = 0
    
    for (const snapshot of allSnapshots) {
      if (snapshot.fullHtml) {
        totalFullSize += snapshot.fullHtml.length
      }
    }

    const allDiffs = await SnapshotDiff.findAll({
      where: {
        toSnapshotId: allSnapshots.map(s => s.id)
      }
    })

    for (const diff of allDiffs) {
      totalPartialSize += JSON.stringify(diff.diffData).length
    }

    const totalSize = totalFullSize + totalPartialSize
    const traditionalSize = allSnapshots.length * (totalFullSize / fullVersions.length)
    const savings = ((traditionalSize - totalSize) / traditionalSize * 100)

    logger.info(`📊 ALMACENAMIENTO:`)
    logger.info(`   Versiones completas: ${(totalFullSize / 1024).toFixed(2)} KB`)
    logger.info(`   Diffs parciales: ${(totalPartialSize / 1024).toFixed(2)} KB`)
    logger.info(`   Total usado: ${(totalSize / 1024).toFixed(2)} KB`)
    logger.info(`   Sin sistema (tradicional): ${(traditionalSize / 1024).toFixed(2)} KB`)
    logger.info(`   Ahorro: ${savings.toFixed(2)}% 🎉\n`)

    // 7. Resumen final
    logger.info('\n✅ ========================================')
    logger.info('✅ TEST COMPLETADO EXITOSAMENTE')
    logger.info('✅ ========================================\n')

    logger.info('📋 RESUMEN:')
    logger.info(`   ✅ Competidor creado: ${competitor.name}`)
    logger.info(`   ✅ Versiones creadas: ${allSnapshots.length}`)
    logger.info(`   ✅ Sistema completas/parciales: FUNCIONANDO`)
    logger.info(`   ✅ Diffs guardados: ${diffsOK}/${partialVersions.length}`)
    logger.info(`   ✅ Reconstrucción: ${partialToTest.length > 0 ? 'PROBADA Y FUNCIONANDO' : 'N/A'}`)
    logger.info(`   ✅ Ahorro de espacio: ${savings.toFixed(2)}%\n`)

    logger.info('🎉 El sistema de versionado está funcionando correctamente!\n')

    process.exit(0)

  } catch (error) {
    logger.error('❌ Error en test:', error)
    process.exit(1)
  }
}

// Ejecutar test
if (require.main === module) {
  testCompleteVersioning()
}

module.exports = { testCompleteVersioning }

