/**
 * Test mínimo del backend
 * Verifica funcionalidad básica paso a paso
 */

const axios = require('axios')

class MinimalTest {
  constructor() {
    this.baseURL = 'http://localhost:3002/api'
    this.authToken = null
  }

  async run() {
    console.log('🧪 Test mínimo del backend')
    console.log('=' .repeat(40))

    try {
      await this.testServerHealth()
      await this.testUserRegistration()
      await this.testUserLogin()
      await this.testAddCompetitor()
      await this.testViewCompetitors()
      console.log('\n✅ Test mínimo completado exitosamente!')
    } catch (error) {
      console.error('\n❌ Error en test mínimo:', error.message)
      process.exit(1)
    }
  }

  async testServerHealth() {
    console.log('\n🏥 Test 1: Health check')
    
    const response = await axios.get('http://localhost:3002/health')
    
    if (response.status !== 200) {
      throw new Error(`Servidor no responde: ${response.status}`)
    }

    console.log('✅ Servidor funcionando correctamente')
  }

  async testUserRegistration() {
    console.log('\n📝 Test 2: Registro de usuario')
    
    const userData = {
      email: 'test-minimal@example.com',
      password: 'TestPassword123!',
      name: 'Test Minimal'
    }

    const response = await axios.post(`${this.baseURL}/users/register`, userData)
    
    if (response.status !== 201) {
      throw new Error(`Error en registro: ${response.status}`)
    }

    const { user, tokens } = response.data.data
    this.authToken = tokens.accessToken

    console.log(`✅ Usuario registrado: ${user.email}`)
    console.log(`   Token: ${!!tokens.accessToken}`)

    // Esperar sincronización
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  async testUserLogin() {
    console.log('\n🔑 Test 3: Login de usuario')
    
    const loginData = {
      email: 'test-minimal@example.com',
      password: 'TestPassword123!'
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
    console.log('\n🏢 Test 4: Agregar competidor')
    
    const competitorData = {
      name: 'Competidor Test',
      url: 'https://test-competitor.com',
      description: 'Competidor para test mínimo'
    }

    const response = await axios.post(`${this.baseURL}/competitors`, competitorData, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (response.status !== 201) {
      throw new Error(`Error agregando competidor: ${response.status}`)
    }

    const competitor = response.data.data
    console.log(`✅ Competidor agregado: ${competitor.name}`)
    console.log(`   ID: ${competitor.id}`)
  }

  async testViewCompetitors() {
    console.log('\n📋 Test 5: Ver competidores')
    
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
  }
}

// Ejecutar test
const test = new MinimalTest()
test.run().catch(console.error)
