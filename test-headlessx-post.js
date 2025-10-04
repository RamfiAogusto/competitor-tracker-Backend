/**
 * Test de HeadlessX usando POST (como lo hace el backend)
 */

const axios = require('axios');

async function testHeadlessXPost() {
  console.log('🧪 Probando HeadlessX con POST (como backend)...');
  
  const client = axios.create({
    baseURL: 'http://headlessx.ramfiaogusto.dev',
    timeout: 30000,
    headers: {
      'Authorization': 'Bearer 8f633543787883dfe274fc244a223526124a8d3d71d9b74a9ee81369ce64c057',
      'Content-Type': 'application/json'
    }
  });

  const testUrls = [
    'https://example.com',
    'https://httpbin.org/html'
  ];

  for (const url of testUrls) {
    try {
      console.log(`\n🌐 Probando POST: ${url}`);
      
      const payload = {
        url: url,
        waitFor: 3000,
        viewport: { width: 1920, height: 1080 },
        removeScripts: true
      };
      
      console.log('📤 Payload enviado:', JSON.stringify(payload, null, 2));
      
      const response = await client.post('/api/html', payload);
      
      console.log(`✅ Éxito: ${response.data.title || 'Sin título'}`);
      console.log(`📄 Tamaño HTML: ${response.data.html ? response.data.html.length : 'N/A'} caracteres`);
      
      if (response.data.html) {
        console.log(`📋 Primeros 200 caracteres: ${response.data.html.substring(0, 200)}...`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      if (error.response?.data) {
        console.log('📋 Respuesta completa:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // Esperar entre requests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

testHeadlessXPost().catch(console.error);
