/**
 * Modelo de Snapshot
 * Define la estructura de la tabla snapshots para el sistema de versionado
 */

const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/config')

const Snapshot = sequelize.define('Snapshot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  competitorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'competitors',
      key: 'id'
    },
    field: 'competitor_id'
  },
  versionNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'version_number'
  },
  fullHtml: {
    type: DataTypes.TEXT,
    field: 'full_html'
  },
  isFullVersion: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_full_version'
  },
  isCurrent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_current'
  },
  changeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'change_count'
  },
  changePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    field: 'change_percentage'
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'low'
  },
  changeType: {
    type: DataTypes.ENUM('content', 'design', 'pricing', 'feature', 'other'),
    defaultValue: 'other',
    field: 'change_type'
  },
  changeSummary: {
    type: DataTypes.TEXT,
    field: 'change_summary'
  }
}, {
  tableName: 'snapshots',
  indexes: [
    {
      unique: true,
      fields: ['competitor_id', 'version_number']
    },
    {
      fields: ['competitor_id', 'is_current']
    },
    {
      fields: ['competitor_id', 'version_number']
    },
    {
      fields: ['created_at']
    }
  ]
})

module.exports = Snapshot
