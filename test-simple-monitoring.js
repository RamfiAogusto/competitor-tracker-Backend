/**
 * Script de prueba simple para monitoreo
 * Prueba solo los endpoints básicos sin HeadlessX
 */

const axios = require('axios')

const API_BASE = 'http://localhost:3002/api'
let authToken = null
let testCompetitorId = null

// Configuración de prueba
const uniqueId = Date.now()
const testConfig = {
  email: `simple-monitoring-test-${uniqueId}@example.com`,
  password: 'password123',
  competitorName: 'Simple Monitoring Test',
  competitorUrl: 'https://example.com'
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

async function testSimpleMonitoring() {
  console.log(`\n🚀 INICIANDO PRUEBA SIMPLE DE MONITOREO`)
  console.log(`📧 Usuario de prueba: ${testConfig.email}`)

  try {
    // 1. Autenticación
    console.log('\n1. Autenticación...')
    const registerRes = await callApi('POST', '/users/register', {
      email: testConfig.email,
      password: testConfig.password,
      name: 'Simple Monitoring Test User'
    }, false)
    
    if (!registerRes.success) throw new Error('Registro falló')
    authToken = registerRes.data.tokens.accessToken
    console.log(`✅ Usuario registrado: ${registerRes.data.user.email}`)

    // 2. Crear competidor
    console.log('\n2. Creando competidor...')
    const competitorRes = await callApi('POST', '/competitors', {
      name: testConfig.competitorName,
      url: testConfig.competitorUrl,
      description: 'Competidor de prueba simple',
      priority: 'high',
      monitoringEnabled: false
    })
    
    if (!competitorRes.success) throw new Error('Creación de competidor falló')
    testCompetitorId = competitorRes.data.id
    console.log(`✅ Competidor creado: ${testCompetitorId}`)

    // 3. Verificar estado inicial
    console.log('\n3. Verificando estado inicial...')
    const statusRes = await callApi('GET', `/competitors/${testCompetitorId}/monitoring-status`)
    
    if (!statusRes.success) throw new Error('Estado inicial falló')
    console.log(`✅ Estado inicial: ${statusRes.data.status}`)
    console.log(`   Monitoreo habilitado: ${statusRes.data.monitoringEnabled}`)

    // 4. Iniciar monitoreo con HTML simulado
    console.log('\n4. Iniciando monitoreo con HTML simulado...')
    const monitoringRes = await callApi('POST', `/competitors/${testCompetitorId}/start-monitoring`, {
      interval: 300,
      options: {
        html: '<html><head><title>Test</title></head><body><h1>Test Page</h1></body></html>',
        simulate: true
      }
    })
    
    if (!monitoringRes.success) throw new Error('Inicio de monitoreo falló')
    console.log(`✅ Monitoreo iniciado`)
    console.log(`   Intervalo: ${monitoringRes.data.checkInterval} segundos`)
    console.log(`   Estado: ${monitoringRes.data.monitoringEnabled ? 'activo' : 'inactivo'}`)

    // 5. Verificar estado después
    console.log('\n5. Verificando estado después...')
    const statusAfterRes = await callApi('GET', `/competitors/${testCompetitorId}/monitoring-status`)
    
    if (!statusAfterRes.success) throw new Error('Estado después falló')
    console.log(`✅ Estado después: ${statusAfterRes.data.status}`)
    console.log(`   Próxima captura: ${statusAfterRes.data.nextCapture}`)

    // 6. Captura manual con HTML simulado
    console.log('\n6. Realizando captura manual...')
    const captureRes = await callApi('POST', `/competitors/${testCompetitorId}/capture`, {
      options: {
        html: '<html><head><title>Test Updated</title></head><body><h1>Test Page Updated</h1><p>New content</p></body></html>',
        simulate: true
      }
    })
    
    if (!captureRes.success) throw new Error('Captura manual falló')
    console.log(`✅ Captura manual exitosa`)
    if (captureRes.data) {
      console.log(`   Versión: ${captureRes.data.versionNumber}`)
      console.log(`   Cambios: ${captureRes.data.changeCount}`)
      console.log(`   Severidad: ${captureRes.data.severity}`)
    }

    // 7. Verificar alertas
    console.log('\n7. Verificando alertas...')
    const alertsRes = await callApi('GET', '/alerts?status=unread')
    
    if (!alertsRes.success) throw new Error('Verificación de alertas falló')
    console.log(`✅ Alertas no leídas: ${alertsRes.data.length}`)
    
    alertsRes.data.forEach((alert, index) => {
      console.log(`   Alerta ${index + 1}: ${alert.title}`)
      console.log(`     Severidad: ${alert.severity}`)
      console.log(`     Cambios: ${alert.changeCount}`)
    })

    // 8. Verificar historial
    console.log('\n8. Verificando historial...')
    const historyRes = await callApi('GET', `/changes?competitorId=${testCompetitorId}`)
    
    if (!historyRes.success) throw new Error('Verificación de historial falló')
    console.log(`✅ Cambios en historial: ${historyRes.data.length}`)
    
    historyRes.data.forEach((change, index) => {
      console.log(`   Cambio ${index + 1}: Versión ${change.versionNumber} - ${change.changeCount} cambios (${change.severity})`)
    })

    // 9. Limpieza
    console.log('\n9. Limpiando...')
    const deleteRes = await callApi('DELETE', `/competitors/${testCompetitorId}`)
    
    if (!deleteRes.success) throw new Error('Limpieza falló')
    console.log(`✅ Competidor eliminado`)

    console.log(`\n🎉 ¡PRUEBA SIMPLE COMPLETADA EXITOSAMENTE!`)
    console.log(`✅ Todos los endpoints están funcionando`)
    console.log(`✅ El flujo de monitoreo está encadenado correctamente`)
    console.log(`✅ El sistema está listo para integración con HeadlessX`)

  } catch (error) {
    console.error(`\n❌ Error en la prueba:`, error.message)
    process.exit(1)
  }
}

// Ejecutar prueba
testSimpleMonitoring()
