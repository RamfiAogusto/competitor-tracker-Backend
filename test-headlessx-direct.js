/**
 * Script para probar directamente la conexión con HeadlessX
 */

const axios = require('axios')

const HEADLESSX_URL = 'http://headlessx.ramfiaogusto.dev'
const HEADLESSX_TOKEN = '8f633543787883dfe274fc244a223526124a8d3d71d9b74a9ee81369ce64c057'

async function testHeadlessXConnection() {
  console.log('🔍 Probando conexión directa con HeadlessX...')
  console.log('📍 URL:', HEADLESSX_URL)
  console.log('🔑 Token:', HEADLESSX_TOKEN ? 'Presente' : 'Ausente')
  
  const client = axios.create({
    baseURL: HEADLESSX_URL,
    timeout: 30000,
    headers: {
      'Authorization': `Bearer ${HEADLESSX_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })

  try {
    // 1. Probar estado del servidor
    console.log('\n📊 1. Probando estado del servidor...')
    const statusResponse = await client.get('/api/status')
    console.log('✅ Estado del servidor:', statusResponse.data)
  } catch (error) {
    console.error('❌ Error en estado del servidor:', error.response?.status, error.response?.data || error.message)
  }

  try {
    // 2. Probar extracción de HTML simple con GET
    console.log('\n🌐 2. Probando extracción de HTML (GET)...')
    const params = {
      url: 'https://example.com',
      waitFor: 2000,
      removeScripts: 'true'
    }
    console.log('📤 Parámetros enviados:', JSON.stringify(params, null, 2))
    const htmlResponse = await client.get('/api/html', { params })
    console.log('✅ HTML extraído exitosamente')
    console.log('📄 Tamaño del HTML:', htmlResponse.data.html ? htmlResponse.data.html.length : 'N/A')
    console.log('📋 Título:', htmlResponse.data.title || 'N/A')
  } catch (error) {
    console.error('❌ Error extrayendo HTML (GET):', error.response?.status, error.response?.data || error.message)
  }

  try {
    // 3. Probar con Google
    console.log('\n🔍 3. Probando con Google...')
    const googleResponse = await client.post('/api/html', {
      url: 'https://www.google.com',
      waitFor: 3000,
      viewport: { width: 1920, height: 1080 },
      removeScripts: true
    })
    console.log('✅ Google HTML extraído exitosamente')
    console.log('📄 Tamaño del HTML:', googleResponse.data.html ? googleResponse.data.html.length : 'N/A')
    console.log('📋 Título:', googleResponse.data.title || 'N/A')
  } catch (error) {
    console.error('❌ Error con Google:', error.response?.status, error.response?.data || error.message)
  }

  try {
    // 4. Probar con tu sitio
    console.log('\n🏠 4. Probando con tu sitio...')
    const siteResponse = await client.post('/api/html', {
      url: 'https://ramfiaogusto.dev',
      waitFor: 5000,
      viewport: { width: 1920, height: 1080 },
      removeScripts: true
    })
    console.log('✅ Sitio HTML extraído exitosamente')
    console.log('📄 Tamaño del HTML:', siteResponse.data.html ? siteResponse.data.html.length : 'N/A')
    console.log('📋 Título:', siteResponse.data.title || 'N/A')
  } catch (error) {
    console.error('❌ Error con tu sitio:', error.response?.status, error.response?.data || error.message)
  }
}

async function main() {
  console.log('🚀 Iniciando prueba directa de HeadlessX...\n')
  await testHeadlessXConnection()
  console.log('\n✅ Prueba completada')
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { testHeadlessXConnection }
