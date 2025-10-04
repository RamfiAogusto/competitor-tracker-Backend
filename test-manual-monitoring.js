/**
 * Test de monitoreo manual por competidor
 * Prueba el endpoint manual-check con HTML simulado
 */

const axios = require('axios')

const BASE_URL = 'http://localhost:3002/api'
let authToken = null
let userId = null

// Colores para logs
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

const log = (step, message, color = 'reset') => {
  console.log(`${colors[color]}[${step}]${colors.reset} ${message}`)
}

// Función para hacer requests autenticados
const apiRequest = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    }
  }
  
  if (data) {
    config.data = data
  }
  
  return axios(config)
}

// Test de autenticación
const testAuth = async () => {
  log('1', '🔐 Probando autenticación...', 'blue')
  
  try {
    // Intentar login
    const loginResponse = await apiRequest('POST', '/users/login', {
      email: 'test2@example.com',
      password: 'password123'
    })
    
    if (loginResponse.data.success) {
      authToken = loginResponse.data.data.token
      userId = loginResponse.data.data.user.id
      log('1.1', `✅ Login exitoso - Usuario: ${loginResponse.data.data.user.email}`, 'green')
      return true
    }
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 404) {
      log('1.2', '⚠️ Usuario no existe, creando cuenta...', 'yellow')
      
      try {
        // Crear usuario
        const registerResponse = await apiRequest('POST', '/users/register', {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        })
        
        if (registerResponse.data.success) {
          authToken = registerResponse.data.data.token
          userId = registerResponse.data.data.user.id
          log('1.3', `✅ Usuario creado - ID: ${userId}`, 'green')
          return true
        }
      } catch (registerError) {
        if (registerError.response?.status === 409) {
          log('1.4', '⚠️ Usuario ya existe, intentando login...', 'yellow')
          
          // Usuario ya existe, intentar login
          try {
            const retryLoginResponse = await apiRequest('POST', '/users/login', {
              email: 'test@example.com',
              password: 'password123'
            })
            
            if (retryLoginResponse.data.success) {
              authToken = retryLoginResponse.data.data.token
              userId = retryLoginResponse.data.data.user.id
              log('1.5', `✅ Login exitoso después de registro - Usuario: ${retryLoginResponse.data.data.user.email}`, 'green')
              return true
            }
          } catch (retryError) {
            log('1.6', `❌ Error en retry login: ${retryError.message}`, 'red')
          }
        }
      }
    }
    
    log('1.7', `❌ Error de autenticación: ${error.message}`, 'red')
    return false
  }
}

// Test de creación de competidor
const testCreateCompetitor = async () => {
  log('2', '🏢 Creando competidor de prueba...', 'blue')
  
  try {
    const competitorData = {
      name: 'Test Competitor Manual',
      url: 'https://example-test-manual.com',
      description: 'Competidor para probar monitoreo manual',
      priority: 'high',
      monitoringEnabled: true
    }
    
    const response = await apiRequest('POST', '/competitors', competitorData)
    
    if (response.data.success) {
      const competitor = response.data.data
      log('2.1', `✅ Competidor creado - ID: ${competitor.id}`, 'green')
      log('2.2', `   Nombre: ${competitor.name}`, 'cyan')
      log('2.3', `   URL: ${competitor.url}`, 'cyan')
      return competitor
    }
  } catch (error) {
    if (error.response?.status === 409) {
      log('2.4', '⚠️ Competidor ya existe, buscando...', 'yellow')
      
      // Buscar competidor existente
      const listResponse = await apiRequest('GET', '/competitors')
      const existingCompetitor = listResponse.data.data.find(c => c.url === 'https://example-test-manual.com')
      
      if (existingCompetitor) {
        log('2.5', `✅ Competidor encontrado - ID: ${existingCompetitor.id}`, 'green')
        return existingCompetitor
      }
    }
    
    log('2.6', `❌ Error creando competidor: ${error.message}`, 'red')
    return null
  }
}

// Test de monitoreo manual
const testManualMonitoring = async (competitor) => {
  log('3', '🔍 Probando monitoreo manual...', 'blue')
  
  try {
    // Primera captura (v1)
    log('3.1', 'Ejecutando primera captura (v1)...', 'cyan')
    const firstCheck = await apiRequest('POST', `/competitors/${competitor.id}/manual-check`, {
      simulate: true,
      htmlVersion: 'v1'
    })
    
    if (firstCheck.data.success) {
      log('3.2', `✅ Primera captura exitosa`, 'green')
      log('3.3', `   Cambios detectados: ${firstCheck.data.data.changesDetected}`, 'cyan')
      log('3.4', `   Mensaje: ${firstCheck.data.message}`, 'cyan')
    }
    
    // Segunda captura (v2) - debería detectar cambios
    log('3.5', 'Ejecutando segunda captura (v2)...', 'cyan')
    const secondCheck = await apiRequest('POST', `/competitors/${competitor.id}/manual-check`, {
      simulate: true,
      htmlVersion: 'v2'
    })
    
    if (secondCheck.data.success) {
      log('3.6', `✅ Segunda captura exitosa`, 'green')
      log('3.7', `   Cambios detectados: ${secondCheck.data.data.changesDetected}`, 'cyan')
      log('3.8', `   Cantidad de cambios: ${secondCheck.data.data.changeCount}`, 'cyan')
      log('3.9', `   Severidad: ${secondCheck.data.data.severity}`, 'cyan')
      log('3.10', `   Alerta creada: ${secondCheck.data.data.alertCreated}`, 'cyan')
      log('3.11', `   Mensaje: ${secondCheck.data.message}`, 'cyan')
    }
    
    // Tercera captura (v3) - más cambios
    log('3.12', 'Ejecutando tercera captura (v3)...', 'cyan')
    const thirdCheck = await apiRequest('POST', `/competitors/${competitor.id}/manual-check`, {
      simulate: true,
      htmlVersion: 'v3'
    })
    
    if (thirdCheck.data.success) {
      log('3.13', `✅ Tercera captura exitosa`, 'green')
      log('3.14', `   Cambios detectados: ${thirdCheck.data.data.changesDetected}`, 'cyan')
      log('3.15', `   Cantidad de cambios: ${thirdCheck.data.data.changeCount}`, 'cyan')
      log('3.16', `   Severidad: ${thirdCheck.data.data.severity}`, 'cyan')
      log('3.17', `   Alerta creada: ${thirdCheck.data.data.alertCreated}`, 'cyan')
      log('3.18', `   Mensaje: ${thirdCheck.data.message}`, 'cyan')
    }
    
    return true
  } catch (error) {
    log('3.19', `❌ Error en monitoreo manual: ${error.message}`, 'red')
    if (error.response?.data) {
      log('3.20', `   Detalles: ${JSON.stringify(error.response.data)}`, 'red')
    }
    return false
  }
}

