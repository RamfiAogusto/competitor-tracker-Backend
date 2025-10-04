/**
 * Script de prueba para verificar la integración con HeadlessX
 * Prueba el monitoreo real de competidores
 */

const axios = require('axios')

const API_BASE = 'http://localhost:3002/api'

// Credenciales de prueba
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123'
}

let authToken = null

async function login() {
  try {
    console.log('🔐 Iniciando sesión...')
    const response = await axios.post(`${API_BASE}/auth/login`, TEST_USER)
    
    if (response.data.success) {
      authToken = response.data.data.token
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
    
    if (response.data.success && response.data.data.length > 0) {
      console.log(`✅ Encontrados ${response.data.data.length} competidores`)
      return response.data.data[0] // Usar el primero para la prueba
    } else {
      console.log('ℹ️ No hay competidores disponibles')
      return null
    }
  } catch (error) {
    console.error('❌ Error obteniendo competidores:', error.response?.data?.message || error.message)
    return null
  }
}

async function testRealMonitoring(competitorId) {
  try {
    console.log(`🔍 Probando monitoreo real para competidor ${competitorId}...`)
    
    const response = await axios.post(
      `${API_BASE}/competitors/${competitorId}/manual-check`,
      { simulate: false }, // Usar HeadlessX real
      { headers: { Authorization: `Bearer ${authToken}` } }
    )
    
    if (response.data.success) {
      console.log('✅ Monitoreo real ejecutado exitosamente')
      console.log('📊 Resultado:', {
        changesDetected: response.data.data.changesDetected,
        changeCount: response.data.data.changeCount,
        severity: response.data.data.severity,
        alertCreated: response.data.data.alertCreated,
        message: response.data.message
      })
      return response.data.data
    } else {
      console.error('❌ Error en monitoreo:', response.data.message)
      return null
    }
  } catch (error) {
    console.error('❌ Error en monitoreo real:', error.response?.data?.message || error.message)
    return null
  }
}

async function checkAlerts() {
  try {
    console.log('🔔 Verificando alertas generadas...')
    const response = await axios.get(`${API_BASE}/alerts?limit=5`, {
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
  console.log('🚀 Iniciando prueba de integración con HeadlessX...\n')
  
  // 1. Login
  const loginSuccess = await login()
  if (!loginSuccess) {
    console.log('❌ No se pudo continuar sin autenticación')
    return
  }
  
  // 2. Obtener competidor
  const competitor = await getCompetitors()
  if (!competitor) {
    console.log('❌ No se pudo continuar sin competidores')
    return
  }
  
  console.log(`📝 Usando competidor: ${competitor.name} (${competitor.url})`)
  
  // 3. Probar monitoreo real
  const result = await testRealMonitoring(competitor.id)
  if (!result) {
    console.log('❌ Monitoreo real falló')
    return
  }
  
  // 4. Verificar alertas
  await checkAlerts()
  
  console.log('\n✅ Prueba de integración completada')
  console.log('\n📋 Resumen:')
  console.log(`- Competidor: ${competitor.name}`)
  console.log(`- Cambios detectados: ${result.changesDetected}`)
  console.log(`- Cantidad de cambios: ${result.changeCount}`)
  console.log(`- Severidad: ${result.severity}`)
  console.log(`- Alerta creada: ${result.alertCreated}`)
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main }
