/**
 * Test de integración con el competidor "ramfi portfolio"
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

async function testManualMonitoring() {
  try {
    console.log('🔍 Probando monitoreo manual para "ramfi portfolio"...')
    
    const response = await axios.post(`${API_BASE}/competitors/b5693dec-b986-4f98-a52d-012aef7b3217/manual-check`, {
      simulate: false // Usar HeadlessX real
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (response.data.success) {
      console.log('✅ Monitoreo manual exitoso')
      console.log('📋 Resultado:', {
        changesDetected: response.data.data.changesDetected,
        alertCreated: response.data.data.alertCreated,
        changeCount: response.data.data.changeCount,
        severity: response.data.data.severity,
        message: response.data.message
      })
      return response.data.data
    } else {
      console.error('❌ Error en monitoreo manual:', response.data.message)
      return null
    }
  } catch (error) {
    console.error('❌ Error en monitoreo manual:', error.response?.data?.message || error.message)
    return null
  }
}

async function checkAlerts() {
  try {
    console.log('🔔 Verificando alertas generadas...')
    const response = await axios.get(`${API_BASE}/alerts?limit=3`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (response.data.success) {
      console.log(`✅ Encontradas ${response.data.data.length} alertas`)
      if (response.data.data.length > 0) {
        const latestAlert = response.data.data[0]
        console.log('📋 Última alerta:', {
          title: latestAlert.title,
          severity: latestAlert.severity,
          changeCount: latestAlert.changeCount,
          createdAt: latestAlert.created_at
        })
      }
    } else {
      console.log('ℹ️ No hay alertas disponibles')
    }
  } catch (error) {
    console.error('❌ Error verificando alertas:', error.response?.data?.message || error.message)
  }
}

async function main() {
  console.log('🚀 Iniciando prueba con competidor "ramfi portfolio"...\n')
  
  // 1. Login
  const loginSuccess = await login()
  if (!loginSuccess) {
    console.log('❌ No se pudo continuar sin autenticación')
    return
  }
  
  // 2. Probar monitoreo manual
  const result = await testManualMonitoring()
  if (!result) {
    console.log('❌ Monitoreo manual falló')
    return
  }
  
  // 3. Verificar alertas
  await checkAlerts()
  
  console.log('\n✅ Prueba completada')
  console.log('\n📋 Resumen:')
  console.log(`- Competidor: ramfi portfolio (https://ramfiaogusto.dev)`)
  console.log(`- Cambios detectados: ${result.changesDetected}`)
  console.log(`- Cantidad de cambios: ${result.changeCount || 'N/A'}`)
  console.log(`- Severidad: ${result.severity || 'N/A'}`)
  console.log(`- Alerta creada: ${result.alertCreated}`)
  console.log(`- Mensaje: ${result.message || 'N/A'}`)
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main }
