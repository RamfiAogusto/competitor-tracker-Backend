/**
 * Test de debug para HeadlessX
 */

const axios = require('axios');

async function debugHeadlessX() {
  console.log('🔍 Debug de HeadlessX...');
  
  const client = axios.create({
    baseURL: 'http://headlessx.ramfiaogusto.dev',
    timeout: 60000,
    headers: {
      'Authorization': 'Bearer 8f633543787883dfe274fc244a223526124a8d3d71d9b74a9ee81369ce64c057',
      'Content-Type': 'application/json'
    }
  });

  const testUrl = 'https://ramfiaogusto.dev';

  try {
    console.log(`\n🌐 Probando GET con: ${testUrl}`);
    
    const response = await client.get('/api/html', {
      params: {
        url: testUrl,
        waitFor: 3000,
        removeScripts: 'true'
      }
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📋 Headers:`, JSON.stringify(response.headers, null, 2));
    
    // Verificar el tipo de respuesta
    console.log(`📄 Tipo de respuesta:`, typeof response.data);
    console.log(`📄 Es string:`, typeof response.data === 'string');
    console.log(`📄 Es objeto:`, typeof response.data === 'object');
    
    if (typeof response.data === 'string') {
      console.log(`📄 Longitud del HTML: ${response.data.length} caracteres`);
      console.log(`📋 Primeros 200 caracteres: ${response.data.substring(0, 200)}...`);
    } else {
      console.log(`📄 Data completa:`, JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.response?.status} - ${error.response?.statusText}`);
    console.log(`📋 Error data:`, JSON.stringify(error.response?.data, null, 2));
    console.log(`📋 Error message:`, error.message);
    console.log(`📋 Error config:`, {
      url: error.config?.url,
      method: error.config?.method,
      params: error.config?.params
    });
  }
}

debugHeadlessX().catch(console.error);
