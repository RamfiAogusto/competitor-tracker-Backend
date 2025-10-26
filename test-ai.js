/**
 * Script de prueba para el servicio de IA
 * Ejecutar con: node test-ai.js
 */

require('dotenv').config()
const aiService = require('./src/services/aiService')

async function testAI() {
  console.log('🤖 Iniciando pruebas del servicio de IA...\n')

  try {
    // Test 1: Conexión básica
    console.log('1️⃣ Test de conexión...')
    const connectionTest = await aiService.testConnection()
    console.log('✅ Conexión exitosa:', connectionTest.message)
    console.log('   Respuesta:', connectionTest.response)
    console.log()

    // Test 2: Análisis de cambios
    console.log('2️⃣ Test de análisis de cambios...')
    const changeData = {
      competitorName: 'Competidor XYZ',
      url: 'https://competidor.com',
      date: new Date().toISOString(),
      changeType: 'pricing',
      severity: 'critical',
      changes: {
        before: 'Plan Pro: $99/mes',
        after: 'Plan Pro: $79/mes',
        changeCount: 1
      }
    }
    
    const analysis = await aiService.analyzeChanges(changeData)
    console.log('✅ Análisis completado:')
    console.log('   Resumen:', analysis.resumen)
    console.log('   Impacto:', analysis.impacto)
    console.log('   Recomendaciones:', analysis.recomendaciones)
    console.log('   Urgencia:', analysis.urgencia)
    console.log()

    // Test 3: Categorización
    console.log('3️⃣ Test de categorización...')
    const category = await aiService.categorizeChange({
      description: 'Se agregó un nuevo formulario de contacto en la página principal',
      location: 'homepage',
      type: 'addition'
    })
    console.log('✅ Categoría detectada:', category)
    console.log()

    // Test 4: Resumen de múltiples cambios
    console.log('4️⃣ Test de resumen de múltiples cambios...')
    const changes = [
      {
        competitorName: 'Competidor A',
        url: 'https://competidora.com',
        changeType: 'pricing',
        severity: 'high',
        date: new Date().toISOString(),
        changeCount: 2
      },
      {
        competitorName: 'Competidor B',
        url: 'https://competidorb.com',
        changeType: 'feature',
        severity: 'medium',
        date: new Date().toISOString(),
        changeCount: 5
      }
    ]
    
    const summary = await aiService.summarizeMultipleChanges(changes)
    console.log('✅ Resumen generado:')
    console.log(summary)
    console.log()

    // Test 5: Insights de competidor
    console.log('5️⃣ Test de insights de competidor...')
    const competitorData = {
      name: 'Competidor XYZ',
      url: 'https://competidor.com',
      totalChanges: 45,
      lastChange: new Date().toISOString(),
      changeFrequency: '3 cambios por semana',
      recentChanges: [
        { type: 'pricing', date: '2025-10-20', description: 'Bajó precios 20%' },
        { type: 'feature', date: '2025-10-18', description: 'Agregó nueva funcionalidad' },
        { type: 'marketing', date: '2025-10-15', description: 'Lanzó campaña de descuentos' }
      ]
    }
    
    const insights = await aiService.generateCompetitorInsights(competitorData)
    console.log('✅ Insights generados:')
    console.log('   Estrategia:', insights.estrategia)
    console.log('   Fortalezas:', insights.fortalezas)
    console.log('   Oportunidades:', insights.oportunidades)
    console.log('   Predicción:', insights.prediccion)
    console.log()

    console.log('🎉 ¡Todas las pruebas completadas exitosamente!')
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Ejecutar las pruebas
testAI()

