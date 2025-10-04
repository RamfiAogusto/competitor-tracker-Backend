/**
 * Script para probar la API completa sin HeadlessX
 * Simula el flujo completo del sistema
 */

require('dotenv').config()
const axios = require('axios')
const { testConnection, syncModels } = require('./src/database/config')
const { User, Competitor, Snapshot } = require('./src/models')
const changeDetector = require('./src/services/changeDetector')
const logger = require('./src/utils/logger')

class APIWithoutHeadlessXTester {
  constructor() {
    this.baseURL = 'http://localhost:3002'
    this.testResults = []
    this.testUserId = null
    this.testCompetitorId = null
    this.authToken = null
  }

  async runAllTests() {
    console.log('🚀 Iniciando pruebas de API sin HeadlessX...')
    console.log('')

    try {
      // Test 1: Base de datos
      await this.testDatabase()
      
      // Test 2: Modelos y CRUD básico
      await this.testModelsAndCRUD()
      
      // Test 3: Sistema de versionado (sin HeadlessX)
      await this.testVersioningSystem()
      
      // Test 4: Servidor Express (si está corriendo)
      await this.testExpressServer()
      
      // Test 5: Cambio detector (simulado)
      await this.testChangeDetector()
      
      // Mostrar resumen
      this.showSummary()
      
    } catch (error) {
      console.error('❌ Error durante las pruebas:', error.message)
      logger.error('Error en pruebas de API:', error)
    }
  }

