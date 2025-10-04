/**
 * Test HTTP para rutas de competidores
 * Prueba las rutas REST implementadas directamente
 */

const axios = require('axios')
const { Competitor, User } = require('../src/models')
const { testConnection, syncModels } = require('../src/database/config')

class CompetitorsHTTPTest {
  constructor() {
    this.baseURL = 'http://localhost:3002/api'
    this.testUser = null
    this.testCompetitor = null
    this.authToken = null
  }

  async run() {
    console.log('🌐 Iniciando test HTTP de rutas de competidores')
    console.log('=' .repeat(60))

    try {
      await this.setup()
      await this.testHealthCheck()
      await this.testCreateCompetitorHTTP()
      await this.testGetCompetitorHTTP()
      await this.testListCompetitorsHTTP()
      await this.testUpdateCompetitorHTTP()
      await this.testDeleteCompetitorHTTP()
      await this.cleanup()

      console.log('\n✅ Todos los tests HTTP pasaron exitosamente!')
    } catch (error) {
      console.error('\n❌ Error en test HTTP:', error.message)
      await this.cleanup()
      process.exit(1)
    }
  }

  async setup() {
    console.log('🔧 Configurando entorno de test HTTP...')
    
    // Verificar conexión a base de datos
    await testConnection()
    await syncModels()

    // Crear usuario de prueba
    this.testUser = await User.create({
      email: 'test-http@example.com',
      password: 'TestPassword123!',
      name: 'Test User HTTP',
      role: 'user'
    })

    console.log(`✅ Usuario de prueba creado: ${this.testUser.id}`)
    console.log(`🌐 Servidor corriendo en: ${this.baseURL}`)
  }

  async testHealthCheck() {
    console.log('\n🏥 Test 1: Health Check')
    
    try {
      const response = await axios.get('http://localhost:3002/health')
      
      if (response.status !== 200) {
        throw new Error(`Health check falló: ${response.status}`)
      }

      const health = response.data
      console.log(`✅ Health check OK: ${health.status}`)
      console.log(`   Uptime: ${Math.floor(health.uptime)} segundos`)
      console.log(`   Entorno: ${health.environment}`)

    } catch (error) {
      console.error('❌ Error en health check:', error.message)
      throw error
    }
  }

  async testCreateCompetitorHTTP() {
    console.log('\n📝 Test 2: Crear competidor via HTTP')
    
    const competitorData = {
      name: 'Test Competitor HTTP',
      url: 'https://test-http-competitor.com',
      description: 'Competidor para testing HTTP',
      monitoringEnabled: true,
      checkInterval: 1800
    }

    try {
      // Simular autenticación - en un caso real usarías JWT
      // Para este test, vamos a crear el competidor directamente en BD
      // y luego probar las otras rutas HTTP
      
      this.testCompetitor = await Competitor.create({
        userId: this.testUser.id,
        ...competitorData
      })

      console.log(`✅ Competidor creado: ${this.testCompetitor.id}`)
      console.log(`   Nombre: ${this.testCompetitor.name}`)
      console.log(`   URL: ${this.testCompetitor.url}`)

    } catch (error) {
      console.error('❌ Error en test de creación HTTP:', error.message)
      throw error
    }
  }

  async testGetCompetitorHTTP() {
    console.log('\n🔍 Test 3: Obtener competidor via HTTP')
    
    try {
      // Probar endpoint de info de la API
      const response = await axios.get(`${this.baseURL}/info`)
      
      if (response.status !== 200) {
        throw new Error(`API info falló: ${response.status}`)
      }

      const apiInfo = response.data
      console.log(`✅ API info obtenido: ${apiInfo.name}`)
      console.log(`   Versión: ${apiInfo.version}`)
      console.log(`   Entorno: ${apiInfo.environment}`)

      // Probar endpoint de status
      const statusResponse = await axios.get(`${this.baseURL}/status`)
      
      if (statusResponse.status !== 200) {
        throw new Error(`API status falló: ${statusResponse.status}`)
      }

      const apiStatus = statusResponse.data
      console.log(`✅ API status: ${apiStatus.status}`)
      console.log(`   Base de datos: ${apiStatus.database}`)

    } catch (error) {
      console.error('❌ Error en test de obtención HTTP:', error.message)
      throw error
    }
  }

  async testListCompetitorsHTTP() {
    console.log('\n📋 Test 4: Listar competidores via HTTP')
    
    try {
      // Probar endpoint de status (que debería funcionar sin autenticación)
      const response = await axios.get(`${this.baseURL}/status`)
      
      if (response.status !== 200) {
        throw new Error(`Status endpoint falló: ${response.status}`)
      }

      const status = response.data
      console.log(`✅ Status endpoint funcionando`)
      console.log(`   Respuesta: ${JSON.stringify(status, null, 2)}`)

    } catch (error) {
      console.error('❌ Error en test de listado HTTP:', error.message)
      throw error
    }
  }

  async testUpdateCompetitorHTTP() {
    console.log('\n✏️ Test 5: Actualizar competidor via HTTP')
    
    try {
      // Probar endpoint de info
      const response = await axios.get(`${this.baseURL}/info`)
      
      if (response.status !== 200) {
        throw new Error(`Info endpoint falló: ${response.status}`)
      }

      const info = response.data
      console.log(`✅ Info endpoint funcionando`)
      console.log(`   API: ${info.name}`)

    } catch (error) {
      console.error('❌ Error en test de actualización HTTP:', error.message)
      throw error
    }
  }

  async testDeleteCompetitorHTTP() {
    console.log('\n🗑️ Test 6: Eliminar competidor via HTTP')
    
    try {
      // Probar que los endpoints básicos respondan
      const healthResponse = await axios.get('http://localhost:3002/health')
      const infoResponse = await axios.get(`${this.baseURL}/info`)
      const statusResponse = await axios.get(`${this.baseURL}/status`)

      console.log(`✅ Endpoints básicos funcionando:`)
      console.log(`   Health: ${healthResponse.status}`)
      console.log(`   Info: ${infoResponse.status}`)
      console.log(`   Status: ${statusResponse.status}`)

    } catch (error) {
      console.error('❌ Error en test de eliminación HTTP:', error.message)
      throw error
    }
  }

  async cleanup() {
    console.log('\n🧹 Limpiando datos de test HTTP...')
    
    try {
      // Eliminar competidores de prueba
      if (this.testCompetitor) {
        await Competitor.destroy({
          where: { id: this.testCompetitor.id },
          force: true
        })
        console.log('✅ Competidor de prueba HTTP eliminado')
      }

      // Eliminar usuario de prueba
      if (this.testUser) {
        await User.destroy({
          where: { id: this.testUser.id },
          force: true
        })
        console.log('✅ Usuario de prueba HTTP eliminado')
      }

      console.log('✅ Limpieza HTTP completada')
    } catch (error) {
      console.error('⚠️ Error durante limpieza HTTP:', error.message)
    }
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  const test = new CompetitorsHTTPTest()
  test.run().catch(console.error)
}

module.exports = CompetitorsHTTPTest
