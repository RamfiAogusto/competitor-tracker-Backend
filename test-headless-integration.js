/**
 * Script de prueba para verificar la integración con HeadlessX
 * Prueba el monitoreo real de competidores
 */

const axios = require('axios')

const API_BASE = 'http://localhost:3002/api'

// Credenciales de prueba
const TEST_USER = {
  email: 'ramfiaogusto@gmail.com',
  password: '12345678'
}

let authToken = null

async function createTestUser() {
  // Usuario ya existe, no necesitamos crearlo
  console.log('ℹ️ Usando usuario existente:', TEST_USER.email)
  return true
}

async function login() {
  try {
    console.log('🔐 Iniciando sesión...')
    const response = await axios.post(`${API_BASE}/users/login`, TEST_USER)
    
    console.log('📋 Respuesta completa:', JSON.stringify(response.data, null, 2))
    
    if (response.data.success) {
      authToken = response.data.data.tokens.accessToken
      console.log('✅ Login exitoso')
      console.log('🔑 Token obtenido:', authToken ? 'Sí' : 'No')
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

async function createTestCompetitor() {
  // Primero intentar obtener competidores existentes
  console.log('🏢 Obteniendo competidores existentes...')
  const existingCompetitor = await getExistingCompetitor()
  if (existingCompetitor) {
    // Usar el competidor existente para la prueba
    console.log('ℹ️ Usando competidor existente para la prueba...')
    return existingCompetitor
  }
  
    // Si no hay competidores, crear uno nuevo
  try {
    console.log('🏢 Creando competidor de prueba...')
    const response = await axios.post(`${API_BASE}/competitors`, {
      name: 'Example Test',
      url: 'https://example.com',
      priority: 'high',
      monitoringEnabled: true
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (response.data.success) {
      console.log('✅ Competidor de prueba creado:', response.data.data.name)
      return response.data.data
    } else {
      console.error('❌ Error creando competidor:', response.data.message)
      return null
    }
  } catch (error) {
    console.error('❌ Error creando competidor:', error.response?.data?.message || error.message)
    return null
  }
}

async function createSimpleCompetitor() {
  try {
    console.log('🏢 Creando competidor simple para prueba...')
    const response = await axios.post(`${API_BASE}/competitors`, {
      name: 'Example Test',
      url: 'https://example.com',
      priority: 'high',
      monitoringEnabled: true
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (response.data.success) {
      console.log('✅ Competidor simple creado:', response.data.data.name)
      return response.data.data
    } else {
      console.error('❌ Error creando competidor simple:', response.data.message)
      return null
    }
  } catch (error) {
    console.error('❌ Error creando competidor simple:', error.response?.data?.message || error.message)
    return null
  }
}

async function getExistingCompetitor() {
  try {
    console.log('🔑 Usando token:', authToken ? 'Presente' : 'Ausente')
    const response = await axios.get(`${API_BASE}/competitors`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (response.data.success && response.data.data.length > 0) {
      console.log('✅ Competidor existente encontrado:', response.data.data[0].name)
      return response.data.data[0]
    }
    console.log('ℹ️ No hay competidores disponibles')
    return null
  } catch (error) {
    console.error('❌ Error obteniendo competidor existente:', error.response?.status, error.response?.data?.message || error.message)
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
  
  // 1. Crear usuario de prueba
  await createTestUser()
  
  // 2. Login
  const loginSuccess = await login()
  if (!loginSuccess) {
    console.log('❌ No se pudo continuar sin autenticación')
    return
  }
  
  // 3. Crear o obtener competidor
  const competitor = await createTestCompetitor()
  if (!competitor) {
    console.log('❌ No se pudo continuar sin competidores')
    return
  }
  
  console.log(`📝 Usando competidor: ${competitor.name} (${competitor.url})`)
  
  // Esperar un poco para que HeadlessX esté listo
  console.log('⏳ Esperando 10 segundos para que HeadlessX esté listo...')
  await new Promise(resolve => setTimeout(resolve, 10000))
  
  // 4. Probar monitoreo real
  const result = await testRealMonitoring(competitor.id)
  if (!result) {
    console.log('❌ Monitoreo real falló')
    return
  }
  
  // 5. Verificar alertas
  await checkAlerts()
  
  console.log('\n✅ Prueba de integración completada')
  console.log('\n📋 Resumen:')
  console.log(`- Competidor: ${competitor.name}`)
  console.log(`- URL: ${competitor.url}`)
  console.log(`- Cambios detectados: ${result.changesDetected}`)
  console.log(`- Cantidad de cambios: ${result.changeCount}`)
  console.log(`- Severidad: ${result.severity}`)
  console.log(`- Alerta creada: ${result.alertCreated}`)
  console.log(`- Mensaje: ${result.message || 'N/A'}`)
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main }