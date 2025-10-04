/**
 * Script para actualizar competidor a ramfiaogusto.dev
 */

const axios = require('axios')

const API_BASE = 'http://localhost:3002/api'
const TEST_USER = {
  email: 'ramfiaogusto@gmail.com',
  password: '12345678'
}

let authToken = null

async function login() {
  try {
    console.log('🔐 Iniciando sesión...')
    const response = await axios.post(`${API_BASE}/users/login`, TEST_USER)
    
    if (response.data.success) {
      authToken = response.data.data.tokens.accessToken
      console.log('✅ Login exitoso')
      return true
    } else {
      console.error('❌ Error en login:', response.data.message)
      return false
    }
  } catch (error) {
    console.error('❌ Error en login:', error.response?.data?.message || error.message)
    return false
  }
}

async function updateCompetitor() {
  try {
    // Obtener competidores
    console.log('📋 Obteniendo competidores...')
    const response = await axios.get(`${API_BASE}/competitors`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    const googleTest = response.data.data.find(c => c.name === 'Google Test')
    if (!googleTest) {
      console.log('❌ No se encontró Google Test')
      return
    }
    
    console.log(`📝 Competidor encontrado: ${googleTest.name} (${googleTest.url})`)
    
    // Actualizar URL
    console.log('🔄 Actualizando URL a ramfiaogusto.dev...')
    const updateResponse = await axios.put(`${API_BASE}/competitors/${googleTest.id}`, {
      url: 'https://ramfiaogusto.dev'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    console.log('✅ Competidor actualizado exitosamente')
    console.log(`📝 Nueva URL: ${updateResponse.data.data.url}`)
    
  } catch (error) {
    console.error('❌ Error actualizando competidor:', error.response?.data?.message || error.message)
  }
}

async function main() {
  console.log('🚀 Actualizando competidor a ramfiaogusto.dev...\n')
  
  // 1. Login
  const loginSuccess = await login()
  if (!loginSuccess) {
    console.log('❌ No se pudo continuar sin autenticación')
    return
  }
  
  // 2. Actualizar competidor
  await updateCompetitor()
  
  console.log('\n🎯 Ahora puedes probar el monitoreo manual desde el frontend')
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main }
