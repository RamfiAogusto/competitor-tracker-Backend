/**
 * Test simple de HeadlessX con URLs básicas
 */

const axios = require('axios');

async function testHeadlessX() {
  console.log('🧪 Probando HeadlessX con URLs simples...');
  
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
    'https://httpbin.org/html',
    'https://www.google.com'
  ];

  for (const url of testUrls) {
    try {
      console.log(`\n🌐 Probando: ${url}`);
      const response = await client.get('/api/html', {
        params: {
          url: url,
          waitFor: 3000,
          removeScripts: 'true'
        }
      });
      
      console.log(`✅ Éxito: ${response.data.title || 'Sin título'}`);
      console.log(`📄 Tamaño HTML: ${response.data.html ? response.data.html.length : 'N/A'} caracteres`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
    
    // Esperar entre requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

testHeadlessX().catch(console.error);
