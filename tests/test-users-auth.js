/**
 * Test completo para autenticación de usuarios
 * Verifica registro, login, refresh token, perfil y logout
 */

const axios = require('axios')
const { User } = require('../src/models')
const { testConnection, syncModels } = require('../src/database/config')

class UsersAuthTest {
  constructor() {
    this.baseURL = 'http://localhost:3002/api'
    this.testUser = null
    this.authToken = null
    this.refreshToken = null
  }

  async run() {
    console.log('🔐 Iniciando test completo de autenticación de usuarios')
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

      console.log('\n✅ Todos los tests de autenticación pasaron exitosamente!')
    } catch (error) {
      console.error('\n❌ Error en test de autenticación:', error.message)
      await this.cleanup()
      process.exit(1)
    }
  }

  async setup() {
    console.log('🔧 Configurando entorno de test de autenticación...')
    
    // Verificar conexión a base de datos
    await testConnection()
    await syncModels()

    console.log(`🌐 Servidor corriendo en: ${this.baseURL}`)
  }

  async testUserRegistration() {
    console.log('\n📝 Test 1: Registro de usuario')
    
    const userData = {
      email: 'test-auth@example.com',
      password: 'TestPassword123!',
      name: 'Test User Auth'
    }

    try {
      const response = await axios.post(`${this.baseURL}/users/register`, userData)
      
      if (response.status !== 201) {
        throw new Error(`Error al registrar usuario: ${response.status}`)
      }

      const { user, tokens } = response.data.data
      this.testUser = user
      this.authToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken

      console.log(`✅ Usuario registrado: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Nombre: ${user.name}`)
      console.log(`   Rol: ${user.role}`)

      // Verificar que no se exponga la contraseña
      if (user.password) {
        throw new Error('La contraseña no debería estar en la respuesta')
      }
      console.log('✅ Contraseña no expuesta en respuesta')

      // Verificar tokens
      if (!this.authToken || !this.refreshToken) {
        throw new Error('Tokens no generados correctamente')
      }
      console.log('✅ Tokens generados correctamente')

      // Verificar en base de datos
      const dbUser = await User.findByPk(user.id)
      if (!dbUser) {
        throw new Error('Usuario no encontrado en base de datos')
      }
      if (dbUser.email !== userData.email) {
        throw new Error('Email no coincide en base de datos')
      }
      if (dbUser.name !== userData.name) {
        throw new Error('Nombre no coincide en base de datos')
      }
      console.log('✅ Usuario verificado en base de datos')

    } catch (error) {
      console.error('❌ Error en test de registro:', error.message)
      throw error
    }
  }

  async testUserLogin() {
    console.log('\n🔑 Test 2: Login de usuario')
    
    const loginData = {
      email: 'test-auth@example.com',
      password: 'TestPassword123!'
    }

    try {
      const response = await axios.post(`${this.baseURL}/users/login`, loginData)
      
      if (response.status !== 200) {
        throw new Error(`Error al hacer login: ${response.status}`)
      }

      const { user, tokens } = response.data.data

      console.log(`✅ Login exitoso: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Nombre: ${user.name}`)

      // Verificar que no se exponga la contraseña
      if (user.password) {
        throw new Error('La contraseña no debería estar en la respuesta')
      }
      console.log('✅ Contraseña no expuesta en respuesta')

      // Verificar tokens
      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Tokens no generados correctamente')
      }
      console.log('✅ Tokens generados correctamente')

      // Actualizar tokens para siguientes tests
      this.authToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken

    } catch (error) {
      console.error('❌ Error en test de login:', error.message)
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
        throw new Error(`Error al obtener perfil: ${response.status}`)
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

      // Verificar datos
      if (user.id !== this.testUser.id) {
        throw new Error('ID del usuario no coincide')
      }
      if (user.email !== this.testUser.email) {
        throw new Error('Email del usuario no coincide')
      }
      console.log('✅ Datos del perfil verificados')

    } catch (error) {
      console.error('❌ Error en test de perfil:', error.message)
      throw error
    }
  }

  async testUserUpdate() {
    console.log('\n✏️ Test 4: Actualizar perfil de usuario')
    
    const updateData = {
      name: 'Test User Auth - Actualizado',
      email: 'test-auth-updated@example.com'
    }

    try {
      const response = await axios.put(`${this.baseURL}/users/profile`, updateData, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })
      
      if (response.status !== 200) {
        throw new Error(`Error al actualizar perfil: ${response.status}`)
      }

      const user = response.data.data

      console.log(`✅ Perfil actualizado: ${user.email}`)
      console.log(`   Nombre: ${user.name}`)

      // Verificar cambios
      if (user.name !== updateData.name) {
        throw new Error('Nombre no se actualizó correctamente')
      }
      if (user.email !== updateData.email) {
        throw new Error('Email no se actualizó correctamente')
      }
      console.log('✅ Cambios verificados en respuesta')

      // Verificar en base de datos
      const dbUser = await User.findByPk(user.id)
      if (dbUser.name !== updateData.name) {
        throw new Error('Nombre no se actualizó en base de datos')
      }
      if (dbUser.email !== updateData.email) {
        throw new Error('Email no se actualizó en base de datos')
      }
      console.log('✅ Cambios verificados en base de datos')

      // Actualizar datos del test user
      this.testUser = user

    } catch (error) {
      console.error('❌ Error en test de actualización:', error.message)
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
        throw new Error(`Error al refrescar token: ${response.status}`)
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
      console.error('❌ Error en test de refresh token:', error.message)
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
        throw new Error(`Error al hacer logout: ${response.status}`)
      }

      console.log('✅ Logout exitoso')

      // En una implementación completa, aquí verificaríamos que el token esté invalidado
      // Por ahora, simplemente confirmamos que el endpoint responde correctamente

    } catch (error) {
      console.error('❌ Error en test de logout:', error.message)
      throw error
    }
  }

  async testErrorCases() {
    console.log('\n🚫 Test 7: Casos de error')
    
    try {
      // Test: Email duplicado en registro
      try {
        await axios.post(`${this.baseURL}/users/register`, {
          email: 'test-auth-updated@example.com', // Email ya usado
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
          email: 'test-auth-updated@example.com',
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
      console.error('❌ Error en test de casos de error:', error.message)
      throw error
    }
  }

  async cleanup() {
    console.log('\n🧹 Limpiando datos de test de autenticación...')
    
    try {
      // Eliminar usuario de prueba
      if (this.testUser) {
        await User.destroy({
          where: { id: this.testUser.id },
          force: true
        })
        console.log('✅ Usuario de prueba eliminado')
      }

      console.log('✅ Limpieza de autenticación completada')
    } catch (error) {
      console.error('⚠️ Error durante limpieza de autenticación:', error.message)
    }
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  const test = new UsersAuthTest()
  test.run().catch(console.error)
}

module.exports = UsersAuthTest
