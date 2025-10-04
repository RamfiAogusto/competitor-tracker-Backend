/**
 * Test completo de autenticación de usuarios
 * Verifica registro, login, perfil, actualización, refresh token y logout
 */

const axios = require('axios')
const { User } = require('../src/models')
const { testConnection, syncModels } = require('../src/database/config')

class UsersAuthCompleteTest {
  constructor() {
    this.baseURL = 'http://localhost:3002/api'
    this.testUser = null
    this.authToken = null
    this.refreshToken = null
  }

  async run() {
    console.log('🔐 Test completo de autenticación de usuarios')
    console.log('=' .repeat(60))

    try {
      await this.setup()
      await this.testUserRegistration()
      await this.testUserLogin()
      await this.testUserProfile()
      await this.testUserUpdate()
      await this.testRefreshToken()
      await this.testUserLogout()
      await this.testErrorCases()
      await this.cleanup()

      console.log('\n✅ Todos los tests de autenticación completados exitosamente!')
    } catch (error) {
      console.error('\n❌ Error en test de autenticación:', error.message)
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
    console.log('\n📝 Test 1: Registro de usuario')
    
    const userData = {
      email: 'test-complete@example.com',
      password: 'TestPassword123!',
      name: 'Test Complete'
    }

    try {
      const response = await axios.post(`${this.baseURL}/users/register`, userData)
      
      if (response.status !== 201) {
        throw new Error(`Error: ${response.status}`)
      }

      const { user, tokens } = response.data.data
      this.testUser = user
      this.authToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken

      console.log(`✅ Usuario registrado: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Tokens generados: ${!!tokens.accessToken}`)

      // Esperar para sincronización de BD
      await new Promise(resolve => setTimeout(resolve, 1000))

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
    console.log('\n🔑 Test 2: Login de usuario')
    
    const loginData = {
      email: 'test-complete@example.com',
      password: 'TestPassword123!'
    }

    try {
      const response = await axios.post(`${this.baseURL}/users/login`, loginData)
      
      if (response.status !== 200) {
        throw new Error(`Error: ${response.status}`)
      }

      const { user, tokens } = response.data.data

      console.log(`✅ Login exitoso: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Nuevos tokens generados: ${!!tokens.accessToken}`)

      // Actualizar tokens
      this.authToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken

    } catch (error) {
      console.error('❌ Error en login:', error.message)
      throw error
    }
  }

  async testUserProfile() {
    console.log('\n👤 Test 3: Obtener perfil de usuario')
    
    try {
      const response = await axios.get(`${this.baseURL}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })
      
      if (response.status !== 200) {
        throw new Error(`Error: ${response.status}`)
      }

      const user = response.data.data

      console.log(`✅ Perfil obtenido: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Nombre: ${user.name}`)
      console.log(`   Rol: ${user.role}`)

      // Verificar que no se exponga la contraseña
      if (user.password) {
        throw new Error('La contraseña no debería estar en la respuesta')
      }
      console.log('✅ Contraseña no expuesta en respuesta')

    } catch (error) {
      console.error('❌ Error en perfil:', error.message)
      throw error
    }
  }

  async testUserUpdate() {
    console.log('\n✏️ Test 4: Actualizar perfil de usuario')
    
    const updateData = {
      name: 'Test Complete - Actualizado',
      email: 'test-complete-updated@example.com'
    }

    try {
      const response = await axios.put(`${this.baseURL}/users/profile`, updateData, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })
      
      if (response.status !== 200) {
        throw new Error(`Error: ${response.status}`)
      }

      const user = response.data.data

      console.log(`✅ Perfil actualizado: ${user.name}`)
      console.log(`   Email: ${user.email}`)

      // Verificar cambios
      if (user.name !== updateData.name) {
        throw new Error('Nombre no se actualizó correctamente')
      }
      if (user.email !== updateData.email) {
        throw new Error('Email no se actualizó correctamente')
      }
      console.log('✅ Cambios verificados en respuesta')

      // Esperar para sincronización de BD
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Verificar en base de datos
      const dbUser = await User.findByPk(user.id)
      if (dbUser.name !== updateData.name) {
        throw new Error('Nombre no se actualizó en BD')
      }
      if (dbUser.email !== updateData.email) {
        throw new Error('Email no se actualizó en BD')
      }
      console.log('✅ Cambios verificados en BD')

      // Actualizar datos del test user
      this.testUser = user

    } catch (error) {
      console.error('❌ Error en actualización:', error.message)
      throw error
    }
  }

  async testRefreshToken() {
    console.log('\n🔄 Test 5: Refresh token')
    
    try {
      const response = await axios.post(`${this.baseURL}/users/refresh`, {
        refreshToken: this.refreshToken
      })
      
      if (response.status !== 200) {
        throw new Error(`Error: ${response.status}`)
      }

      const { tokens } = response.data.data

      console.log('✅ Token refrescado exitosamente')

      // Verificar nuevos tokens
      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Nuevos tokens no generados correctamente')
      }
      console.log('✅ Nuevos tokens generados correctamente')

      // Actualizar tokens
      this.authToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken

      // Probar que el nuevo token funciona
      const profileResponse = await axios.get(`${this.baseURL}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })

      if (profileResponse.status !== 200) {
        throw new Error('Nuevo token no funciona correctamente')
      }
      console.log('✅ Nuevo token verificado')

    } catch (error) {
      console.error('❌ Error en refresh token:', error.message)
      throw error
    }
  }

  async testUserLogout() {
    console.log('\n🚪 Test 6: Logout de usuario')
    
    try {
      const response = await axios.post(`${this.baseURL}/users/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })
      
      if (response.status !== 200) {
        throw new Error(`Error: ${response.status}`)
      }

      console.log('✅ Logout exitoso')

    } catch (error) {
      console.error('❌ Error en logout:', error.message)
      throw error
    }
  }

  async testErrorCases() {
    console.log('\n🚫 Test 7: Casos de error')
    
    try {
      // Test: Email duplicado en registro
      try {
        await axios.post(`${this.baseURL}/users/register`, {
          email: 'test-complete-updated@example.com', // Email ya usado
          password: 'TestPassword123!',
          name: 'Test Duplicate'
        })
        throw new Error('Debería haber devuelto 409')
      } catch (error) {
        if (error.response && error.response.status === 409) {
          console.log('✅ Error 409 manejado correctamente para email duplicado')
        } else {
          throw error
        }
      }

      // Test: Credenciales inválidas en login
      try {
        await axios.post(`${this.baseURL}/users/login`, {
          email: 'test-complete-updated@example.com',
          password: 'PasswordIncorrecta123!'
        })
        throw new Error('Debería haber devuelto 401')
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log('✅ Error 401 manejado correctamente para credenciales inválidas')
        } else {
          throw error
        }
      }

      // Test: Datos inválidos en registro
      try {
        await axios.post(`${this.baseURL}/users/register`, {
          email: 'email-invalido',
          password: '123', // Contraseña muy corta
          name: '' // Nombre vacío
        })
        throw new Error('Debería haber devuelto 400')
      } catch (error) {
        if (error.response && error.response.status === 400) {
          console.log('✅ Error 400 manejado correctamente para datos inválidos')
        } else {
          throw error
        }
      }

      // Test: Acceso sin token
      try {
        await axios.get(`${this.baseURL}/users/profile`)
        throw new Error('Debería haber devuelto 401')
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log('✅ Error 401 manejado correctamente para acceso sin token')
        } else {
          throw error
        }
      }

    } catch (error) {
      console.error('❌ Error en casos de error:', error.message)
      throw error
    }
  }

  async cleanup() {
    console.log('\n🧹 Limpiando datos de test...')
    
    try {
      // Eliminar usuario de prueba
      if (this.testUser) {
        await User.destroy({
          where: { id: this.testUser.id },
          force: true
        })
        console.log('✅ Usuario de prueba eliminado')
      }

      console.log('✅ Limpieza completada')
    } catch (error) {
      console.error('⚠️ Error durante limpieza:', error.message)
    }
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  const test = new UsersAuthCompleteTest()
  test.run().catch(console.error)
}

module.exports = UsersAuthCompleteTest
