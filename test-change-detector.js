/**
 * Test directo del changeDetector
 */

const changeDetector = require('./src/services/changeDetector');

async function testChangeDetector() {
  console.log('🧪 Probando changeDetector directamente...');
  
  try {
    console.log('🌐 Probando getPageHTML...');
    const html = await changeDetector.getPageHTML('https://ramfiaogusto.dev', {
      waitFor: 3000,
      removeScripts: true,
      isInitialCapture: false
    });
    
    console.log('✅ HTML obtenido exitosamente');
    console.log('📋 Longitud del HTML:', html ? html.length : 'N/A');
    
    if (html) {
      console.log('📄 Primeros 200 caracteres:', html.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('❌ Error en changeDetector:', error.message);
    console.error('📋 Stack:', error.stack);
  }
}

testChangeDetector().catch(console.error);