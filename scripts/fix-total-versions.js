/**
 * Script para sincronizar el campo totalVersions de todos los competidores
 * con el número real de snapshots en la BD
 */

const { sequelize } = require('../src/database/config')
const { Snapshot, Competitor } = require('../src/models')
const logger = require('../src/utils/logger')

async function fixTotalVersions() {
  try {
    logger.info('🔧 Iniciando sincronización de totalVersions')

    // Obtener todos los competidores activos
    const competitors = await Competitor.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'totalVersions']
    })

    logger.info(`📊 Encontrados ${competitors.length} competidores activos`)

    let updated = 0
    let unchanged = 0

    for (const competitor of competitors) {
      // Contar snapshots reales
      const realSnapshotCount = await Snapshot.count({
        where: { competitorId: competitor.id }
      })

      const currentTotal = competitor.totalVersions || 0

      logger.info(`Competidor: ${competitor.name}`, {
        id: competitor.id,
        totalVersionsActual: currentTotal,
        snapshotsReales: realSnapshotCount,
        necesitaActualización: currentTotal !== realSnapshotCount
      })

      // Actualizar si no coincide
      if (currentTotal !== realSnapshotCount) {
        await competitor.update({ totalVersions: realSnapshotCount })
        logger.info(`✅ Actualizado: ${competitor.name} de ${currentTotal} a ${realSnapshotCount}`)
        updated++
      } else {
        unchanged++
      }
    }

    logger.info('🎉 Sincronización completada', {
      total: competitors.length,
      actualizados: updated,
      sinCambios: unchanged
    })

  } catch (error) {
    logger.error('❌ Error en sincronización:', error)
    throw error
  } finally {
    await sequelize.close()
  }
}

// Ejecutar script
fixTotalVersions()
  .then(() => {
    logger.info('Script finalizado exitosamente')
    process.exit(0)
  })
  .catch(error => {
    logger.error('Script falló:', error)
    process.exit(1)
  })

