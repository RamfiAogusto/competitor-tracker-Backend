/**
 * Test directo de captureChange
 */

const changeDetector = require('./src/services/changeDetector');

async function testCaptureChange() {
  console.log('🧪 Probando captureChange directamente...');
  
  try {
    console.log('🔍 Probando captureChange...');
    const result = await changeDetector.captureChange(
      'b5693dec-b986-4f98-a52d-012aef7b3217', // ID del competidor "ramfi portfolio"
      'https://ramfiaogusto.dev',
      {
        simulate: false,
        isManualCheck: true
      }
    );
    
    console.log('✅ captureChange ejecutado exitosamente');
    console.log('📋 Resultado:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error en captureChange:', error.message);
    console.error('📋 Stack:', error.stack);
  }
}

testCaptureChange().catch(console.error);
