/**
 * Modelo de Alertas
 * Gestiona las alertas de cambios detectados en competidores
 */

const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/config')

const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'user_id'
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
  snapshotId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'snapshots',
      key: 'id'
    },
    field: 'snapshot_id'
  },
  type: {
    type: DataTypes.ENUM('content_change', 'price_change', 'new_page', 'page_removed', 'error'),
    allowNull: false,
    defaultValue: 'content_change'
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false,
    defaultValue: 'low'
  },
  status: {
    type: DataTypes.ENUM('unread', 'read', 'archived'),
    allowNull: false,
    defaultValue: 'unread'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  changeCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'change_count'
  },
  changePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'change_percentage'
  },
  versionNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'version_number'
  },
  changeSummary: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'change_summary'
  },
  affectedSections: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'affected_sections'
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'read_at'
  },
  archivedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'archived_at'
  }
}, {
  tableName: 'alerts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id', 'status']
    },
    {
      fields: ['competitor_id', 'created_at']
    },
    {
      fields: ['severity', 'created_at']
    },
    {
      fields: ['type', 'created_at']
    }
  ]
})

// Asociaciones
Alert.associate = (models) => {
  // Una alerta pertenece a un usuario
  Alert.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  })

  // Una alerta pertenece a un competidor
  Alert.belongsTo(models.Competitor, {
    foreignKey: 'competitorId',
    as: 'competitor'
  })

  // Una alerta puede estar relacionada con un snapshot
  Alert.belongsTo(models.Snapshot, {
    foreignKey: 'snapshotId',
    as: 'snapshot'
  })
}

module.exports = Alert
