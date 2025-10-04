/**
 * Script de prueba para el generador de mensajes inteligentes
 */

const smartMessageGenerator = require('./src/services/smartMessageGenerator')

// HTML de ejemplo para pruebas
const previousHtml = `
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
            <a href="/contact">Contact</a>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>Welcome to Test Competitor</h2>
            <p>We provide amazing services for your business.</p>
            <button>Get Started</button>
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
</html>
`

const currentHtml = `
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
        <section class="pricing">
            <h3>Our Pricing</h3>
            <div class="price-card">
                <h4>Basic Plan</h4>
                <p class="price">$29/month</p>
            </div>
            <div class="price-card">
                <h4>Pro Plan</h4>
                <p class="price">$59/month</p>
            </div>
            <div class="price-card">
                <h4>Enterprise Plus</h4>
                <p class="price">$299/month</p>
            </div>
        </section>
        <section class="features">
            <h3>New Features</h3>
            <p>Introducing our new AI Analytics Dashboard</p>
        </section>
    </main>
</body>
</html>
`

async function testSmartMessages() {
  console.log('🧠 Probando generador de mensajes inteligentes...\n')

  const testCases = [
    {
      name: 'Cambios en precios y navegación',
      data: {
        competitorName: 'Test Competitor',
        changeCount: 3,
        changePercentage: 15.5,
        severity: 'high',
        previousHtml,
        currentHtml,
        changeSummary: 'Nuevos planes de precios y navegación actualizada',
        affectedSections: ['pricing', 'navigation']
      }
    },
    {
      name: 'Solo cambios menores',
      data: {
        competitorName: 'Test Competitor',
        changeCount: 1,
        changePercentage: 2.3,
        severity: 'low',
        previousHtml,
        currentHtml,
        changeSummary: 'Cambio menor detectado',
        affectedSections: ['content']
      }
    },
    {
      name: 'Sin HTML (fallback)',
      data: {
        competitorName: 'Test Competitor',
        changeCount: 5,
        changePercentage: 25.0,
        severity: 'critical',
        previousHtml: null,
        currentHtml: null,
        changeSummary: 'Cambios críticos detectados',
        affectedSections: ['pricing', 'features']
      }
    }
  ]

  for (const testCase of testCases) {
    console.log(`📝 ${testCase.name}:`)
    console.log('─'.repeat(50))
    
    try {
      const message = smartMessageGenerator.generateSmartMessage(testCase.data)
      console.log(`✅ Mensaje generado: ${message}\n`)
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`)
    }
  }

  // Probar análisis individual
  console.log('🔍 Probando análisis de cambios...\n')
  
  try {
    const analysis = smartMessageGenerator.analyzeChanges(previousHtml, currentHtml)
    console.log('📊 Análisis de cambios:')
    console.log(JSON.stringify(analysis, null, 2))
  } catch (error) {
    console.log(`❌ Error en análisis: ${error.message}`)
  }
}

// Ejecutar pruebas
testSmartMessages().catch(console.error)
