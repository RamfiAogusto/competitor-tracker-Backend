/**
 * Script para listar los modelos disponibles en Google AI
 */

require('dotenv').config()
const { GoogleGenerativeAI } = require('@google/generative-ai')

async function listModels() {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  
  if (!apiKey) {
    console.error('❌ GOOGLE_AI_API_KEY no está configurada en .env')
    process.exit(1)
  }
  
  console.log('🔍 Listando modelos disponibles en Google AI...')
  console.log('API Key:', apiKey.substring(0, 10) + '...')
  console.log()
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // Intentar listar modelos
    const models = await genAI.listModels()
    
    console.log('✅ Modelos disponibles:')
    console.log()
    
    for (const model of models) {
      console.log(`📦 ${model.name}`)
      console.log(`   Display Name: ${model.displayName}`)
      console.log(`   Description: ${model.description}`)
      console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ')}`)
      console.log()
    }
    
  } catch (error) {
    console.error('❌ Error al listar modelos:', error.message)
    console.error()
    console.error('Detalles del error:')
    console.error(error)
  }
}

listModels()

