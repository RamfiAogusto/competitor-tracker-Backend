/**
 * Script simple para probar la conexión directa a PostgreSQL
 */

const { Sequelize } = require('sequelize')

async function testSimpleConnection() {
  console.log('🔌 Probando conexión simple a PostgreSQL...')
  
  // Configuración directa
  const sequelize = new Sequelize({
    host: 'localhost',
    port: 5432,
    database: 'Tracker',
    username: 'postgres',
    password: '2004',
    dialect: 'postgres',
    logging: console.log
  })

  try {
    await sequelize.authenticate()
    console.log('✅ ¡Conexión exitosa a PostgreSQL!')
    
    // Probar una consulta simple
    const [results] = await sequelize.query('SELECT version() as version')
    console.log('📊 Versión de PostgreSQL:', results[0].version)
    
    // Crear las tablas
    console.log('🔄 Creando tablas...')
    await sequelize.sync({ force: true })
    console.log('✅ Tablas creadas exitosamente!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await sequelize.close()
    console.log('🔌 Conexión cerrada')
  }
}

testSimpleConnection()
