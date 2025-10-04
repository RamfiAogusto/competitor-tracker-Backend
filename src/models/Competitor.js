/**
 * Modelo de Competidor
 * Define la estructura de la tabla competitors
 */

const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/config')

const Competitor = sequelize.define('Competitor', {
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
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 100]
    }
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      isUrl: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    validate: {
      len: [0, 500]
    }
  },
  monitoringEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'monitoring_enabled'
  },
  checkInterval: {
    type: DataTypes.INTEGER,
    defaultValue: 3600, // 1 hora en segundos
    validate: {
      min: 300, // 5 minutos mínimo
      max: 86400 // 24 horas máximo
    },
    field: 'check_interval'
  },
  lastCheckedAt: {
    type: DataTypes.DATE,
    field: 'last_checked_at'
  },
  totalVersions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_versions'
  },
  lastChangeAt: {
    type: DataTypes.DATE,
    field: 'last_change_at'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'competitors',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['monitoring_enabled']
    },
    {
      fields: ['last_checked_at']
    },
  ]
})

module.exports = Competitor
