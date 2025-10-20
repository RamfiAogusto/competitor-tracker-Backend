/**
 * Modelo de Usuario
 * Define la estructura de la tabla users
 */

const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/config')
const bcrypt = require('bcryptjs')

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Permitir null para usuarios de Google
    validate: {
      len: [8, 255]
    }
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    field: 'google_id'
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Avatar de Google o externo'
  },
  customAvatar: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'custom_avatar',
    comment: 'Avatar personalizado subido por el usuario'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 50]
    }
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user',
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'email_verified'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    field: 'last_login_at'
  }
}, {
  tableName: 'users',
  indexes: [
    {
      unique: true,
      fields: ['email']
    }
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12)
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password) {
        user.password = await bcrypt.hash(user.password, 12)
      }
    }
  }
})

// Método para verificar contraseña
User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password)
}

// Método para obtener datos públicos (sin contraseña)
User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get())
  delete values.password
  return values
}

module.exports = User
