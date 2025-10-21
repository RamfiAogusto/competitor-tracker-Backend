/**
 * Migración para crear la tabla snapshot_diffs
 * Esta tabla almacena las diferencias entre versiones consecutivas de snapshots
 */

const { sequelize } = require('../src/database/config')

async function up () {
  const queryInterface = sequelize.getQueryInterface()

  console.log('Creando tabla snapshot_diffs...')

  await queryInterface.createTable('snapshot_diffs', {
    id: {
      type: 'UUID',
      defaultValue: sequelize.literal('gen_random_uuid()'),
      primaryKey: true
    },
    from_snapshot_id: {
      type: 'UUID',
      allowNull: false,
      references: {
        model: 'snapshots',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    to_snapshot_id: {
      type: 'UUID',
      allowNull: false,
      references: {
        model: 'snapshots',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    diff_data: {
      type: 'JSONB',
      allowNull: false
    },
    change_summary: {
      type: 'TEXT',
      allowNull: true
    },
    change_count: {
      type: 'INTEGER',
      defaultValue: 0
    },
    change_percentage: {
      type: 'DECIMAL(5, 2)',
      allowNull: true
    },
    created_at: {
      type: 'TIMESTAMP',
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: 'TIMESTAMP',
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    }
  })

  // Crear índices
  await queryInterface.addIndex('snapshot_diffs', ['from_snapshot_id'], {
    name: 'idx_snapshot_diffs_from_snapshot'
  })

  await queryInterface.addIndex('snapshot_diffs', ['to_snapshot_id'], {
    name: 'idx_snapshot_diffs_to_snapshot'
  })

  await queryInterface.addIndex('snapshot_diffs', ['from_snapshot_id', 'to_snapshot_id'], {
    name: 'idx_snapshot_diffs_unique_pair',
    unique: true
  })

  // Crear índice GIN para búsquedas en JSONB
  await sequelize.query('CREATE INDEX IF NOT EXISTS idx_snapshot_diffs_data ON snapshot_diffs USING gin (diff_data);')

  console.log('✅ Tabla snapshot_diffs creada exitosamente')
}

async function down () {
  const queryInterface = sequelize.getQueryInterface()

  console.log('Eliminando tabla snapshot_diffs...')
  await queryInterface.dropTable('snapshot_diffs')
  console.log('✅ Tabla snapshot_diffs eliminada')
}

// Ejecutar migración
if (require.main === module) {
  up()
    .then(() => {
      console.log('✅ Migración completada exitosamente')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Error en migración:', error)
      process.exit(1)
    })
}

module.exports = { up, down }

