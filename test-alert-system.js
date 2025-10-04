/**
 * Script de prueba para el sistema de alertas
 * Simula detección de cambios y creación de alertas automáticas
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')

const API_BASE = 'http://localhost:3002/api'
let authToken = null

// Configuración de prueba
const testConfig = {
  email: 'alert-test@example.com',
  password: 'password123',
  competitorName: 'Alert Test Competitor',
  competitorUrl: `https://alert-test-competitor-${Date.now()}.com`
}

/**
 * Autenticarse y obtener token
 */
async function authenticate() {
  try {
    console.log('🔐 Autenticando...')
    
    // Intentar login primero
    try {
    const loginResponse = await axios.post(`${API_BASE}/users/login`, {
      email: testConfig.email,
      password: testConfig.password
    })
    
    authToken = loginResponse.data.data.tokens.accessToken
      console.log('✅ Login exitoso')
      return
    } catch (loginError) {
      console.log('⚠️  Login falló, intentando registro...')
    }

    // Si el login falla, intentar registro
    const registerResponse = await axios.post(`${API_BASE}/users/register`, {
      email: testConfig.email,
      password: testConfig.password,
      name: 'Test User'
    })
    
    authToken = registerResponse.data.data.tokens.accessToken
    console.log('✅ Registro exitoso')
  } catch (error) {
    console.error('❌ Error de autenticación:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Crear competidor de prueba
 */
async function createTestCompetitor() {
  try {
    console.log('🏢 Creando competidor de prueba...')
    
    const response = await axios.post(`${API_BASE}/competitors`, {
      name: testConfig.competitorName,
      url: testConfig.competitorUrl,
      description: 'Competidor para pruebas del sistema de alertas',
      priority: 'high',
      monitoringEnabled: true
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    console.log('✅ Competidor creado:', response.data.data.id)
    return response.data.data.id
  } catch (error) {
    console.error('❌ Error creando competidor:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Simular captura de cambios con HTML diferente
 */
async function simulateChangeCapture(competitorId, htmlContent, description) {
  try {
    console.log(`📸 Simulando captura: ${description}`)
    
    const response = await axios.post(`${API_BASE}/competitors/${competitorId}/capture`, {
      options: {
        html: htmlContent,
        simulate: true
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    if (response.data.success) {
      console.log('✅ Captura exitosa:', response.data.message)
      if (response.data.data) {
        console.log(`   📊 Cambios detectados: ${response.data.data.changeCount}`)
        console.log(`   🔴 Severidad: ${response.data.data.severity}`)
      }
    } else {
      console.log('ℹ️  Sin cambios detectados')
    }
    
    return response.data
  } catch (error) {
    console.error('❌ Error en captura:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Verificar alertas creadas
 */
async function checkAlerts() {
  try {
    console.log('🔔 Verificando alertas...')
    
    const response = await axios.get(`${API_BASE}/alerts`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    const alerts = response.data.data
    console.log(`📋 Total de alertas: ${alerts.length}`)
    
    if (alerts.length > 0) {
      console.log('\n📝 Alertas encontradas:')
      alerts.forEach((alert, index) => {
        console.log(`   ${index + 1}. ${alert.title}`)
        console.log(`      Tipo: ${alert.type} | Severidad: ${alert.severity}`)
        console.log(`      Estado: ${alert.status} | Cambios: ${alert.changeCount}`)
        console.log(`      Creada: ${new Date(alert.created_at).toLocaleString()}`)
        console.log('')
      })
    }
    
    return alerts
  } catch (error) {
    console.error('❌ Error verificando alertas:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Obtener estadísticas de alertas
 */
async function getAlertStats() {
  try {
    console.log('📊 Obteniendo estadísticas de alertas...')
    
    const response = await axios.get(`${API_BASE}/alerts/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    
    const stats = response.data.data
    console.log('📈 Estadísticas:')
    console.log(`   Total: ${stats.total}`)
    console.log(`   No leídas: ${stats.unread}`)
    console.log(`   Leídas: ${stats.read}`)
    console.log(`   Archivadas: ${stats.archived}`)
    console.log('\n   Por severidad:')
    Object.entries(stats.bySeverity).forEach(([severity, count]) => {
      console.log(`     ${severity}: ${count}`)
    })
    
    return stats
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error.response?.data || error.message)
    throw error
  }
}

/**
 * HTML de prueba - Versión inicial
 */
const htmlV1 = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Competitor - Home</title>
</head>
<body>
    <header>
        <h1>Test Competitor</h1>
        <nav>
            <a href="/">Home</a>
            <a href="/products">Products</a>
            <a href="/pricing">Pricing</a>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>Welcome to Test Competitor</h2>
            <p>We provide amazing services for your business.</p>
            <button>Get Started</button>
        </section>
        <section class="features">
            <h3>Our Features</h3>
            <ul>
                <li>Feature 1</li>
                <li>Feature 2</li>
                <li>Feature 3</li>
            </ul>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 Test Competitor. All rights reserved.</p>
    </footer>
</body>
</html>
`

/**
 * HTML de prueba - Versión con cambios menores
 */
const htmlV2 = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Competitor - Home</title>
</head>
<body>
    <header>
        <h1>Test Competitor</h1>
        <nav>
            <a href="/">Home</a>
            <a href="/products">Products</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact">Contact</a>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>Welcome to Test Competitor</h2>
            <p>We provide amazing services for your business.</p>
            <button>Get Started</button>
        </section>
        <section class="features">
            <h3>Our Features</h3>
            <ul>
                <li>Feature 1</li>
                <li>Feature 2</li>
                <li>Feature 3</li>
                <li>Feature 4</li>
            </ul>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 Test Competitor. All rights reserved.</p>
    </footer>
</body>
</html>
`

/**
 * HTML de prueba - Versión con cambios mayores
 */
const htmlV3 = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Competitor - Home</title>
    <style>
        .pricing-section { background-color: #f0f0f0; padding: 20px; }
        .price-card { border: 1px solid #ccc; padding: 15px; margin: 10px; }
    </style>
</head>
<body>
    <header>
        <h1>Test Competitor</h1>
        <nav>
            <a href="/">Home</a>
            <a href="/products">Products</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact">Contact</a>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>Welcome to Test Competitor</h2>
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
        </section>
    </main>
    <footer>
        <p>&copy; 2024 Test Competitor. All rights reserved.</p>
    </footer>
</body>
</html>
`

/**
 * Función principal de prueba
 */
async function runAlertSystemTest() {
  try {
    console.log('🚀 Iniciando prueba del sistema de alertas\n')
    
    // 1. Autenticarse
    await authenticate()
    console.log('')
    
    // 2. Crear competidor
    const competitorId = await createTestCompetitor()
    console.log('')
    
    // 3. Primera captura (versión inicial)
    await simulateChangeCapture(competitorId, htmlV1, 'Versión inicial')
    console.log('')
    
    // 4. Segunda captura (cambios menores)
    await simulateChangeCapture(competitorId, htmlV2, 'Cambios menores - nueva navegación y feature')
    console.log('')
    
    // 5. Tercera captura (cambios mayores)
    await simulateChangeCapture(competitorId, htmlV3, 'Cambios mayores - nueva sección de pricing')
    console.log('')
    
    // 6. Verificar alertas
    const alerts = await checkAlerts()
    console.log('')
    
    // 7. Obtener estadísticas
    const stats = await getAlertStats()
    console.log('')
    
    console.log('✅ Prueba del sistema de alertas completada exitosamente!')
    console.log(`📊 Resumen: ${alerts.length} alertas generadas`)
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message)
    process.exit(1)
  }
}

// Ejecutar prueba si se llama directamente
if (require.main === module) {
  runAlertSystemTest()
}

module.exports = {
  runAlertSystemTest,
  authenticate,
  createTestCompetitor,
  simulateChangeCapture,
  checkAlerts,
  getAlertStats
}
