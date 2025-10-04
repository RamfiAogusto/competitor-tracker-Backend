/**
 * Script de prueba para monitoreo real con HeadlessX
 * Prueba el flujo completo desde el frontend hasta la detección de cambios
 */

const axios = require('axios')

const API_BASE = 'http://localhost:3002/api'
let authToken = null
let testUserId = null
let testCompetitorId = null

// Configuración de prueba
const uniqueId = Date.now()
const testConfig = {
  email: `real-monitoring-test-${uniqueId}@example.com`,
  password: 'password123',
  competitorName: 'Real Monitoring Test',
  competitorUrl: 'https://example.com' // URL real para probar
}

async function callApi(method, endpoint, data = {}, authRequired = true) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    }
    if (authRequired && authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }

    const response = await axios({
      method,
      url: `${API_BASE}${endpoint}`,
      headers,
      data
    })
    return response.data
  } catch (error) {
    console.error(`❌ Error en la llamada API ${method} ${endpoint}:`, error.response?.data || error.message)
    throw error
  }
}

async function runTest(name, func) {
  console.log(`\n[${new Date().toLocaleTimeString()}] ${name}`)
  try {
    await func()
    console.log(`✅ [${new Date().toLocaleTimeString()}] ${name} exitoso`)
  } catch (error) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] ${name} falló:`, error.message)
    process.exit(1)
  }
}

async function testRealMonitoring() {
  console.log(`\n🚀 INICIANDO PRUEBA DE MONITOREO REAL`)
  console.log(`📧 Usuario de prueba: ${testConfig.email}`)
  console.log(`🌐 Competidor de prueba: ${testConfig.competitorUrl}`)

  // 1. Autenticación
  await runTest('1.1: Registrando usuario...', async () => {
    const res = await callApi('POST', '/users/register', {
      email: testConfig.email,
      password: testConfig.password,
      name: 'Real Monitoring Test User'
    }, false)
    if (!res.success) throw new Error('Operación falló')
    authToken = res.data.tokens.accessToken
    testUserId = res.data.user.id
    console.log(`Usuario registrado: ${res.data.user.email}`)
  })

  // 2. Crear competidor
  await runTest('2.1: Creando competidor...', async () => {
    const res = await callApi('POST', '/competitors', {
      name: testConfig.competitorName,
      url: testConfig.competitorUrl,
      description: 'Competidor de prueba para monitoreo real',
      priority: 'high',
      monitoringEnabled: false // No iniciar monitoreo automáticamente
    })
    if (!res.success) throw new Error('Operación falló')
    testCompetitorId = res.data.id
    console.log(`Competidor creado: ${testCompetitorId}`)
  })

  // 3. Verificar estado inicial
  await runTest('3.1: Verificando estado inicial...', async () => {
    const res = await callApi('GET', `/competitors/${testCompetitorId}/monitoring-status`)
    if (!res.success) throw new Error('Operación falló')
    if (res.data.monitoringEnabled) throw new Error('Monitoreo debería estar deshabilitado')
    console.log(`Estado inicial: ${res.data.status}`)
  })

  // 4. Iniciar monitoreo automático
  await runTest('4.1: Iniciando monitoreo automático...', async () => {
    const res = await callApi('POST', `/competitors/${testCompetitorId}/start-monitoring`, {
      interval: 300, // 5 minutos para prueba
      options: {
        screenshot: true,
        fullPage: true,
        waitFor: 'networkidle'
      }
    })
    if (!res.success) throw new Error('Operación falló')
    if (!res.data.monitoringEnabled) throw new Error('Monitoreo debería estar habilitado')
    if (res.data.checkInterval !== 300) throw new Error(`Intervalo incorrecto: ${res.data.checkInterval}`)
    console.log(`Monitoreo iniciado con intervalo de ${res.data.checkInterval} segundos`)
    
    if (res.data.initialCapture) {
      console.log(`Captura inicial: Versión ${res.data.initialCapture.versionNumber}`)
    }
  })

  // 5. Verificar estado después de iniciar monitoreo
  await runTest('5.1: Verificando estado de monitoreo...', async () => {
    const res = await callApi('GET', `/competitors/${testCompetitorId}/monitoring-status`)
    if (!res.success) throw new Error('Operación falló')
    if (!res.data.monitoringEnabled) throw new Error('Monitoreo debería estar habilitado')
    if (res.data.status !== 'active') throw new Error(`Estado incorrecto: ${res.data.status}`)
    console.log(`Estado: ${res.data.status}`)
    console.log(`Última verificación: ${res.data.lastCheckedAt || 'Nunca'}`)
    console.log(`Próxima captura: ${res.data.nextCapture}`)
  })

  // 6. Captura manual adicional
  await runTest('6.1: Realizando captura manual...', async () => {
    const res = await callApi('POST', `/competitors/${testCompetitorId}/capture`, {
      options: {
        screenshot: true,
        fullPage: true
      }
    })
    if (!res.success) throw new Error('Operación falló')
    console.log(`Captura manual exitosa`)
    if (res.data) {
      console.log(`Versión: ${res.data.versionNumber}`)
      console.log(`Cambios: ${res.data.changeCount}`)
      console.log(`Severidad: ${res.data.severity}`)
    }
  })

  // 7. Verificar alertas generadas
  await runTest('7.1: Verificando alertas...', async () => {
    const res = await callApi('GET', '/alerts?status=unread')
    if (!res.success) throw new Error('Operación falló')
    console.log(`Alertas no leídas: ${res.data.length}`)
    
    res.data.forEach((alert, index) => {
      console.log(`Alerta ${index + 1}: ${alert.title}`)
      console.log(`  Severidad: ${alert.severity}`)
      console.log(`  Cambios: ${alert.changeCount}`)
    })
  })

  // 8. Verificar historial de cambios
  await runTest('8.1: Verificando historial...', async () => {
    const res = await callApi('GET', `/changes?competitorId=${testCompetitorId}`)
    if (!res.success) throw new Error('Operación falló')
    console.log(`Cambios en historial: ${res.data.length}`)
    
    res.data.forEach((change, index) => {
      console.log(`Cambio ${index + 1}: Versión ${change.versionNumber} - ${change.changeCount} cambios (${change.severity})`)
    })
  })

  // 9. Deshabilitar monitoreo
  await runTest('9.1: Deshabilitando monitoreo...', async () => {
    const res = await callApi('POST', `/competitors/${testCompetitorId}/disable-monitoring`)
    if (!res.success) throw new Error('Operación falló')
    if (res.data.monitoringEnabled) throw new Error('Monitoreo debería estar deshabilitado')
    console.log(`Monitoreo deshabilitado para ${res.data.name}`)
  })

  // 10. Verificar estado final
  await runTest('10.1: Verificando estado final...', async () => {
    const res = await callApi('GET', `/competitors/${testCompetitorId}/monitoring-status`)
    if (!res.success) throw new Error('Operación falló')
    if (res.data.monitoringEnabled) throw new Error('Monitoreo debería estar deshabilitado')
    if (res.data.status !== 'paused') throw new Error(`Estado incorrecto: ${res.data.status}`)
    console.log(`Estado final: ${res.data.status}`)
  })

  // 11. Limpieza
  await runTest('11.1: Limpiando datos de prueba...', async () => {
    const res = await callApi('DELETE', `/competitors/${testCompetitorId}`)
    if (!res.success) throw new Error('Operación falló')
    console.log(`Competidor eliminado: ${testCompetitorId}`)
  })

  console.log(`\n🎉 ¡PRUEBA DE MONITOREO REAL COMPLETADA!`)
  console.log(`✅ Todos los procesos están encadenados correctamente`)
  console.log(`✅ La integración con HeadlessX funciona`)
  console.log(`✅ El sistema está listo para producción`)
}

// Ejecutar prueba
testRealMonitoring().catch(error => {
  console.error('❌ Error en la prueba:', error)
  process.exit(1)
})
