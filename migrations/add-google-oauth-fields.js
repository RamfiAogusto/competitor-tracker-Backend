/**
 * Migración para agregar campos de Google OAuth al modelo User
 */

const { DataTypes } = require('sequelize')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Agregar campos para Google OAuth
    await queryInterface.addColumn('Users', 'googleId', {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: 'google_id'
    })

    await queryInterface.addColumn('Users', 'avatar', {
      type: DataTypes.STRING,
      allowNull: true
    })

    // Hacer que el campo password sea opcional (para usuarios de Google)
    await queryInterface.changeColumn('Users', 'password', {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [8, 255]
      }
    })

    // Agregar índice único para googleId
    await queryInterface.addIndex('Users', ['googleId'], {
      unique: true,
      name: 'users_google_id_unique'
    })
  },

  down: async (queryInterface, Sequelize) => {
    // Remover índice
    await queryInterface.removeIndex('Users', 'users_google_id_unique')

    // Remover columnas
    await queryInterface.removeColumn('Users', 'googleId')
    await queryInterface.removeColumn('Users', 'avatar')

    // Restaurar campo password como requerido
    await queryInterface.changeColumn('Users', 'password', {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [8, 255]
      }
    })
  }
}
