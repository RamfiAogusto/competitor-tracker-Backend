/**
 * Script de prueba para el extractor de secciones y análisis de IA
 */

require('dotenv').config()
const sectionExtractor = require('./src/services/sectionExtractor')
const aiService = require('./src/services/aiService')
const logger = require('./src/utils/logger')

// HTML de prueba - Versión 1
const htmlBefore = `
<!DOCTYPE html>
<html>
<head>
  <title>Competitor X - SaaS Platform</title>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
    </nav>
  </header>
  
  <main>
    <section class="hero">
      <h1>Welcome to Competitor X</h1>
      <p>The best SaaS platform for your business</p>
      <button>Get Started</button>
    </section>
    
    <section class="pricing">
      <h2>Our Pricing Plans</h2>
      <div class="plan">
        <h3>Basic Plan</h3>
        <p class="price">$29/month</p>
        <ul>
          <li>Feature A</li>
          <li>Feature B</li>
          <li>5 Users</li>
        </ul>
      </div>
      <div class="plan">
        <h3>Pro Plan</h3>
        <p class="price">$99/month</p>
        <ul>
          <li>Everything in Basic</li>
          <li>Feature C</li>
          <li>Feature D</li>
          <li>20 Users</li>
        </ul>
      </div>
    </section>
    
    <section class="features">
      <h2>Key Features</h2>
      <div class="feature">
        <h3>Analytics</h3>
        <p>Track your metrics in real-time</p>
      </div>
      <div class="feature">
        <h3>Collaboration</h3>
        <p>Work together with your team</p>
      </div>
    </section>
  </main>
  
  <footer>
    <p>&copy; 2024 Competitor X</p>
  </footer>
</body>
</html>
`

// HTML de prueba - Versión 2 (con cambios en pricing y features)
const htmlAfter = `
<!DOCTYPE html>
<html>
<head>
  <title>Competitor X - SaaS Platform</title>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
    </nav>
  </header>
  
  <main>
    <section class="hero">
      <h1>Welcome to Competitor X</h1>
      <p>The best SaaS platform for your business</p>
      <button>Get Started</button>
    </section>
    
    <section class="pricing">
      <h2>Our Pricing Plans</h2>
      <div class="plan">
        <h3>Basic Plan</h3>
        <p class="price">$19/month</p>
        <ul>
          <li>Feature A</li>
          <li>Feature B</li>
          <li>5 Users</li>
        </ul>
      </div>
      <div class="plan">
        <h3>Pro Plan</h3>
        <p class="price">$79/month</p>
        <ul>
          <li>Everything in Basic</li>
          <li>Feature C</li>
          <li>Feature D</li>
          <li>Feature E (NEW!)</li>
          <li>50 Users</li>
        </ul>
      </div>
      <div class="plan">
        <h3>Enterprise Plan</h3>
        <p class="price">$299/month</p>
        <ul>
          <li>Everything in Pro</li>
          <li>Dedicated Support</li>
          <li>Custom Integrations</li>
          <li>Unlimited Users</li>
        </ul>
      </div>
    </section>
    
    <section class="features">
      <h2>Key Features</h2>
      <div class="feature">
        <h3>Analytics</h3>
        <p>Track your metrics in real-time with AI-powered insights</p>
      </div>
      <div class="feature">
        <h3>Collaboration</h3>
        <p>Work together with your team</p>
      </div>
      <div class="feature">
        <h3>Automation</h3>
        <p>Automate your workflows and save time</p>
      </div>
    </section>
  </main>
  
  <footer>
    <p>&copy; 2024 Competitor X</p>
  </footer>
</body>
</html>
`

// Simular cambios detectados (como los que vendría del diff)
const mockDiffChanges = [
  { type: 'removed', value: '$29/month', path: 'section.pricing .plan:nth-child(1) .price' },
  { type: 'added', value: '$19/month', path: 'section.pricing .plan:nth-child(1) .price' },
  { type: 'removed', value: '$99/month', path: 'section.pricing .plan:nth-child(2) .price' },
  { type: 'added', value: '$79/month', path: 'section.pricing .plan:nth-child(2) .price' },
  { type: 'added', value: 'Feature E (NEW!)', path: 'section.pricing .plan:nth-child(2) ul' },
  { type: 'removed', value: '20 Users', path: 'section.pricing .plan:nth-child(2) ul' },
  { type: 'added', value: '50 Users', path: 'section.pricing .plan:nth-child(2) ul' },
  { type: 'added', value: 'Enterprise Plan', path: 'section.pricing' },
  { type: 'added', value: '$299/month', path: 'section.pricing .plan:nth-child(3) .price' },
  { type: 'removed', value: 'Track your metrics in real-time', path: 'section.features .feature:nth-child(1) p' },
  { type: 'added', value: 'Track your metrics in real-time with AI-powered insights', path: 'section.features .feature:nth-child(1) p' },
  { type: 'added', value: 'Automation', path: 'section.features' },
  { type: 'added', value: 'Automate your workflows and save time', path: 'section.features .feature:nth-child(3) p' }
]

