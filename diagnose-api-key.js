/**
 * Script de diagnóstico para la API key de Google AI
 */

require('dotenv').config()
const https = require('https')

const apiKey = process.env.GOOGLE_AI_API_KEY

console.log('🔍 Diagnóstico de API Key de Google AI\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

if (!apiKey) {
  console.error('❌ ERROR: GOOGLE_AI_API_KEY no está configurada en .env')
  console.log('\n📝 Solución:')
  console.log('1. Ve a https://aistudio.google.com/app/apikey')
  console.log('2. Crea una nueva API Key')
  console.log('3. Agrégala al archivo .env')
  process.exit(1)
}

console.log('✅ API Key encontrada en .env')
console.log(`📋 API Key: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 5)}`)
console.log(`📏 Longitud: ${apiKey.length} caracteres`)
console.log()

// Verificar formato de la API key
if (!apiKey.startsWith('AIza')) {
  console.warn('⚠️  ADVERTENCIA: La API key no tiene el formato esperado (debería empezar con "AIza")')
}

if (apiKey.length < 35 || apiKey.length > 45) {
  console.warn('⚠️  ADVERTENCIA: La longitud de la API key parece inusual (típicamente 39 caracteres)')
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
console.log('🧪 Probando conexión con Google AI API...\n')

// Probar la API key haciendo una petición directa
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`

https.get(url, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log(`📡 Código de respuesta: ${res.statusCode}\n`)

    if (res.statusCode === 200) {
      console.log('✅ ¡API Key VÁLIDA! La conexión fue exitosa\n')
      
      try {
        const response = JSON.parse(data)
        if (response.models && response.models.length > 0) {
          console.log('📦 Modelos disponibles:')
          response.models.slice(0, 5).forEach(model => {
            console.log(`   - ${model.name}`)
          })
          if (response.models.length > 5) {
            console.log(`   ... y ${response.models.length - 5} más`)
          }
        }
      } catch (e) {
        console.log('Respuesta:', data.substring(0, 200))
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('✅ TODO ESTÁ CORRECTO')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      console.log('🚀 Ahora puedes ejecutar: node test-ai.js')
      
    } else if (res.statusCode === 400) {
      console.log('❌ API Key INVÁLIDA\n')
      
      try {
        const error = JSON.parse(data)
        console.log('📋 Detalles del error:')
        console.log(JSON.stringify(error, null, 2))
      } catch (e) {
        console.log('Respuesta:', data)
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔧 SOLUCIONES POSIBLES:')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      
      console.log('1️⃣  HABILITAR LA API:')
      console.log('   Ve a: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com')
      console.log('   Haz clic en "Enable" (Habilitar)\n')
      
      console.log('2️⃣  CREAR UNA NUEVA API KEY:')
      console.log('   Ve a: https://aistudio.google.com/app/apikey')
      console.log('   Haz clic en "Create API Key"')
      console.log('   Copia la nueva API key y reemplázala en .env\n')
      
      console.log('3️⃣  VERIFICAR RESTRICCIONES:')
      console.log('   Ve a: https://console.cloud.google.com/apis/credentials')
      console.log('   Busca tu API key')
      console.log('   Verifica que no tenga restricciones de IP o API\n')
      
      console.log('4️⃣  VERIFICAR FACTURACIÓN:')
      console.log('   Ve a: https://console.cloud.google.com/billing')
      console.log('   Asegúrate de tener una cuenta de facturación activa\n')
      
      console.log('5️⃣  VERIFICAR REGIÓN:')
      console.log('   Algunos países tienen restricciones geográficas')
      console.log('   Verifica en: https://ai.google.dev/available_regions\n')
      
    } else if (res.statusCode === 403) {
      console.log('❌ ACCESO DENEGADO (403)\n')
      console.log('La API key es válida pero no tiene permisos para acceder a la API\n')
      console.log('🔧 Solución:')
      console.log('   Habilita la API en: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com\n')
      
    } else {
      console.log(`❌ Error inesperado: ${res.statusCode}\n`)
      console.log('Respuesta:', data.substring(0, 500))
    }
  })
}).on('error', (err) => {
  console.error('❌ Error de conexión:', err.message)
  console.log('\n🔧 Verifica tu conexión a internet y vuelve a intentar')
})