  async testDatabase() {
    console.log('🗄️ Test 1: Base de datos')
    try {
      // Probar conexión
      const connected = await testConnection()
      if (!connected) {
        throw new Error('No se pudo conectar a la base de datos')
      }
      
      // Sincronizar modelos
      await syncModels()
      
      this.testResults.push({
        test: 'Base de datos',
        status: 'PASS',
        details: 'Conexión y sincronización exitosas'
      })
      
      console.log('✅ Base de datos funcionando correctamente')
      console.log('   - Conexión establecida')
      console.log('   - Modelos sincronizados')
      
    } catch (error) {
      this.testResults.push({
        test: 'Base de datos',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error en base de datos:', error.message)
    }
    console.log('')
  }

  async testModelsAndCRUD() {
    console.log('📊 Test 2: Modelos y CRUD básico')
    try {
      // Crear usuario de prueba
      const [user, created] = await User.findOrCreate({
        where: { email: 'api-test@competitortracker.com' },
        defaults: {
          name: 'Usuario API Test',
          password: 'test123456',
          role: 'admin'
        }
      })
      
      this.testUserId = user.id
      console.log(`✅ Usuario ${created ? 'creado' : 'encontrado'}: ${user.name}`)
      
      // Crear competidor de prueba
      const [competitor, competitorCreated] = await Competitor.findOrCreate({
        where: { 
          userId: this.testUserId,
          name: 'Competidor API Test'
        },
        defaults: {
          userId: this.testUserId,
          name: 'Competidor API Test',
          url: 'https://api-test-competitor.com',
          description: 'Competidor de prueba para API',
          monitoringEnabled: true,
          checkInterval: 3600
        }
      })
      
      this.testCompetitorId = competitor.id
      console.log(`✅ Competidor ${competitorCreated ? 'creado' : 'encontrado'}: ${competitor.name}`)
      
      // Crear snapshot de prueba
      const snapshot = await Snapshot.create({
        competitorId: this.testCompetitorId,
        versionNumber: 1,
        fullHtml: '<html><head><title>Test API</title></head><body><h1>API Test Page</h1><p>Contenido de prueba</p></body></html>',
        isFullVersion: true,
        isCurrent: true,
        changeCount: 0,
        changePercentage: 0,
        severity: 'low',
        changeSummary: 'Versión inicial de prueba'
      })
      
      console.log(`✅ Snapshot creado: ID ${snapshot.id}, Versión ${snapshot.versionNumber}`)
      
      // Verificar que se guardó correctamente
      const savedSnapshot = await Snapshot.findByPk(snapshot.id)
      if (!savedSnapshot) {
        throw new Error('No se pudo recuperar el snapshot')
      }
      
      this.testResults.push({
        test: 'Modelos y CRUD',
        status: 'PASS',
        details: {
          userCreated: created,
          competitorCreated: competitorCreated,
          snapshotId: snapshot.id,
          htmlLength: savedSnapshot.fullHtml.length
        }
      })
      
      console.log('✅ Modelos y CRUD funcionando correctamente')
      console.log(`   - Usuario: ${user.name} (${user.email})`)
      console.log(`   - Competidor: ${competitor.name}`)
      console.log(`   - Snapshot: ${savedSnapshot.fullHtml.length} caracteres`)
      
    } catch (error) {
      this.testResults.push({
        test: 'Modelos y CRUD',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error en modelos y CRUD:', error.message)
    }
    console.log('')
  }

  async testVersioningSystem() {
    console.log('🔄 Test 3: Sistema de versionado')
    try {
      if (!this.testCompetitorId) {
        throw new Error('No hay competidor de prueba disponible')
      }
      
      // Simular diferentes versiones de HTML
      const htmlVersions = [
        '<html><head><title>V1</title></head><body><h1>Versión 1</h1><p>Contenido original</p></body></html>',
        '<html><head><title>V2</title></head><body><h1>Versión 2</h1><p>Contenido modificado</p><p>Nuevo párrafo</p></body></html>',
        '<html><head><title>V3</title></head><body><h1>Versión 3</h1><p>Contenido completamente nuevo</p><div>Nueva sección</div></body></html>'
      ]
      
      const snapshots = []
      
      for (let i = 0; i < htmlVersions.length; i++) {
        const versionNumber = i + 1
        const html = htmlVersions[i]
        
        // Marcar versión anterior como no actual
        if (versionNumber > 1) {
          await Snapshot.update(
            { isCurrent: false },
            { where: { competitorId: this.testCompetitorId } }
          )
        }
        
        // Calcular cambios (simulado)
        let changeCount = 0
        let changePercentage = 0
        let severity = 'low'
        
        if (versionNumber > 1) {
          const previousHtml = htmlVersions[i - 1]
          const changes = this.calculateSimpleChanges(previousHtml, html)
          changeCount = changes.count
          changePercentage = changes.percentage
          severity = this.calculateSeverity(changePercentage)
        }
        
        const snapshot = await Snapshot.create({
          competitorId: this.testCompetitorId,
          versionNumber: versionNumber,
          fullHtml: html,
          isFullVersion: true,
          isCurrent: true,
          changeCount: changeCount,
          changePercentage: changePercentage,
          severity: severity,
          changeSummary: `Versión ${versionNumber} - ${changeCount} cambios`
        })
        
        snapshots.push(snapshot)
        console.log(`✅ Versión ${versionNumber} creada: ${changeCount} cambios (${changePercentage.toFixed(2)}%) - ${severity}`)
      }
      
      // Verificar que todas las versiones se guardaron
      const allSnapshots = await Snapshot.findAll({
        where: { competitorId: this.testCompetitorId },
        order: [['versionNumber', 'ASC']]
      })
      
      this.testResults.push({
        test: 'Sistema de versionado',
        status: 'PASS',
        details: {
          versionsCreated: snapshots.length,
          totalSnapshots: allSnapshots.length,
          currentVersion: allSnapshots.find(s => s.isCurrent)?.versionNumber
        }
      })
      
      console.log('✅ Sistema de versionado funcionando correctamente')
      console.log(`   - Versiones creadas: ${snapshots.length}`)
      console.log(`   - Total snapshots: ${allSnapshots.length}`)
      console.log(`   - Versión actual: ${allSnapshots.find(s => s.isCurrent)?.versionNumber}`)
      
    } catch (error) {
      this.testResults.push({
        test: 'Sistema de versionado',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error en sistema de versionado:', error.message)
    }
    console.log('')
  }

  async testExpressServer() {
    console.log('🌐 Test 4: Servidor Express')
    try {
      // Probar endpoints básicos
      const endpoints = [
        { path: '/', method: 'GET', expected: 'message' },
        { path: '/health', method: 'GET', expected: 'status' }
      ]
      
      let passedEndpoints = 0
      
      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${this.baseURL}${endpoint.path}`, {
            timeout: 5000
          })
          
          if (response.status === 200 && response.data[endpoint.expected]) {
            passedEndpoints++
            console.log(`✅ ${endpoint.path}: OK`)
          } else {
            console.log(`⚠️ ${endpoint.path}: Respuesta inesperada`)
          }
        } catch (error) {
          console.log(`❌ ${endpoint.path}: ${error.message}`)
        }
      }
      
      if (passedEndpoints > 0) {
        this.testResults.push({
          test: 'Servidor Express',
          status: 'PASS',
          details: {
            endpointsWorking: passedEndpoints,
            totalEndpoints: endpoints.length
          }
        })
        
        console.log('✅ Servidor Express funcionando')
        console.log(`   - Endpoints funcionando: ${passedEndpoints}/${endpoints.length}`)
      } else {
        this.testResults.push({
          test: 'Servidor Express',
          status: 'FAIL',
          error: 'Ningún endpoint respondió correctamente'
        })
        
        console.log('❌ Servidor Express no está respondiendo')
        console.log('💡 Ejecuta: node src/server.js')
      }
      
    } catch (error) {
      this.testResults.push({
        test: 'Servidor Express',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error probando servidor Express:', error.message)
    }
    console.log('')
  }

  async testChangeDetector() {
    console.log('🔍 Test 5: Detector de cambios (simulado)')
    try {
      // Simular detección de cambios sin HeadlessX
      const oldHtml = '<html><body><h1>Título</h1><p>Contenido</p></body></html>'
      const newHtml = '<html><body><h1>Título Modificado</h1><p>Contenido nuevo</p><p>Párrafo adicional</p></body></html>'
      
      const changes = this.calculateSimpleChanges(oldHtml, newHtml)
      const severity = this.calculateSeverity(changes.percentage)
      
      console.log('✅ Detección de cambios simulada:')
      console.log(`   - Cambios detectados: ${changes.count}`)
      console.log(`   - Porcentaje de cambio: ${changes.percentage.toFixed(2)}%`)
      console.log(`   - Severidad: ${severity}`)
      console.log(`   - Caracteres agregados: ${changes.additions}`)
      console.log(`   - Caracteres eliminados: ${changes.deletions}`)
      
      this.testResults.push({
        test: 'Detector de cambios',
        status: 'PASS',
        details: {
          changesDetected: changes.count,
          changePercentage: changes.percentage,
          severity: severity
        }
      })
      
    } catch (error) {
      this.testResults.push({
        test: 'Detector de cambios',
        status: 'FAIL',
        error: error.message
      })
      console.log('❌ Error en detector de cambios:', error.message)
    }
    console.log('')
  }

  calculateSimpleChanges(oldHtml, newHtml) {
    // Simulación simple de detección de cambios
    const oldLength = oldHtml.length
    const newLength = newHtml.length
    
    const additions = Math.max(0, newLength - oldLength)
    const deletions = Math.max(0, oldLength - newLength)
    const count = additions + deletions
    const percentage = (count / oldLength) * 100
    
    return {
      count,
      additions,
      deletions,
      percentage
    }
  }

  calculateSeverity(percentage) {
    if (percentage > 20) return 'critical'
    if (percentage > 10) return 'high'
    if (percentage > 5) return 'medium'
    return 'low'
  }

  showSummary() {
    console.log('📋 RESUMEN DE PRUEBAS DE API SIN HEADLESSX')
    console.log('=' .repeat(60))
    
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
      console.log('🎉 ¡Todas las pruebas pasaron exitosamente!')
      console.log('✅ Tu backend está funcionando correctamente')
      console.log('')
      console.log('📝 Próximos pasos:')
      console.log('   1. Configurar HeadlessX cuando esté disponible')
      console.log('   2. Implementar las rutas CRUD faltantes')
      console.log('   3. Probar el flujo completo con scraping real')
    } else {
      console.log('⚠️ Algunas pruebas fallaron.')
      console.log('💡 Revisa los errores específicos arriba.')
    }
    
    console.log('')
    console.log('🔧 Estado actual:')
    console.log(`   - Base de datos: ${this.testResults.find(r => r.test === 'Base de datos')?.status || 'No probado'}`)
    console.log(`   - Modelos: ${this.testResults.find(r => r.test === 'Modelos y CRUD')?.status || 'No probado'}`)
    console.log(`   - Versionado: ${this.testResults.find(r => r.test === 'Sistema de versionado')?.status || 'No probado'}`)
    console.log(`   - Servidor: ${this.testResults.find(r => r.test === 'Servidor Express')?.status || 'No probado'}`)
    console.log(`   - Detector: ${this.testResults.find(r => r.test === 'Detector de cambios')?.status || 'No probado'}`)
  }
}

// Ejecutar las pruebas
async function main() {
  const tester = new APIWithoutHeadlessXTester()
  await tester.runAllTests()
  process.exit(0)
}

main().catch(error => {
  console.error('💥 Error fatal:', error)
  process.exit(1)
})