async function testSectionExtraction() {
  console.log('🧪 Iniciando prueba de extracción de secciones...\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  try {
    // 1. Extraer secciones
    console.log('1️⃣ Extrayendo secciones específicas...\n')
    const extractedData = sectionExtractor.extractChangedSection(
      htmlBefore,
      htmlAfter,
      mockDiffChanges
    )

    console.log('✅ Secciones extraídas:')
    console.log(`   Total de cambios: ${extractedData.totalChanges}`)
    console.log(`   Resumen: ${extractedData.summary}`)
    console.log(`   Secciones identificadas: ${extractedData.sections.length}\n`)

    extractedData.sections.forEach((section, index) => {
      console.log(`   📍 Sección ${index + 1}:`)
      console.log(`      Tipo: ${section.sectionType}`)
      console.log(`      Selector: ${section.selector}`)
      console.log(`      Cambios: ${section.changes.length}`)
      section.changes.forEach((change, i) => {
        console.log(`         ${i + 1}. ${change.type}: "${change.before}" → "${change.after}"`)
      })
      console.log()
    })

    // 2. Preparar para IA
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('2️⃣ Preparando datos para IA...\n')
    const aiPayload = sectionExtractor.prepareForAI(extractedData)

    console.log('✅ Datos optimizados:')
    console.log(`   Tokens estimados: ${aiPayload.estimatedTokens}`)
    console.log(`   Tamaño: ${(aiPayload.size / 1024).toFixed(2)} KB`)
    console.log(`   Secciones: ${aiPayload.data.sections.length}\n`)

    // 3. Análisis de IA
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('3️⃣ Enviando a IA para análisis...\n')

    const aiAnalysis = await aiService.analyzeChanges({
      competitorName: 'Competitor X',
      url: 'https://competitorx.com',
      date: new Date().toISOString(),
      changeType: 'pricing',
      severity: 'high',
      totalChanges: extractedData.totalChanges,
      sections: aiPayload.data.sections
    })

    console.log('✅ Análisis de IA completado:\n')
    console.log('📊 RESUMEN EJECUTIVO:')
    console.log(`   ${aiAnalysis.resumen}\n`)

    console.log('💥 IMPACTO EN EL NEGOCIO:')
    aiAnalysis.impacto?.forEach((impacto, i) => {
      console.log(`   ${i + 1}. ${impacto}`)
    })
    console.log()

    console.log('💡 RECOMENDACIONES:')
    aiAnalysis.recomendaciones?.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`)
    })
    console.log()

    console.log(`🚨 URGENCIA: ${aiAnalysis.urgencia}\n`)

    if (aiAnalysis.insights) {
      console.log('🔍 INSIGHTS ADICIONALES:')
      console.log(`   ${aiAnalysis.insights}\n`)
    }

    // 4. Comparación de tokens
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('4️⃣ Comparación de eficiencia:\n')

    const fullHtmlTokens = Math.ceil((htmlBefore.length + htmlAfter.length) / 4)
    const sectionsTokens = aiPayload.estimatedTokens
    const savings = ((1 - sectionsTokens / fullHtmlTokens) * 100).toFixed(1)

    console.log('📊 Eficiencia de tokens:')
    console.log(`   HTML completo: ~${fullHtmlTokens} tokens`)
    console.log(`   Solo secciones: ~${sectionsTokens} tokens`)
    console.log(`   Ahorro: ${savings}% 🎉\n`)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ PRUEBA COMPLETADA EXITOSAMENTE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  } catch (error) {
    console.error('❌ Error en la prueba:', error)
    console.error('\nDetalles:', error.stack)
  }
}

testSectionExtraction()

