/**
 * Migración para hacer nullable la columna password en users
 * Permite usuarios con Google OAuth sin contraseña
 */

const { sequelize } = require('../src/database/config')

async function up () {
  const queryInterface = sequelize.getQueryInterface()

  console.log('Modificando columna password a nullable...')

  await queryInterface.changeColumn('users', 'password', {
    type: 'VARCHAR(255)',
    allowNull: true
  })

  console.log('✅ Columna password ahora es nullable')
}

async function down () {
  const queryInterface = sequelize.getQueryInterface()

  console.log('Revirtiendo: haciendo password NOT NULL...')
  
  // Primero establecer un password por defecto para los usuarios de Google
  await sequelize.query(`
    UPDATE users 
    SET password = 'GOOGLE_OAUTH_USER' 
    WHERE password IS NULL AND google_id IS NOT NULL;
  `)

  await queryInterface.changeColumn('users', 'password', {
    type: 'VARCHAR(255)',
    allowNull: false
  })

  console.log('✅ Columna password revertida a NOT NULL')
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


