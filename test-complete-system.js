/**
 * Prueba completa del sistema de extremo a extremo
 * Simula el flujo completo de un usuario real
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')

const API_BASE = 'http://localhost:3002/api'
const FRONTEND_BASE = 'http://localhost:3000'

let authToken = null
let testUserId = null
let testCompetitorId = null

// Configuración de prueba
const testConfig = {
  email: `e2e-test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'E2E Test User',
  competitorName: 'E2E Test Competitor',
  competitorUrl: `https://e2e-test-competitor-${Date.now()}.com`
}

// Colores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(step, message, status = 'info') {
  const timestamp = new Date().toLocaleTimeString()
  const color = status === 'success' ? colors.green : 
                status === 'error' ? colors.red : 
                status === 'warning' ? colors.yellow : colors.blue
  
  console.log(`${color}[${timestamp}] ${step}: ${message}${colors.reset}`)
}

function logSection(title) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`)
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`)
}

/**
 * 1. AUTENTICACIÓN
 */
async function testAuthentication() {
  logSection('1. PRUEBA DE AUTENTICACIÓN')
  
  try {
    // 1.1 Registro de usuario
    log('1.1', 'Registrando nuevo usuario...')
    const registerResponse = await axios.post(`${API_BASE}/users/register`, {
      email: testConfig.email,
      password: testConfig.password,
      name: testConfig.name
    })
    
    if (registerResponse.data.success) {
      authToken = registerResponse.data.data.tokens.accessToken
      testUserId = registerResponse.data.data.user.id
      log('1.1', `Usuario registrado: ${testConfig.email}`, 'success')
    } else {
      throw new Error('Registro falló')
    }
    
    // 1.2 Verificar perfil
    log('1.2', 'Verificando perfil de usuario...')
    const profileResponse = await axios.get(`${API_BASE}/users/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (profileResponse.data.data.email === testConfig.email) {
      log('1.2', 'Perfil verificado correctamente', 'success')
    } else {
      throw new Error('Perfil no coincide')
    }
    
    // 1.3 Logout
    log('1.3', 'Probando logout...')
    await axios.post(`${API_BASE}/users/logout`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    log('1.3', 'Logout exitoso', 'success')
    
    // 1.4 Login
    log('1.4', 'Probando login...')
    const loginResponse = await axios.post(`${API_BASE}/users/login`, {
      email: testConfig.email,
      password: testConfig.password
    })
    
    if (loginResponse.data.success) {
      authToken = loginResponse.data.data.tokens.accessToken
      log('1.4', 'Login exitoso', 'success')
    } else {
      throw new Error('Login falló')
    }
    
    return true
  } catch (error) {
    log('AUTH', `Error: ${error.response?.data?.message || error.message}`, 'error')
    return false
  }
}

/**
 * 2. GESTIÓN DE COMPETIDORES
 */
async function testCompetitorManagement() {
  logSection('2. PRUEBA DE GESTIÓN DE COMPETIDORES')
  
  try {
    // 2.1 Obtener lista inicial (debe estar vacía)
    log('2.1', 'Obteniendo lista inicial de competidores...')
    const initialResponse = await axios.get(`${API_BASE}/competitors`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (initialResponse.data.data.length === 0) {
      log('2.1', 'Lista inicial vacía (correcto)', 'success')
    } else {
      log('2.1', `Lista inicial tiene ${initialResponse.data.data.length} competidores`, 'warning')
    }
    
    // 2.2 Crear competidor
    log('2.2', 'Creando nuevo competidor...')
    const createResponse = await axios.post(`${API_BASE}/competitors`, {
      name: testConfig.competitorName,
      url: testConfig.competitorUrl,
      description: 'Competidor de prueba para E2E testing',
      priority: 'high',
      monitoringEnabled: true,
      checkInterval: 3600
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (createResponse.data.success) {
      testCompetitorId = createResponse.data.data.id
      log('2.2', `Competidor creado: ${testCompetitorId}`, 'success')
    } else {
      throw new Error('Creación de competidor falló')
    }
    
    // 2.3 Obtener competidor específico
    log('2.3', 'Obteniendo detalles del competidor...')
    const getResponse = await axios.get(`${API_BASE}/competitors/${testCompetitorId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (getResponse.data.data.name === testConfig.competitorName) {
      log('2.3', 'Detalles del competidor obtenidos correctamente', 'success')
    } else {
      throw new Error('Detalles del competidor no coinciden')
    }
    
    // 2.4 Actualizar competidor
    log('2.4', 'Actualizando competidor...')
    const updateResponse = await axios.put(`${API_BASE}/competitors/${testCompetitorId}`, {
      description: 'Descripción actualizada para E2E testing',
      priority: 'medium'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (updateResponse.data.success) {
      log('2.4', 'Competidor actualizado correctamente', 'success')
    } else {
      throw new Error('Actualización de competidor falló')
    }
    
    // 2.5 Obtener estadísticas
    log('2.5', 'Obteniendo estadísticas de competidores...')
    const statsResponse = await axios.get(`${API_BASE}/competitors/overview`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (statsResponse.data.data.total >= 1) {
      log('2.5', `Estadísticas obtenidas: ${statsResponse.data.data.total} competidores`, 'success')
    } else {
      throw new Error('Estadísticas incorrectas')
    }
    
    return true
  } catch (error) {
    log('COMPETITORS', `Error: ${error.response?.data?.message || error.message}`, 'error')
    return false
  }
}

/**
 * 3. DETECCIÓN DE CAMBIOS Y ALERTAS
 */
async function testChangeDetectionAndAlerts() {
  logSection('3. PRUEBA DE DETECCIÓN DE CAMBIOS Y ALERTAS')
  
  try {
    // 3.1 Captura inicial (versión 1)
    log('3.1', 'Realizando captura inicial...')
    const initialHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>${testConfig.competitorName} - Home</title>
</head>
<body>
    <header>
        <h1>${testConfig.competitorName}</h1>
        <nav>
            <a href="/">Home</a>
            <a href="/products">Products</a>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>Welcome to ${testConfig.competitorName}</h2>
            <p>We provide amazing services.</p>
        </section>
        <section class="pricing">
            <h3>Our Pricing</h3>
            <div class="price-card">
                <h4>Basic Plan</h4>
                <p class="price">$29/month</p>
            </div>
        </section>
    </main>
</body>
</html>`

    const initialCapture = await axios.post(`${API_BASE}/competitors/${testCompetitorId}/capture`, {
      options: {
        html: initialHtml,
        simulate: true
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (initialCapture.data.success) {
      log('3.1', 'Captura inicial exitosa (versión 1)', 'success')
    } else {
      throw new Error('Captura inicial falló')
    }
    
    // 3.2 Captura con cambios menores (versión 2)
    log('3.2', 'Realizando captura con cambios menores...')
    const minorChangesHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>${testConfig.competitorName} - Home</title>
</head>
<body>
    <header>
        <h1>${testConfig.competitorName}</h1>
        <nav>
            <a href="/">Home</a>
            <a href="/products">Products</a>
            <a href="/contact">Contact</a>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>Welcome to ${testConfig.competitorName}</h2>
            <p>We provide amazing services for your business.</p>
        </section>
        <section class="pricing">
            <h3>Our Pricing</h3>
            <div class="price-card">
                <h4>Basic Plan</h4>
                <p class="price">$29/month</p>
            </div>
        </section>
    </main>
</body>
</html>`

    const minorCapture = await axios.post(`${API_BASE}/competitors/${testCompetitorId}/capture`, {
      options: {
        html: minorChangesHtml,
        simulate: true
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (minorCapture.data.success) {
      log('3.2', `Cambios menores detectados: ${minorCapture.data.data.changeCount} cambios`, 'success')
    } else {
      throw new Error('Captura con cambios menores falló')
    }
    
    // 3.3 Captura con cambios mayores (versión 3)
    log('3.3', 'Realizando captura con cambios mayores...')
    const majorChangesHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>${testConfig.competitorName} - Home</title>
    <style>
        .pricing-section { background-color: #f0f0f0; padding: 20px; }
        .price-card { border: 1px solid #ccc; padding: 15px; margin: 10px; }
    </style>
</head>
<body>
    <header>
        <h1>${testConfig.competitorName}</h1>
        <nav>
            <a href="/">Home</a>
            <a href="/products">Products</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact">Contact</a>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>Welcome to ${testConfig.competitorName}</h2>
            <p>We provide amazing services for your business.</p>
            <button>Get Started</button>
        </section>
        <section class="pricing-section">
            <h3>Our Pricing</h3>
            <div class="price-card">
                <h4>Basic Plan</h4>
                <p class="price">$29/month</p>
                <ul>
                    <li>Feature 1</li>
                    <li>Feature 2</li>
                </ul>
            </div>
            <div class="price-card">
                <h4>Pro Plan</h4>
                <p class="price">$59/month</p>
                <ul>
                    <li>All Basic features</li>
                    <li>Feature 3</li>
                    <li>Feature 4</li>
                </ul>
            </div>
            <div class="price-card">
                <h4>Enterprise Plus</h4>
                <p class="price">$299/month</p>
                <ul>
                    <li>All Pro features</li>
                    <li>Premium support</li>
                    <li>Custom integrations</li>
                </ul>
            </div>
        </section>
        <section class="features">
            <h3>New Features</h3>
            <p>Introducing our new AI Analytics Dashboard</p>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 ${testConfig.competitorName}. All rights reserved.</p>
    </footer>
</body>
</html>`

    const majorCapture = await axios.post(`${API_BASE}/competitors/${testCompetitorId}/capture`, {
      options: {
        html: majorChangesHtml,
        simulate: true
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (majorCapture.data.success) {
      log('3.3', `Cambios mayores detectados: ${majorCapture.data.data.changeCount} cambios, severidad: ${majorCapture.data.data.severity}`, 'success')
    } else {
      throw new Error('Captura con cambios mayores falló')
    }
    
    // 3.4 Verificar alertas generadas
    log('3.4', 'Verificando alertas generadas...')
    const alertsResponse = await axios.get(`${API_BASE}/alerts`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (alertsResponse.data.data.length >= 2) {
      log('3.4', `${alertsResponse.data.data.length} alertas generadas correctamente`, 'success')
      
      // Mostrar detalles de las alertas
      alertsResponse.data.data.forEach((alert, index) => {
        log(`3.4.${index + 1}`, `${alert.severity.toUpperCase()}: ${alert.title}`, 'success')
        log(`3.4.${index + 1}`, `  Mensaje: ${alert.message}`, 'info')
        log(`3.4.${index + 1}`, `  Cambios: ${alert.changeCount}, Versión: ${alert.versionNumber}`, 'info')
      })
    } else {
      throw new Error('No se generaron las alertas esperadas')
    }
    
    // 3.5 Obtener estadísticas de alertas
    log('3.5', 'Obteniendo estadísticas de alertas...')
    const alertStatsResponse = await axios.get(`${API_BASE}/alerts/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (alertStatsResponse.data.data.total >= 2) {
      log('3.5', `Estadísticas de alertas: ${alertStatsResponse.data.data.total} total, ${alertStatsResponse.data.data.unread} no leídas`, 'success')
    } else {
      throw new Error('Estadísticas de alertas incorrectas')
    }
    
    return true
  } catch (error) {
    log('CHANGES', `Error: ${error.response?.data?.message || error.message}`, 'error')
    return false
  }
}

/**
 * 4. HISTORIAL DE CAMBIOS
 */
async function testChangeHistory() {
  logSection('4. PRUEBA DE HISTORIAL DE CAMBIOS')
  
  try {
    // 4.1 Obtener historial de cambios
    log('4.1', 'Obteniendo historial de cambios...')
    const historyResponse = await axios.get(`${API_BASE}/changes`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (historyResponse.data.data.length >= 2) {
      log('4.1', `${historyResponse.data.data.length} cambios encontrados en el historial`, 'success')
      
      // Mostrar detalles del historial
      historyResponse.data.data.forEach((change, index) => {
        log(`4.1.${index + 1}`, `Versión ${change.versionNumber}: ${change.changeCount} cambios (${change.severity})`, 'success')
        log(`4.1.${index + 1}`, `  Competidor: ${change.competitorName || 'Desconocido'}`, 'info')
        log(`4.1.${index + 1}`, `  Fecha: ${change.timestamp || 'No disponible'}`, 'info')
      })
    } else {
      throw new Error('Historial de cambios vacío o incompleto')
    }
    
    // 4.2 Obtener estadísticas de cambios
    log('4.2', 'Obteniendo estadísticas de cambios...')
    const changeStatsResponse = await axios.get(`${API_BASE}/changes/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (changeStatsResponse.data.data.totalChanges >= 2) {
      log('4.2', `Estadísticas de cambios: ${changeStatsResponse.data.data.totalChanges} cambios totales`, 'success')
      log('4.2', `  Por severidad: ${JSON.stringify(changeStatsResponse.data.data.bySeverity || {})}`, 'info')
    } else {
      throw new Error('Estadísticas de cambios incorrectas')
    }
    
    // 4.3 Obtener detalles de un cambio específico
    if (historyResponse.data.data.length > 0) {
      log('4.3', 'Obteniendo detalles de un cambio específico...')
      const changeId = historyResponse.data.data[0].id
      const changeDetailsResponse = await axios.get(`${API_BASE}/changes/${changeId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      
      if (changeDetailsResponse.data.success) {
        log('4.3', 'Detalles del cambio obtenidos correctamente', 'success')
      } else {
        throw new Error('No se pudieron obtener los detalles del cambio')
      }
    }
    
    return true
  } catch (error) {
    log('HISTORY', `Error: ${error.response?.data?.message || error.message}`, 'error')
    return false
  }
}

/**
 * 5. GESTIÓN DE ALERTAS
 */
async function testAlertManagement() {
  logSection('5. PRUEBA DE GESTIÓN DE ALERTAS')
  
  try {
    // 5.1 Obtener alertas no leídas
    log('5.1', 'Obteniendo alertas no leídas...')
    const unreadAlertsResponse = await axios.get(`${API_BASE}/alerts?status=unread`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (unreadAlertsResponse.data.data.length >= 2) {
      log('5.1', `${unreadAlertsResponse.data.data.length} alertas no leídas encontradas`, 'success')
    } else {
      throw new Error('No hay alertas no leídas')
    }
    
    // 5.2 Marcar una alerta como leída
    log('5.2', 'Marcando una alerta como leída...')
    const firstAlert = unreadAlertsResponse.data.data[0]
    const markReadResponse = await axios.put(`${API_BASE}/alerts/${firstAlert.id}`, {
      status: 'read'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (markReadResponse.data.success) {
      log('5.2', 'Alerta marcada como leída correctamente', 'success')
    } else {
      throw new Error('Error al marcar alerta como leída')
    }
    
    // 5.3 Archivar una alerta
    log('5.3', 'Archivando una alerta...')
    const secondAlert = unreadAlertsResponse.data.data[1]
    const archiveResponse = await axios.put(`${API_BASE}/alerts/${secondAlert.id}`, {
      status: 'archived'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (archiveResponse.data.success) {
      log('5.3', 'Alerta archivada correctamente', 'success')
    } else {
      throw new Error('Error al archivar alerta')
    }
    
    // 5.4 Verificar estadísticas actualizadas
    log('5.4', 'Verificando estadísticas actualizadas...')
    const updatedStatsResponse = await axios.get(`${API_BASE}/alerts/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (updatedStatsResponse.data.data.read >= 1 && updatedStatsResponse.data.data.archived >= 1) {
      log('5.4', `Estadísticas actualizadas: ${updatedStatsResponse.data.data.read} leídas, ${updatedStatsResponse.data.data.archived} archivadas`, 'success')
    } else {
      throw new Error('Estadísticas no se actualizaron correctamente')
    }
    
    return true
  } catch (error) {
    log('ALERTS', `Error: ${error.response?.data?.message || error.message}`, 'error')
    return false
  }
}

/**
 * 6. LIMPIEZA
 */
async function testCleanup() {
  logSection('6. LIMPIEZA DE DATOS DE PRUEBA')
  
  try {
    // 6.1 Eliminar competidor (soft delete)
    log('6.1', 'Eliminando competidor de prueba...')
    const deleteResponse = await axios.delete(`${API_BASE}/competitors/${testCompetitorId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (deleteResponse.data.success) {
      log('6.1', 'Competidor eliminado correctamente', 'success')
    } else {
      throw new Error('Error al eliminar competidor')
    }
    
    // 6.2 Verificar que el competidor ya no aparece en la lista
    log('6.2', 'Verificando que el competidor fue eliminado...')
    const finalListResponse = await axios.get(`${API_BASE}/competitors`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    const deletedCompetitor = finalListResponse.data.data.find(c => c.id === testCompetitorId)
    if (!deletedCompetitor) {
      log('6.2', 'Competidor eliminado correctamente de la lista', 'success')
    } else {
      log('6.2', 'Competidor aún aparece en la lista (soft delete)', 'warning')
    }
    
    return true
  } catch (error) {
    log('CLEANUP', `Error: ${error.response?.data?.message || error.message}`, 'error')
    return false
  }
}

/**
 * FUNCIÓN PRINCIPAL
 */
async function runCompleteTest() {
  console.log(`${colors.bright}${colors.magenta}`)
  console.log('🚀 INICIANDO PRUEBA COMPLETA DEL SISTEMA')
  console.log('📋 Simulando flujo completo de usuario real')
  console.log(`📧 Usuario de prueba: ${testConfig.email}`)
  console.log(`🌐 Competidor de prueba: ${testConfig.competitorName}`)
  console.log(`${colors.reset}\n`)
  
  const results = {
    authentication: false,
    competitorManagement: false,
    changeDetection: false,
    changeHistory: false,
    alertManagement: false,
    cleanup: false
  }
  
  try {
    // Ejecutar todas las pruebas
    results.authentication = await testAuthentication()
    if (!results.authentication) {
      throw new Error('Prueba de autenticación falló')
    }
    
    results.competitorManagement = await testCompetitorManagement()
    if (!results.competitorManagement) {
      throw new Error('Prueba de gestión de competidores falló')
    }
    
    results.changeDetection = await testChangeDetectionAndAlerts()
    if (!results.changeDetection) {
      throw new Error('Prueba de detección de cambios falló')
    }
    
    results.changeHistory = await testChangeHistory()
    if (!results.changeHistory) {
      throw new Error('Prueba de historial de cambios falló')
    }
    
    results.alertManagement = await testAlertManagement()
    if (!results.alertManagement) {
      throw new Error('Prueba de gestión de alertas falló')
    }
    
    results.cleanup = await testCleanup()
    if (!results.cleanup) {
      log('CLEANUP', 'Limpieza falló, pero no es crítico', 'warning')
    }
    
    // Mostrar resumen final
    logSection('RESUMEN FINAL')
    
    const passedTests = Object.values(results).filter(Boolean).length
    const totalTests = Object.keys(results).length
    
    console.log(`${colors.bright}Resultados de las pruebas:${colors.reset}`)
    Object.entries(results).forEach(([test, passed]) => {
      const status = passed ? '✅ PASSED' : '❌ FAILED'
      const color = passed ? colors.green : colors.red
      console.log(`  ${color}${status}${colors.reset} - ${test}`)
    })
    
    console.log(`\n${colors.bright}Total: ${passedTests}/${totalTests} pruebas pasaron${colors.reset}`)
    
    if (passedTests === totalTests) {
      console.log(`\n${colors.bright}${colors.green}🎉 ¡TODAS LAS PRUEBAS PASARON!${colors.reset}`)
      console.log(`${colors.green}✅ El sistema está funcionando correctamente de extremo a extremo${colors.reset}`)
    } else if (passedTests >= totalTests - 1) {
      console.log(`\n${colors.bright}${colors.yellow}⚠️  CASI TODAS LAS PRUEBAS PASARON${colors.reset}`)
      console.log(`${colors.yellow}✅ El sistema funciona correctamente con pequeñas advertencias${colors.reset}`)
    } else {
      console.log(`\n${colors.bright}${colors.red}❌ ALGUNAS PRUEBAS FALLARON${colors.reset}`)
      console.log(`${colors.red}🔧 Revisar los errores mostrados arriba${colors.reset}`)
    }
    
    return passedTests === totalTests
    
  } catch (error) {
    log('SYSTEM', `Error crítico: ${error.message}`, 'error')
    return false
  }
}

// Ejecutar la prueba completa
runCompleteTest()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error(`${colors.red}Error fatal: ${error.message}${colors.reset}`)
    process.exit(1)
  })
