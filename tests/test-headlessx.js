/**
 * Script para probar la conexión y funcionalidades de HeadlessX
 */

require('dotenv').config()
const headlessXService = require('./src/services/headlessXService')
const logger = require('./src/utils/logger')

class HeadlessXTester {
  constructor() {
    this.testResults = []
  }

  async runAllTests() {
    console.log('🚀 Iniciando pruebas de HeadlessX...')
    console.log(`📡 URL configurada: ${process.env.HEADLESSX_URL}`)
    console.log(`🔑 Token configurado: ${process.env.HEADLESSX_TOKEN ? 'Sí' : 'No'}`)
    console.log('')

    try {
      // Test 1: Health Check
      await this.testHealthCheck()
      
      // Test 2: Status Check
      await this.testStatusCheck()
      
      // Test 3: HTML Extraction (página simple)
      await this.testHTMLExtraction()
      
      // Test 4: Screenshot (si está disponible)
      await this.testScreenshot()
      
      // Test 5: Content Extraction
      await this.testContentExtraction()
      
      // Test 6: Error Handling
      await this.testErrorHandling()
      
      // Mostrar resumen
      this.showSummary()
      
    } catch (error) {
      console.error('❌ Error durante las pruebas:', error.message)
      logger.error('Error en pruebas de HeadlessX:', error)
    }
  }

