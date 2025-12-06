const axios = require('axios');

async function verifyRender() {
  console.log('🧪 Verificando endpoint /api/render en localhost...');
  const url = 'http://localhost:3000/api/render';
  
  try {
    const response = await axios.post(url, {
      url: 'https://example.com',
      waitFor: 3000,
      viewport: { width: 1280, height: 720 }
    }, {
      headers: {
        'Authorization': 'Bearer 02c7665ced117e2ee2e4e19ce7ff6fb9916d46342d855085d40f1ebb6384af261', // Token obtenido de config
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ /api/render respondió exitosamente');
    console.log('Keys en data:', Object.keys(response.data));
    console.log('Contenido HTML presente:', response.data.html ? 'SÍ' : 'NO');
    console.log('Content presente:', response.data.content ? 'SÍ' : 'NO');
  } catch (error) {
    console.log('❌ Error en /api/render:', error.message);
    if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
    }
  }
}

verifyRender();
