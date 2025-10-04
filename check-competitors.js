/**
 * Script para verificar competidores existentes
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

async function checkCompetitors() {
  try {
    console.log('📋 Obteniendo competidores...')
    const response = await axios.get(`${API_BASE}/competitors`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    console.log(`✅ Encontrados ${response.data.data.length} competidores:`)
    response.data.data.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} - ${c.url} (ID: ${c.id})`)
    })
    
    // Buscar el competidor con ramfiaogusto.dev
    const ramfiaogusto = response.data.data.find(c => c.url.includes('ramfiaogusto.dev'))
    if (ramfiaogusto) {
      console.log(`\n🎯 Competidor con ramfiaogusto.dev encontrado: ${ramfiaogusto.name} (${ramfiaogusto.id})`)
      return ramfiaogusto
    } else {
      console.log('\n❌ No se encontró competidor con ramfiaogusto.dev')
      return null
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo competidores:', error.response?.data?.message || error.message)
    return null
  }
}

async function main() {
  console.log('🚀 Verificando competidores existentes...\n')
  
  // 1. Login
  const loginSuccess = await login()
  if (!loginSuccess) {
    console.log('❌ No se pudo continuar sin autenticación')
    return
  }
  
  // 2. Verificar competidores
  const ramfiaogusto = await checkCompetitors()
  
  if (ramfiaogusto) {
    console.log('\n🎯 Usar este competidor para pruebas:')
    console.log(`- Nombre: ${ramfiaogusto.name}`)
    console.log(`- URL: ${ramfiaogusto.url}`)
    console.log(`- ID: ${ramfiaogusto.id}`)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main }