  async testHealthCheck() {
    console.log('🏥 Test 1: Health Check')
    try {
      const health = await headlessXService.checkHealth()
      this.testResults.push({
        test: 'Health Check',
        status: health.status === 'healthy' ? 'PASS' : 'FAIL',
        details: health
      })
      
      if (health.status === 'healthy') {
        console.log('✅ HeadlessX está funcionando correctamente')
        console.log(`   - Status: ${health.status}`)
        if (health.data) {
          console.log(`   - Datos: ${JSON.stringify(health.data)}`)
        }
      } else {
        console.log('❌ HeadlessX no está disponible')
        console.log(`   - Error: ${health.error}`)
      }
    } catch (error) {
      this.testResults.push({
        test: 'Health Check',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error en health check:', error.message)
    }
    console.log('')
  }

  async testStatusCheck() {
    console.log('📊 Test 2: Status Check')
    try {
      const status = await headlessXService.getStatus()
      this.testResults.push({
        test: 'Status Check',
        status: 'PASS',
        details: status
      })
      
      console.log('✅ Status obtenido correctamente')
      console.log(`   - Active Browsers: ${status.activeBrowsers || 'N/A'}`)
      console.log(`   - Max Browsers: ${status.maxBrowsers || 'N/A'}`)
      console.log(`   - Queue Length: ${status.queueLength || 'N/A'}`)
      console.log(`   - Uptime: ${status.uptime || 'N/A'}`)
      
    } catch (error) {
      this.testResults.push({
        test: 'Status Check',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error en status check:', error.message)
    }
    console.log('')
  }

  async testHTMLExtraction() {
    console.log('📄 Test 3: HTML Extraction')
    try {
      // Usar una página simple y confiable
      const testUrl = 'https://httpbin.org/html'
      console.log(`   - URL de prueba: ${testUrl}`)
      
      const result = await headlessXService.extractHTML(testUrl, {
        waitFor: 2000,
        removeScripts: true
      })
      
      this.testResults.push({
        test: 'HTML Extraction',
        status: 'PASS',
        details: {
          url: testUrl,
          htmlLength: result.html ? result.html.length : 0,
          hasTitle: result.title ? true : false
        }
      })
      
      console.log('✅ HTML extraído correctamente')
      console.log(`   - Tamaño HTML: ${result.html ? result.html.length : 0} caracteres`)
      console.log(`   - Título: ${result.title || 'N/A'}`)
      console.log(`   - Descripción: ${result.description || 'N/A'}`)
      
      // Mostrar una muestra del HTML
      if (result.html) {
        const sample = result.html.substring(0, 200)
        console.log(`   - Muestra HTML: ${sample}...`)
      }
      
    } catch (error) {
      this.testResults.push({
        test: 'HTML Extraction',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error en extracción HTML:', error.message)
    }
    console.log('')
  }

  async testScreenshot() {
    console.log('📸 Test 4: Screenshot')
    try {
      const testUrl = 'https://httpbin.org/html'
      console.log(`   - URL de prueba: ${testUrl}`)
      
      const screenshot = await headlessXService.takeScreenshot(testUrl, {
        waitFor: 2000,
        fullPage: false,
        quality: 80
      })
      
      this.testResults.push({
        test: 'Screenshot',
        status: 'PASS',
        details: {
          url: testUrl,
          format: screenshot.format,
          dimensions: `${screenshot.width}x${screenshot.height}`,
          imageSize: screenshot.image ? screenshot.image.length : 0
        }
      })
      
      console.log('✅ Screenshot tomado correctamente')
      console.log(`   - Formato: ${screenshot.format}`)
      console.log(`   - Dimensiones: ${screenshot.width}x${screenshot.height}`)
      console.log(`   - Tamaño imagen: ${screenshot.image ? screenshot.image.length : 0} caracteres (base64)`)
      console.log(`   - Timestamp: ${screenshot.timestamp}`)
      
    } catch (error) {
      this.testResults.push({
        test: 'Screenshot',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error tomando screenshot:', error.message)
    }
    console.log('')
  }

  async testContentExtraction() {
    console.log('📝 Test 5: Content Extraction')
    try {
      const testUrl = 'https://httpbin.org/html'
      console.log(`   - URL de prueba: ${testUrl}`)
      
      const content = await headlessXService.extractContent(testUrl, {
        waitFor: 2000,
        removeScripts: true,
        includeImages: false
      })
      
      this.testResults.push({
        test: 'Content Extraction',
        status: 'PASS',
        details: {
          url: testUrl,
          contentLength: content.content ? content.content.length : 0,
          hasTitle: content.title ? true : false
        }
      })
      
      console.log('✅ Contenido extraído correctamente')
      console.log(`   - Tamaño contenido: ${content.content ? content.content.length : 0} caracteres`)
      console.log(`   - Título: ${content.title || 'N/A'}`)
      
      // Mostrar una muestra del contenido
      if (content.content) {
        const sample = content.content.substring(0, 200)
        console.log(`   - Muestra contenido: ${sample}...`)
      }
      
    } catch (error) {
      this.testResults.push({
        test: 'Content Extraction',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error extrayendo contenido:', error.message)
    }
    console.log('')
  }

  async testErrorHandling() {
    console.log('🚨 Test 6: Error Handling')
    try {
      // Probar con una URL inválida
      const invalidUrl = 'https://url-que-no-existe-12345.com'
      console.log(`   - URL inválida: ${invalidUrl}`)
      
      try {
        await headlessXService.extractHTML(invalidUrl, { timeout: 5000 })
        // Si llega aquí, no debería
        this.testResults.push({
          test: 'Error Handling',
          status: 'FAIL',
          error: 'No se generó error con URL inválida'
        })
        console.log('❌ No se generó error con URL inválida')
      } catch (error) {
        this.testResults.push({
          test: 'Error Handling',
          status: 'PASS',
          details: {
            expectedError: true,
            errorMessage: error.message
          }
        })
        console.log('✅ Error manejado correctamente')
        console.log(`   - Error: ${error.message}`)
      }
      
    } catch (error) {
      this.testResults.push({
        test: 'Error Handling',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error en test de manejo de errores:', error.message)
    }
    console.log('')
  }

  showSummary() {
    console.log('📋 RESUMEN DE PRUEBAS DE HEADLESSX')
    console.log('=' .repeat(50))
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length
    const failed = this.testResults.filter(r => r.status === 'FAIL').length
    const total = this.testResults.length
    
    console.log(`✅ Pruebas exitosas: ${passed}/${total}`)
    console.log(`❌ Pruebas fallidas: ${failed}/${total}`)
    console.log('')
    
    // Detalles de cada prueba
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌'
      console.log(`${icon} ${result.test}: ${result.status}`)
      
      if (result.status === 'FAIL' && result.error) {
        console.log(`   Error: ${result.error}`)
      }
      
      if (result.details) {
        console.log(`   Detalles: ${JSON.stringify(result.details, null, 2)}`)
      }
    })
    
    console.log('')
    if (passed === total) {
      console.log('🎉 ¡Todas las pruebas de HeadlessX pasaron exitosamente!')
      console.log('✅ HeadlessX está funcionando correctamente y listo para usar')
    } else {
      console.log('⚠️ Algunas pruebas fallaron. Revisa la configuración de HeadlessX.')
      console.log('💡 Asegúrate de que:')
      console.log('   - HeadlessX esté ejecutándose en el puerto correcto')
      console.log('   - El token de autenticación sea válido')
      console.log('   - La URL de HeadlessX sea accesible')
    }
    
    console.log('')
    console.log('🔧 Configuración actual:')
    console.log(`   - URL: ${process.env.HEADLESSX_URL}`)
    console.log(`   - Token: ${process.env.HEADLESSX_TOKEN ? 'Configurado' : 'No configurado'}`)
    console.log(`   - Timeout: ${process.env.HEADLESSX_TIMEOUT}ms`)
  }
}

// Ejecutar las pruebas
async function main() {
  const tester = new HeadlessXTester()
  await tester.runAllTests()
  process.exit(0)
}

main().catch(error => {
  console.error('💥 Error fatal:', error)
  process.exit(1)
})
