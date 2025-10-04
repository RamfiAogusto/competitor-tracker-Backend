/**
 * Test específico para ramfiaogusto.dev
 */

const axios = require('axios');

async function testRamfiaogustoDev() {
  console.log('🧪 Probando HeadlessX con ramfiaogusto.dev...');
  
  const client = axios.create({
    baseURL: 'http://headlessx.ramfiaogusto.dev',
    timeout: 60000, // Timeout más largo
    headers: {
      'Authorization': 'Bearer 8f633543787883dfe274fc244a223526124a8d3d71d9b74a9ee81369ce64c057',
      'Content-Type': 'application/json'
    }
  });

  const testUrl = 'https://ramfiaogusto.dev';

  try {
    console.log(`\n🌐 Probando GET con: ${testUrl}`);
    
    // Probar GET primero
    const getResponse = await client.get('/api/html', {
      params: {
        url: testUrl,
        waitFor: 5000,
        removeScripts: 'true'
      }
    });
    
    console.log(`✅ GET Éxito: ${getResponse.data.title || 'Sin título'}`);
    console.log(`📄 Tamaño HTML: ${getResponse.data.html ? getResponse.data.html.length : 'N/A'} caracteres`);
    
    if (getResponse.data.html) {
      console.log(`📋 Primeros 300 caracteres: ${getResponse.data.html.substring(0, 300)}...`);
    }
    
  } catch (error) {
    console.log(`❌ GET Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    
    // Si GET falla, probar POST con diferentes formatos
    console.log('\n🔄 Probando POST con diferentes formatos...');
    
    const postFormats = [
      // Formato 1: URL como query parameter
      {
        method: 'POST',
        url: `/api/html?url=${encodeURIComponent(testUrl)}`,
        data: {
          waitFor: 5000,
          removeScripts: true
        }
      },
      // Formato 2: URL en el body
      {
        method: 'POST',
        url: '/api/html',
        data: {
          url: testUrl,
          waitFor: 5000,
          removeScripts: true
        }
      },
      // Formato 3: Con viewport
      {
        method: 'POST',
        url: '/api/html',
        data: {
          url: testUrl,
          waitFor: 5000,
          viewport: { width: 1920, height: 1080 },
          removeScripts: true
        }
      }
    ];

    for (let i = 0; i < postFormats.length; i++) {
      try {
        console.log(`\n📤 Probando formato ${i + 1}:`);
        console.log('URL:', postFormats[i].url);
        console.log('Data:', JSON.stringify(postFormats[i].data, null, 2));
        
        const response = await client.request(postFormats[i]);
        
        console.log(`✅ Formato ${i + 1} Éxito: ${response.data.title || 'Sin título'}`);
        console.log(`📄 Tamaño HTML: ${response.data.html ? response.data.html.length : 'N/A'} caracteres`);
        
        if (response.data.html) {
          console.log(`📋 Primeros 300 caracteres: ${response.data.html.substring(0, 300)}...`);
        }
        
        break; // Si uno funciona, no probar los demás
        
      } catch (error) {
        console.log(`❌ Formato ${i + 1} Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
          console.log('📋 Respuesta:', JSON.stringify(error.response.data, null, 2));
        }
      }
      
      // Esperar entre intentos
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

testRamfiaogustoDev().catch(console.error);