// Test de historial de cambios
const testChangeHistory = async (competitor) => {
  log('4', '📊 Verificando historial de cambios...', 'blue')
  
  try {
    const response = await apiRequest('GET', `/changes?competitorId=${competitor.id}`)
    
    if (response.data.success) {
      const changes = response.data.data
      log('4.1', `✅ Historial obtenido - ${changes.length} versiones`, 'green')
      
      changes.forEach((change, index) => {
        log(`4.${index + 2}`, `   Versión ${change.versionNumber}: ${change.changeCount} cambios (${change.severity})`, 'cyan')
        log(`4.${index + 2}`, `     Fecha: ${change.timestamp}`, 'cyan')
        log(`4.${index + 2}`, `     Resumen: ${change.changeSummary}`, 'cyan')
      })
    }
    
    return true
  } catch (error) {
    log('4.2', `❌ Error obteniendo historial: ${error.message}`, 'red')
    return false
  }
}

// Test de alertas
const testAlerts = async () => {
  log('5', '🚨 Verificando alertas generadas...', 'blue')
  
  try {
    const response = await apiRequest('GET', '/alerts')
    
    if (response.data.success) {
      const alerts = response.data.data
      log('5.1', `✅ Alertas obtenidas - ${alerts.length} alertas`, 'green')
      
      alerts.forEach((alert, index) => {
        log(`5.${index + 2}`, `   Alerta ${index + 1}: ${alert.title}`, 'cyan')
        log(`5.${index + 2}`, `     Severidad: ${alert.severity}`, 'cyan')
        log(`5.${index + 2}`, `     Estado: ${alert.status}`, 'cyan')
        log(`5.${index + 2}`, `     Mensaje: ${alert.message}`, 'cyan')
      })
    }
    
    return true
  } catch (error) {
    log('5.3', `❌ Error obteniendo alertas: ${error.message}`, 'red')
    return false
  }
}

// Test de limpieza
const testCleanup = async (competitor) => {
  log('6', '🧹 Limpiando datos de prueba...', 'blue')
  
  try {
    await apiRequest('DELETE', `/competitors/${competitor.id}`)
    log('6.1', `✅ Competidor eliminado - ID: ${competitor.id}`, 'green')
    return true
  } catch (error) {
    log('6.2', `❌ Error eliminando competidor: ${error.message}`, 'red')
    return false
  }
}

// Función principal
const runTests = async () => {
  console.log(`${colors.bright}${colors.blue}🧪 TEST DE MONITOREO MANUAL${colors.reset}`)
  console.log(`${colors.blue}================================${colors.reset}\n`)
  
  let competitor = null
  
  try {
    // 1. Autenticación
    const authSuccess = await testAuth()
    if (!authSuccess) {
      throw new Error('Falló la autenticación')
    }
    
    // 2. Crear competidor
    competitor = await testCreateCompetitor()
    if (!competitor) {
      throw new Error('No se pudo crear el competidor')
    }
    
    // 3. Monitoreo manual
    const monitoringSuccess = await testManualMonitoring(competitor)
    if (!monitoringSuccess) {
      throw new Error('Falló el monitoreo manual')
    }
    
    // 4. Historial de cambios
    const historySuccess = await testChangeHistory(competitor)
    if (!historySuccess) {
      throw new Error('Falló la verificación del historial')
    }
    
    // 5. Alertas
    const alertsSuccess = await testAlerts()
    if (!alertsSuccess) {
      throw new Error('Falló la verificación de alertas')
    }
    
    // 6. Limpieza
    await testCleanup(competitor)
    
    console.log(`\n${colors.bright}${colors.green}✅ TODOS LOS TESTS PASARON EXITOSAMENTE${colors.reset}`)
    console.log(`${colors.green}=====================================${colors.reset}`)
    
  } catch (error) {
    console.log(`\n${colors.bright}${colors.red}❌ TEST FALLÓ: ${error.message}${colors.reset}`)
    console.log(`${colors.red}==============================${colors.reset}`)
    
    // Intentar limpiar si hay competidor
    if (competitor) {
      await testCleanup(competitor)
    }
    
    process.exit(1)
  }
}

// Ejecutar tests
runTests()
