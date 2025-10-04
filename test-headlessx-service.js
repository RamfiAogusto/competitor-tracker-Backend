/**
 * Test directo del headlessXService
 */

const headlessXService = require('./src/services/headlessXService');

async function testHeadlessXService() {
  console.log('🧪 Probando headlessXService directamente...');
  
  try {
    console.log('📊 1. Probando getStatus...');
    const status = await headlessXService.getStatus();
    console.log('✅ Status:', status);
    
    console.log('\n🌐 2. Probando extractHTML...');
    const htmlResult = await headlessXService.extractHTML('https://ramfiaogusto.dev', {
      waitFor: 3000,
      removeScripts: true
    });
    
    console.log('✅ HTML extraído exitosamente');
    console.log('📋 Resultado:', {
      title: htmlResult.title,
      url: htmlResult.url,
      htmlLength: htmlResult.html ? htmlResult.html.length : 'N/A',
      contentLength: htmlResult.contentLength,
      wasTimeout: htmlResult.wasTimeout
    });
    
    if (htmlResult.html) {
      console.log('📄 Primeros 200 caracteres:', htmlResult.html.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('❌ Error en headlessXService:', error.message);
    console.error('📋 Stack:', error.stack);
  }
}

testHeadlessXService().catch(console.error);
