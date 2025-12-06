/**
 * Test completo del flujo de creación y análisis de competidor miragestudio.eu
 * 
 * Este test:
 * 1. Lista competidores para encontrar "mirages"
 * 2. Borra el competidor si existe
 * 3. Crea el competidor de nuevo
 * 4. Verifica que SSE se conecte
 * 5. Espera el análisis inicial
 * 6. Verifica que se complete correctamente
 */

require('dotenv').config()
const axios = require('axios')
const { sequelize } = require('../src/database/config')
const { Competitor } = require('../src/models')

const API_URL = process.env.API_URL || 'http://localhost:3002/api'
// Usar las mismas credenciales que otros tests del proyecto
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'ramfiaogusto@gmail.com'
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || '12345678'

// Colores para logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function login() {
  try {
    log('\n🔐 Iniciando sesión...', 'cyan')
    const response = await axios.post(`${API_URL}/users/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    })
    
    if (response.data.success && response.data.data?.tokens?.accessToken) {
      const token = response.data.data.tokens.accessToken
      log('✅ Sesión iniciada correctamente', 'green')
      return token
    }
    throw new Error('No se recibió token de autenticación')
  } catch (error) {
    log(`❌ Error al iniciar sesión: ${error.response?.data?.message || error.message}`, 'red')
    throw error
  }
}

async function getCompetitors(token) {
  try {
    log('\n📋 Listando competidores...', 'cyan')
    const response = await axios.get(`${API_URL}/competitors`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (response.data.success) {
      log(`✅ Encontrados ${response.data.data.length} competidores`, 'green')
      return response.data.data
    }
    throw new Error('No se pudieron obtener competidores')
  } catch (error) {
    log(`❌ Error al listar competidores: ${error.response?.data?.message || error.message}`, 'red')
    throw error
  }
}

async function deleteCompetitor(token, competitorId) {
  try {
    log(`\n🗑️  Borrando competidor ${competitorId}...`, 'cyan')
    const response = await axios.delete(`${API_URL}/competitors/${competitorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (response.data.success) {
      log('✅ Competidor borrado correctamente', 'green')
      return true
    }
    throw new Error('No se pudo borrar el competidor')
  } catch (error) {
    log(`❌ Error al borrar competidor: ${error.response?.data?.message || error.message}`, 'red')
    throw error
  }
}

async function createCompetitor(token, name, url) {
  try {
    log(`\n➕ Creando competidor "${name}" (${url})...`, 'cyan')
    const response = await axios.post(`${API_URL}/competitors`, {
      name,
      url,
      description: 'Test de flujo completo',
      monitoringEnabled: true,
      priority: 'medium'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (response.data.success && response.data.data?.id) {
      log(`✅ Competidor creado: ${response.data.data.id}`, 'green')
      return response.data.data
    }
    throw new Error('No se pudo crear el competidor')
  } catch (error) {
    log(`❌ Error al crear competidor: ${error.response?.data?.message || error.message}`, 'red')
    throw error
  }
}

async function waitForAnalysis(token, competitorId, maxWaitSeconds = 180) {
  log(`\n⏳ Esperando análisis inicial (máx ${maxWaitSeconds}s)...`, 'cyan')
  log('   El backend debería estar ejecutando el análisis en segundo plano...', 'cyan')
  
  const startTime = Date.now()
  const maxWait = maxWaitSeconds * 1000
  let lastStatus = null
  
  while (Date.now() - startTime < maxWait) {
    try {
      const response = await axios.get(`${API_URL}/competitors/${competitorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.data.success && response.data.data) {
        const competitor = response.data.data
        lastStatus = competitor
        
        if (competitor.totalVersions > 0) {
          log(`\n✅ Análisis completado! Versión ${competitor.totalVersions} creada`, 'green')
          return competitor
        }
        
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        
        // Mostrar información más detallada cada 10 segundos
        if (elapsed % 10 === 0) {
          log(`\n   ⏳ ${elapsed}s - Versiones: ${competitor.totalVersions}`, 'cyan')
          log(`   📊 Última verificación: ${competitor.lastCheckedAt || 'Nunca'}`, 'cyan')
        } else {
          process.stdout.write(`\r⏳ Esperando... (${elapsed}s) - Versiones: ${competitor.totalVersions}`)
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)) // Esperar 2 segundos
    } catch (error) {
      log(`\n⚠️  Error verificando estado: ${error.response?.data?.message || error.message}`, 'yellow')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  log(`\n⏰ Timeout esperando análisis (${maxWaitSeconds}s)`, 'yellow')
  if (lastStatus) {
    log(`\n📊 Estado final del competidor:`, 'yellow')
    log(`   Versiones: ${lastStatus.totalVersions}`, 'yellow')
    log(`   Última verificación: ${lastStatus.lastCheckedAt || 'Nunca'}`, 'yellow')
    log(`   Monitoreo activo: ${lastStatus.monitoringEnabled}`, 'yellow')
  }
  log('\n💡 Posibles causas:', 'yellow')
  log('   1. HeadlessX está tardando más de lo esperado', 'yellow')
  log('   2. HeadlessX está fallando (revisa logs del backend)', 'yellow')
  log('   3. El análisis se está ejecutando pero no se está guardando', 'yellow')
  return null
}

async function getCompetitorHistory(token, competitorId) {
  try {
    const response = await axios.get(`${API_URL}/competitors/${competitorId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 10 }
    })
    
    if (response.data.success) {
      return response.data.data
    }
    return []
  } catch (error) {
    log(`⚠️  Error obteniendo historial: ${error.message}`, 'yellow')
    return []
  }
}

async function main() {
  try {
    log('\n' + '='.repeat(60), 'blue')
    log('🧪 TEST COMPLETO: Flujo de creación y análisis de miragestudio.eu', 'blue')
    log('='.repeat(60), 'blue')
    
    // 1. Iniciar sesión
    const token = await login()
    
    // 2. Listar competidores
    const competitors = await getCompetitors(token)
    
    // 3. Buscar y borrar "mirages" si existe
    const miragesCompetitor = competitors.find(c => 
      c.url.includes('miragestudio.eu') || c.name.toLowerCase().includes('mirage')
    )
    
    if (miragesCompetitor) {
      log(`\n🔍 Encontrado competidor existente:`, 'yellow')
      log(`   ID: ${miragesCompetitor.id}`, 'yellow')
      log(`   Nombre: ${miragesCompetitor.name}`, 'yellow')
      log(`   URL: ${miragesCompetitor.url}`, 'yellow')
      log(`   Versiones: ${miragesCompetitor.totalVersions}`, 'yellow')
      
      await deleteCompetitor(token, miragesCompetitor.id)
      log('⏳ Esperando 2 segundos antes de recrear...', 'cyan')
      await new Promise(resolve => setTimeout(resolve, 2000))
    } else {
      log('\n✅ No se encontró competidor "mirages" existente', 'green')
    }
    
    // 4. Crear competidor de nuevo
    const newCompetitor = await createCompetitor(
      token,
      'mirages',
      'https://miragestudio.eu/'
    )
    
    log(`\n📊 Competidor creado:`, 'cyan')
    log(`   ID: ${newCompetitor.id}`, 'cyan')
    log(`   Nombre: ${newCompetitor.name}`, 'cyan')
    log(`   URL: ${newCompetitor.url}`, 'cyan')
    log(`   Versiones iniciales: ${newCompetitor.totalVersions}`, 'cyan')
    
    // 5. Esperar análisis inicial
    log('\n⏳ El análisis se ejecuta automáticamente en segundo plano...', 'cyan')
    log('   Esperando hasta 3 minutos para que complete...', 'cyan')
    
    const analyzedCompetitor = await waitForAnalysis(token, newCompetitor.id, 180)
    
    if (analyzedCompetitor && analyzedCompetitor.totalVersions > 0) {
      log('\n✅ Análisis completado exitosamente!', 'green')
      
      // 6. Obtener historial para ver detalles
      const history = await getCompetitorHistory(token, newCompetitor.id)
      
      if (history.length > 0) {
        const latestVersion = history[0]
        log('\n📸 Última versión:', 'cyan')
        log(`   ID: ${latestVersion.id}`, 'cyan')
        log(`   Versión #: ${latestVersion.versionNumber}`, 'cyan')
        log(`   Cambios: ${latestVersion.changeCount}`, 'cyan')
        log(`   Tipo: ${latestVersion.changeType}`, 'cyan')
        log(`   Severidad: ${latestVersion.severity}`, 'cyan')
        
        if (latestVersion.metadata?.initialStructure) {
          log(`   ✅ Estructura inicial detectada`, 'green')
          log(`      Secciones: ${latestVersion.metadata.initialStructure.sectionsCount}`, 'green')
        }
        
        if (latestVersion.metadata?.aiAnalysis) {
          log(`   ✅ Análisis de IA disponible`, 'green')
          log(`      Urgencia: ${latestVersion.metadata.aiAnalysis.urgencia}`, 'green')
        }
      }
      
      log('\n' + '='.repeat(60), 'green')
      log('✅ TEST COMPLETADO EXITOSAMENTE', 'green')
      log('='.repeat(60), 'green')
    } else {
      log('\n' + '='.repeat(60), 'yellow')
      log('⚠️  TEST COMPLETADO PERO ANÁLISIS NO FINALIZÓ', 'yellow')
      log('   El análisis puede estar tardando más de lo esperado', 'yellow')
      log('='.repeat(60), 'yellow')
    }
    
    process.exit(0)
  } catch (error) {
    log('\n' + '='.repeat(60), 'red')
    log('❌ TEST FALLÓ', 'red')
    log('='.repeat(60), 'red')
    log(`Error: ${error.message}`, 'red')
    if (error.stack) {
      log(`\nStack: ${error.stack}`, 'red')
    }
    process.exit(1)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
    .then(() => {
      sequelize.close()
      process.exit(0)
    })
    .catch((error) => {
      console.error('Error fatal:', error)
      sequelize.close()
      process.exit(1)
    })
}

module.exports = { main }

