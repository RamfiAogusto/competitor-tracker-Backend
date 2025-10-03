/**
 * Script para probar la conexión a la base de datos
 * Ejecutar con: node test-db-connection.js
 */

require('dotenv').config({ path: __dirname + '/.env' })
const { testConnection, syncModels } = require('./src/database/config')
const { User, Competitor, Snapshot } = require('./src/models')

async function testDatabaseConnection() {
  // Forzar las variables de entorno correctas
  process.env.DB_NAME = 'Tracker'
  process.env.DB_PASSWORD = '2004'
  
  console.log('🔌 Probando conexión a PostgreSQL...')
  console.log(`Host: ${process.env.DB_HOST || 'localhost'}`)
  console.log(`Port: ${process.env.DB_PORT || '5432'}`)
  console.log(`Database: ${process.env.DB_NAME}`)
  console.log(`User: ${process.env.DB_USER || 'postgres'}`)
  
  try {
    // Probar conexión
    const connected = await testConnection()
    
    if (connected) {
      console.log('✅ Conexión exitosa!')
      
      // Probar sincronización de modelos
      console.log('🔄 Probando sincronización de modelos...')
      await syncModels(true) // force = true para recrear tablas
      
      console.log('✅ Modelos sincronizados correctamente!')
      console.log('📋 Tablas creadas:')
      console.log('   - users')
      console.log('   - competitors') 
      console.log('   - snapshots')
      
    } else {
      console.log('❌ No se pudo conectar a la base de datos')
      console.log('🔍 Verifica que:')
      console.log('   1. PostgreSQL esté ejecutándose')
      console.log('   2. La base de datos "tracker" exista')
      console.log('   3. Las credenciales sean correctas')
      console.log('   4. El usuario tenga permisos')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    
    if (error.message.includes('password authentication failed')) {
      console.log('🔑 Error de autenticación - verifica la contraseña')
    } else if (error.message.includes('database "tracker" does not exist')) {
      console.log('🗄️ La base de datos "tracker" no existe')
    } else if (error.message.includes('connect ECONNREFUSED')) {
      console.log('🔌 PostgreSQL no está ejecutándose o no está en el puerto correcto')
    }
  }
  
  process.exit(0)
}

testDatabaseConnection()
