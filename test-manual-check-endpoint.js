/**
 * Test directo del endpoint manual-check
 */

const axios = require('axios');

async function testManualCheckEndpoint() {
  console.log('🧪 Probando endpoint manual-check directamente...');
  
  const API_BASE = 'http://localhost:3002/api';
  
  try {
    // 1. Login
    console.log('🔐 Iniciando sesión...');
    const loginResponse = await axios.post(`${API_BASE}/users/login`, {
      email: 'ramfiaogusto@gmail.com',
      password: '12345678'
    });
    
    const token = loginResponse.data.data.tokens.accessToken;
    console.log('✅ Login exitoso');
    
    // 2. Test manual-check
    console.log('🔍 Probando manual-check...');
    const manualCheckResponse = await axios.post(
      `${API_BASE}/competitors/b5693dec-b986-4f98-a52d-012aef7b3217/manual-check`,
      {
        simulate: false
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    console.log('✅ Manual-check exitoso');
    console.log('📋 Resultado:', JSON.stringify(manualCheckResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error en endpoint:', error.response?.status, error.response?.statusText);
    console.error('📋 Error data:', JSON.stringify(error.response?.data, null, 2));
    console.error('📋 Error message:', error.message);
  }
}

testManualCheckEndpoint().catch(console.error);
