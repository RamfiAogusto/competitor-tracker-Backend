/**
 * Test simple del flujo de usuario
 * Verifica funcionalidad básica sin casos complejos
 */

const axios = require('axios')
const { User, Competitor, Snapshot } = require('../src/models')
const { testConnection, syncModels } = require('../src/database/config')

class SimpleFlowTest {
  constructor() {
    this.baseURL = 'http://localhost:3002/api'
    this.user = null
    this.authToken = null
    this.competitor = null
  }

  async run() {
    console.log('👤 Test simple del flujo de usuario')
    console.log('=' .repeat(50))

    try {
      await this.setup()
      await this.testUserRegistration()
      await this.testUserLogin()
      await this.testAddCompetitor()
      await this.testViewCompetitors()
      await this.testMonitoringControl()
      await this.cleanup()

      console.log('\n✅ Flujo simple completado exitosamente!')
    } catch (error) {
      console.error('\n❌ Error en flujo simple:', error.message)
      await this.cleanup()
      process.exit(1)
    }
  }

  async setup() {
    console.log('🔧 Configurando entorno...')
    await testConnection()
    await syncModels()
    console.log(`🌐 Servidor: ${this.baseURL}`)
  }

  async testUserRegistration() {
    console.log('\n📝 Paso 1: Registro de usuario')
    
    const userData = {
      email: 'usuario-simple@example.com',
      password: 'MiPassword123!',
      name: 'Usuario Simple'
    }

    const response = await axios.post(`${this.baseURL}/users/register`, userData)
    
    if (response.status !== 201) {
      throw new Error(`Error en registro: ${response.status}`)
    }

    const { user, tokens } = response.data.data
    this.user = user
    this.authToken = tokens.accessToken

    console.log(`✅ Usuario registrado: ${user.email}`)
    console.log(`   ID: ${user.id}`)

    // Esperar sincronización de BD
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  async testUserLogin() {
    console.log('\n🔑 Paso 2: Login de usuario')
    
    const loginData = {
      email: 'usuario-simple@example.com',
      password: 'MiPassword123!'
    }

    const response = await axios.post(`${this.baseURL}/users/login`, loginData)
    
    if (response.status !== 200) {
      throw new Error(`Error en login: ${response.status}`)
    }

    const { user, tokens } = response.data.data
    this.authToken = tokens.accessToken

    console.log(`✅ Login exitoso: ${user.email}`)
  }

  async testAddCompetitor() {
    console.log('\n🏢 Paso 3: Agregar competidor')
    
    const competitorData = {
      name: 'Mi Competidor Simple',
      url: 'https://mi-competidor-simple.com',
      description: 'Competidor para pruebas simples'
    }

    const response = await axios.post(`${this.baseURL}/competitors`, competitorData, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (response.status !== 201) {
      throw new Error(`Error agregando competidor: ${response.status}`)
    }

    this.competitor = response.data.data

    console.log(`✅ Competidor agregado: ${this.competitor.name}`)
    console.log(`   ID: ${this.competitor.id}`)
    console.log(`   URL: ${this.competitor.url}`)
  }

  async testViewCompetitors() {
    console.log('\n📋 Paso 4: Ver lista de competidores')
    
    const response = await axios.get(`${this.baseURL}/competitors`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      },
      params: {
        page: 1,
        limit: 10
      }
    })

    if (response.status !== 200) {
      throw new Error(`Error obteniendo competidores: ${response.status}`)
    }

    const { data, pagination } = response.data

    console.log(`✅ Competidores obtenidos: ${data.length}`)
    console.log(`   Total: ${pagination.total}`)
    console.log(`   Página: ${pagination.page}/${pagination.totalPages}`)

    data.forEach((competitor, index) => {
      console.log(`   ${index + 1}. ${competitor.name} - ${competitor.url}`)
    })
  }

  async testMonitoringControl() {
    console.log('\n⚙️ Paso 5: Control de monitoreo')
    
    // Deshabilitar monitoreo
    const disableResponse = await axios.post(`${this.baseURL}/competitors/${this.competitor.id}/disable-monitoring`, {}, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (disableResponse.status !== 200) {
      throw new Error(`Error deshabilitando monitoreo: ${disableResponse.status}`)
    }

    console.log('✅ Monitoreo deshabilitado')

    // Habilitar monitoreo
    const enableResponse = await axios.post(`${this.baseURL}/competitors/${this.competitor.id}/enable-monitoring`, {}, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (enableResponse.status !== 200) {
      throw new Error(`Error habilitando monitoreo: ${enableResponse.status}`)
    }

    console.log('✅ Monitoreo habilitado')
  }

  async cleanup() {
    console.log('\n🧹 Limpiando datos de test...')
    
    try {
      // Eliminar competidor
      if (this.competitor) {
        await Competitor.destroy({
          where: { id: this.competitor.id },
          force: true
        })
      }

      // Eliminar usuario
      if (this.user) {
        await User.destroy({
          where: { id: this.user.id },
          force: true
        })
      }

      console.log('✅ Limpieza completada')
    } catch (error) {
      console.error('⚠️ Error durante limpieza:', error.message)
    }
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  const test = new SimpleFlowTest()
  test.run().catch(console.error)
}

module.exports = SimpleFlowTest
