/**
 * Test simple para autenticación de usuarios
 * Verifica solo el registro y login básico
 */

const axios = require('axios')
const { User } = require('../src/models')
const { testConnection, syncModels } = require('../src/database/config')

class UsersAuthSimpleTest {
  constructor() {
    this.baseURL = 'http://localhost:3002/api'
    this.testUser = null
    this.authToken = null
  }

  async run() {
    console.log('🔐 Iniciando test simple de autenticación')
    console.log('=' .repeat(50))

    try {
      await this.setup()
      await this.testUserRegistration()
      await this.testUserLogin()
      await this.cleanup()

      console.log('\n✅ Test simple de autenticación completado!')
    } catch (error) {
      console.error('\n❌ Error en test:', error.message)
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
    console.log('\n📝 Test: Registro de usuario')
    
    const userData = {
      email: 'test-simple@example.com',
      password: 'TestPassword123!',
      name: 'Test Simple'
    }

    try {
      const response = await axios.post(`${this.baseURL}/users/register`, userData)
      
      if (response.status !== 201) {
        throw new Error(`Error: ${response.status}`)
      }

      const { user, tokens } = response.data.data
      this.testUser = user
      this.authToken = tokens.accessToken

      console.log(`✅ Usuario registrado: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Tokens generados: ${!!tokens.accessToken}`)

      // Esperar un poco para que se complete la transacción
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verificar en base de datos
      const dbUser = await User.findByPk(user.id)
      if (!dbUser) {
        throw new Error('Usuario no encontrado en BD')
      }
      console.log(`✅ Usuario verificado en BD: ${dbUser.email}`)

    } catch (error) {
      console.error('❌ Error en registro:', error.message)
      throw error
    }
  }

  async testUserLogin() {
    console.log('\n🔑 Test: Login de usuario')
    
    const loginData = {
      email: 'test-simple@example.com',
      password: 'TestPassword123!'
    }

    try {
      const response = await axios.post(`${this.baseURL}/users/login`, loginData)
      
      if (response.status !== 200) {
        throw new Error(`Error: ${response.status}`)
      }

      const { user, tokens } = response.data.data

      console.log(`✅ Login exitoso: ${user.email}`)
      console.log(`   Nuevos tokens generados: ${!!tokens.accessToken}`)

    } catch (error) {
      console.error('❌ Error en login:', error.message)
      throw error
    }
  }

  async cleanup() {
    console.log('\n🧹 Limpiando...')
    
    try {
      if (this.testUser) {
        await User.destroy({
          where: { id: this.testUser.id },
          force: true
        })
        console.log('✅ Usuario eliminado')
      }
    } catch (error) {
      console.error('⚠️ Error en limpieza:', error.message)
    }
  }
}

// Ejecutar test
if (require.main === module) {
  const test = new UsersAuthSimpleTest()
  test.run().catch(console.error)
}

module.exports = UsersAuthSimpleTest
