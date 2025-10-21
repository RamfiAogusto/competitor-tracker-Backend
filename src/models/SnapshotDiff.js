/**
 * Modelo de SnapshotDiff
 * Define la estructura de la tabla snapshot_diffs para almacenar diferencias entre versiones
 */

const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/config')

const SnapshotDiff = sequelize.define('SnapshotDiff', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  fromSnapshotId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'snapshots',
      key: 'id'
    },
    field: 'from_snapshot_id'
  },
  toSnapshotId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'snapshots',
      key: 'id'
    },
    field: 'to_snapshot_id'
  },
  diffData: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Contiene las diferencias específicas entre versiones',
    field: 'diff_data'
  },
  changeSummary: {
    type: DataTypes.TEXT,
    field: 'change_summary'
  },
  changeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'change_count'
  },
  changePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    field: 'change_percentage'
  }
}, {
  tableName: 'snapshot_diffs',
  indexes: [
    {
      fields: ['from_snapshot_id']
    },
    {
      fields: ['to_snapshot_id']
    },
    {
      unique: true,
      fields: ['from_snapshot_id', 'to_snapshot_id']
    }
  ]
})

module.exports = SnapshotDiff

