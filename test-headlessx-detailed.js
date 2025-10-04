/**
 * Test detallado de HeadlessX para diagnosticar el problema
 */

const axios = require('axios');

async function testHeadlessXDetailed() {
  console.log('🧪 Test detallado de HeadlessX...');
  
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
        waitFor: 5000,
        removeScripts: 'true'
      }
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📋 Headers:`, JSON.stringify(response.headers, null, 2));
    console.log(`📄 Data completa:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.html) {
      console.log(`📄 HTML length: ${response.data.html.length} caracteres`);
      console.log(`📋 Primeros 500 caracteres: ${response.data.html.substring(0, 500)}...`);
    } else {
      console.log('❌ No se obtuvo HTML en la respuesta');
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.response?.status} - ${error.response?.statusText}`);
    console.log(`📋 Error data:`, JSON.stringify(error.response?.data, null, 2));
    console.log(`📋 Error message:`, error.message);
  }
}

testHeadlessXDetailed().catch(console.error);
