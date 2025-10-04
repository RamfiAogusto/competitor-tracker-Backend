/**
 * Script para actualizar el competidor de prueba con una URL que funcione
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

async function getCompetitors() {
  try {
    console.log('📋 Obteniendo competidores...')
    const response = await axios.get(`${API_BASE}/competitors`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (response.data.success) {
      console.log(`✅ Encontrados ${response.data.data.length} competidores`)
      return response.data.data
    } else {
      console.error('❌ Error obteniendo competidores:', response.data.message)
      return []
    }
  } catch (error) {
    console.error('❌ Error obteniendo competidores:', error.response?.data?.message || error.message)
    return []
  }
}

async function updateCompetitor(competitorId, newUrl) {
  try {
    console.log(`🔄 Actualizando competidor ${competitorId} con URL: ${newUrl}`)
    const response = await axios.put(`${API_BASE}/competitors/${competitorId}`, {
      url: newUrl
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (response.data.success) {
      console.log('✅ Competidor actualizado exitosamente')
      return response.data.data
    } else {
      console.error('❌ Error actualizando competidor:', response.data.message)
      return null
    }
  } catch (error) {
    console.error('❌ Error actualizando competidor:', error.response?.data?.message || error.message)
    return null
  }
}

async function main() {
  console.log('🚀 Iniciando actualización de competidor de prueba...\n')
  
  // 1. Login
  const loginSuccess = await login()
  if (!loginSuccess) {
    console.log('❌ No se pudo continuar sin autenticación')
    return
  }
  
  // 2. Obtener competidores
  const competitors = await getCompetitors()
  if (competitors.length === 0) {
    console.log('❌ No se encontraron competidores')
    return
  }
  
  // 3. Buscar competidor "Google Test"
  const googleTest = competitors.find(c => c.name === 'Google Test')
  if (!googleTest) {
    console.log('❌ No se encontró competidor "Google Test"')
    return
  }
  
  console.log(`📝 Competidor encontrado: ${googleTest.name} (${googleTest.url})`)
  
  // 4. Actualizar URL a una que funcione
  const newUrl = 'https://example.com'
  const updated = await updateCompetitor(googleTest.id, newUrl)
  
  if (updated) {
    console.log('\n✅ Competidor actualizado exitosamente')
    console.log(`📝 Nuevo URL: ${updated.url}`)
    console.log('\n🎯 Ahora puedes probar el monitoreo manual desde el frontend')
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main }
