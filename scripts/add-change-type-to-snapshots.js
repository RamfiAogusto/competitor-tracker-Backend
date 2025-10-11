/**
 * Script para agregar la columna change_type a la tabla snapshots
 * Ejecutar: node scripts/add-change-type-to-snapshots.js
 */

const { sequelize } = require('../src/database/config')
const logger = require('../src/utils/logger')

async function addChangeTypeColumn() {
  try {
    logger.info('Iniciando migración: Agregar columna change_type a snapshots')

    // Verificar si la columna ya existe
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'snapshots' 
      AND column_name = 'change_type'
    `)

    if (results.length > 0) {
      logger.info('La columna change_type ya existe, no es necesario agregarla')
      return
    }

    // Crear el tipo ENUM si no existe
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE change_type_enum AS ENUM ('content', 'design', 'pricing', 'feature', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    logger.info('Tipo ENUM change_type_enum creado o ya existía')

    // Agregar la columna
    await sequelize.query(`
      ALTER TABLE snapshots 
      ADD COLUMN IF NOT EXISTS change_type change_type_enum DEFAULT 'other'
    `)
    logger.info('Columna change_type agregada exitosamente')

    // Actualizar registros existentes - clasificar basado en changeSummary
    logger.info('Clasificando cambios existentes...')

    // Cambios de pricing
    await sequelize.query(`
      UPDATE snapshots 
      SET change_type = 'pricing'
      WHERE change_type = 'other' 
      AND (
        LOWER(change_summary) LIKE '%precio%' OR
        LOWER(change_summary) LIKE '%plan%' OR
        LOWER(change_summary) LIKE '%$/mes%' OR
        LOWER(change_summary) LIKE '%$/month%' OR
        LOWER(change_summary) LIKE '%descuento%' OR
        LOWER(change_summary) LIKE '%discount%'
      )
    `)

    // Cambios de features
    await sequelize.query(`
      UPDATE snapshots 
      SET change_type = 'feature'
      WHERE change_type = 'other' 
      AND (
        LOWER(change_summary) LIKE '%funcionalidad%' OR
        LOWER(change_summary) LIKE '%feature%' OR
        LOWER(change_summary) LIKE '%integr%' OR
        LOWER(change_summary) LIKE '%api%' OR
        LOWER(change_summary) LIKE '%herramienta%'
      )
    `)

    // Cambios de diseño
    await sequelize.query(`
      UPDATE snapshots 
      SET change_type = 'design'
      WHERE change_type = 'other' 
      AND (
        LOWER(change_summary) LIKE '%diseño%' OR
        LOWER(change_summary) LIKE '%design%' OR
        LOWER(change_summary) LIKE '%color%' OR
        LOWER(change_summary) LIKE '%interfaz%' OR
        LOWER(change_summary) LIKE '%ui%' OR
        LOWER(change_summary) LIKE '%layout%'
      )
    `)

    // El resto queda como 'content' (default 'other')
    await sequelize.query(`
      UPDATE snapshots 
      SET change_type = 'content'
      WHERE change_type = 'other' 
      AND change_summary IS NOT NULL
    `)

    logger.info('✅ Migración completada exitosamente')
    
    // Mostrar estadísticas
    const [stats] = await sequelize.query(`
      SELECT change_type, COUNT(*) as count
      FROM snapshots
      GROUP BY change_type
      ORDER BY count DESC
    `)
    
    logger.info('Estadísticas de changeType:', stats)

  } catch (error) {
    logger.error('❌ Error en migración:', error)
    throw error
  } finally {
    await sequelize.close()
  }
}

// Ejecutar migración
addChangeTypeColumn()
  .then(() => {
    logger.info('Script finalizado')
    process.exit(0)
  })
  .catch(error => {
    logger.error('Script falló:', error)
    process.exit(1)
  })

