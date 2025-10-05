/**
 * Test de eliminación en cascada de competidor
 */

const axios = require('axios');

async function testCascadeDelete() {
  console.log('🧪 Probando eliminación en cascada de competidor...');
  
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
    
    // 2. Crear competidor de prueba
    console.log('🏗️ Creando competidor de prueba...');
    const timestamp = Date.now();
    const createResponse = await axios.post(`${API_BASE}/competitors`, {
      name: `Test Cascade Delete ${timestamp}`,
      url: `https://example.com/test-${timestamp}`,
      description: 'Competidor para probar eliminación en cascada',
      priority: 'low'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const competitorId = createResponse.data.data.id;
    console.log(`✅ Competidor creado: ${competitorId}`);
    
    // 3. Generar algunos snapshots y alertas (usando simulación)
    console.log('📸 Generando snapshots y alertas...');
    for (let i = 1; i <= 3; i++) {
      await axios.post(`${API_BASE}/competitors/${competitorId}/manual-check`, {
        simulate: true,
        htmlVersion: `v${i}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`✅ Snapshot ${i} generado`);
    }
    
    // 4. Verificar datos antes de eliminar
    console.log('🔍 Verificando datos antes de eliminar...');
    
    // Verificar alertas
    const alertsResponse = await axios.get(`${API_BASE}/alerts?competitorId=${competitorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const alertsCount = alertsResponse.data.data?.length || 0;
    console.log(`🚨 Alertas encontradas: ${alertsCount}`);
    
    // Verificar cambios (que incluyen snapshots)
    const changesResponse = await axios.get(`${API_BASE}/changes?competitorId=${competitorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const changesCount = changesResponse.data.data?.length || 0;
    console.log(`📊 Cambios encontrados: ${changesCount}`);
    
    // 5. Eliminar competidor
    console.log('🗑️ Eliminando competidor...');
    const deleteResponse = await axios.delete(`${API_BASE}/competitors/${competitorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Competidor eliminado');
    console.log('📋 Resultado:', JSON.stringify(deleteResponse.data, null, 2));
    
    // 6. Verificar que los datos relacionados fueron eliminados
    console.log('🔍 Verificando eliminación en cascada...');
    
    try {
      // Intentar acceder a cambios (debería fallar)
      await axios.get(`${API_BASE}/changes?competitorId=${competitorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ ERROR: Los cambios no fueron eliminados');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Cambios eliminados correctamente');
      } else {
        console.log('⚠️ Error inesperado al verificar cambios:', error.message);
      }
    }
    
    try {
      // Intentar acceder a alertas (debería fallar)
      await axios.get(`${API_BASE}/alerts?competitorId=${competitorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ ERROR: Las alertas no fueron eliminadas');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Alertas eliminadas correctamente');
      } else {
        console.log('⚠️ Error inesperado al verificar alertas:', error.message);
      }
    }
    
    // 7. Verificar que el competidor no existe
    try {
      await axios.get(`${API_BASE}/competitors/${competitorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ ERROR: El competidor no fue eliminado');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Competidor eliminado correctamente');
      } else {
        console.log('⚠️ Error inesperado al verificar competidor:', error.message);
      }
    }
    
    console.log('🎉 Test de eliminación en cascada completado');
    
  } catch (error) {
    console.error('❌ Error en test:', error.response?.status, error.response?.statusText);
    console.error('📋 Error data:', JSON.stringify(error.response?.data, null, 2));
    console.error('📋 Error message:', error.message);
  }
}

testCascadeDelete().catch(console.error);
