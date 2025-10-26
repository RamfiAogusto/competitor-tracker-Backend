const { GoogleGenerativeAI } = require('@google/generative-ai')
const logger = require('../utils/logger')

class AIService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY
    if (!this.apiKey) {
      logger.warn('Google AI API Key no configurada')
      this.genAI = null
      return
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey)
    // Usar gemini-2.5-flash que es el modelo más reciente y rápido
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    logger.info('✅ Google AI (Gemini 2.5 Flash) inicializado correctamente')
  }

  /**
   * Analiza los cambios detectados en un competidor (optimizado para tokens)
   */
  async analyzeChanges(changeData) {
    if (!this.genAI) {
      throw new Error('Google AI no está configurado')
    }

    try {
      // Preparar información de cambios detectados
      let changesInfo = ''
      if (changeData.changeSummary) {
        changesInfo = `**Resumen del cambio:** ${changeData.changeSummary}\n\n`
      }
      
      if (changeData.changes && changeData.changes.length > 0) {
        changesInfo += `**Cambios específicos detectados:**\n`
        changeData.changes.forEach((change, idx) => {
          changesInfo += `${idx + 1}. ${change.type || 'Cambio'}: `
          if (change.value) {
            changesInfo += `"${change.value}"\n`
          } else if (change.added) {
            changesInfo += `Agregado "${change.added}"\n`
          } else if (change.removed) {
            changesInfo += `Eliminado "${change.removed}"\n`
          } else {
            changesInfo += `${JSON.stringify(change)}\n`
          }
        })
        changesInfo += '\n'
      }

      // Preparar los datos de forma optimizada
      const sectionsInfo = changeData.sections?.length > 0 ? 
        changeData.sections.map(s => `
- **Sección:** ${s.type} (${s.selector})
- **Tipo de cambio:** ${s.changeType}
- **Cambios detectados:**
${s.changes.map(c => `  * ${c.type}: "${c.before}" → "${c.after}"`).join('\n')}
`).join('\n') : 'No se identificaron secciones específicas.'

      // Preparar fragmentos HTML con contexto
      let htmlContextInfo = ''
      if (changeData.htmlSnippets?.snippets?.length > 0) {
        htmlContextInfo = `\n**Contexto HTML de los cambios:**\n`
        changeData.htmlSnippets.snippets.forEach((snippet, idx) => {
          htmlContextInfo += `\n${idx + 1}. **Cambio ${snippet.type === 'added' ? 'agregado' : 'eliminado'}:**\n`
          htmlContextInfo += `   Antes: ...${snippet.contextBefore}...\n`
          htmlContextInfo += `   ${snippet.type === 'added' ? '➕' : '➖'} "${snippet.change}"\n`
          htmlContextInfo += `   Después: ...${snippet.contextAfter}...\n`
        })
      }

      const prompt = `
Eres un analista experto en inteligencia competitiva. Analiza los siguientes cambios detectados en el sitio web de un competidor:

**Competidor:** ${changeData.competitorName}
**URL:** ${changeData.url}
**Fecha del cambio:** ${changeData.date || new Date().toISOString()}
**Tipo de cambio:** ${changeData.changeType || 'general'}
**Severidad:** ${changeData.severity || 'medium'}
**Total de cambios:** ${changeData.totalChanges || 1}

${changesInfo}
**Secciones modificadas:**
${sectionsInfo}
${htmlContextInfo}

Por favor, proporciona:
1. **Resumen ejecutivo** (2-3 líneas): ¿Qué cambió y por qué es importante?
2. **Impacto en el negocio** (3-4 puntos): ¿Cómo afecta esto a nuestra estrategia?
3. **Recomendaciones** (2-3 acciones): ¿Qué deberíamos hacer al respecto?
4. **Nivel de urgencia** (Alto/Medio/Bajo): ¿Qué tan rápido debemos actuar?

Responde en formato JSON con esta estructura:
{
  "resumen": "...",
  "impacto": ["punto 1", "punto 2", "punto 3"],
  "recomendaciones": ["acción 1", "acción 2"],
  "urgencia": "Alto|Medio|Bajo",
  "insights": "Análisis adicional relevante"
}
`

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      logger.info('Análisis de IA completado', { 
        competitorName: changeData.competitorName,
        sectionsAnalyzed: changeData.sections?.length || 0
      })
      
      // Intentar parsear la respuesta JSON
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (parseError) {
        logger.warn('No se pudo parsear respuesta JSON, devolviendo texto plano')
      }
      
      return {
        resumen: text,
        impacto: [],
        recomendaciones: [],
        urgencia: 'Medio',
        insights: text
      }
    } catch (error) {
      logger.error('Error al analizar cambios con IA:', error)
      throw error
    }
  }

  /**
   * Genera un resumen inteligente de múltiples cambios
   */
  async summarizeMultipleChanges(changes) {
    if (!this.genAI) {
      throw new Error('Google AI no está configurado')
    }

    try {
      const prompt = `
Eres un analista de inteligencia competitiva. Se han detectado ${changes.length} cambios en competidores. 

**Cambios detectados:**
${changes.map((change, index) => `
${index + 1}. **${change.competitorName}** (${change.url})
   - Tipo: ${change.changeType}
   - Severidad: ${change.severity}
   - Fecha: ${change.date}
   - Cambios: ${change.changeCount} modificaciones
`).join('\n')}

Proporciona un resumen ejecutivo de máximo 5 líneas que destaque:
1. Los cambios más importantes
2. Tendencias o patrones observados
3. Acciones recomendadas prioritarias

Responde en formato de texto plano, directo y conciso.
`

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      logger.info('Resumen de múltiples cambios completado', { changesCount: changes.length })
      
      return text
    } catch (error) {
      logger.error('Error al generar resumen con IA:', error)
      throw error
    }
  }

  /**
   * Categoriza automáticamente un cambio detectado
   */
  async categorizeChange(changeData) {
    if (!this.genAI) {
      throw new Error('Google AI no está configurado')
    }

    try {
      const prompt = `
Eres un experto en análisis de sitios web. Categoriza el siguiente cambio detectado:

**Cambio detectado:**
${JSON.stringify(changeData, null, 2)}

Categorías posibles:
- pricing: Cambios en precios, planes, ofertas
- content: Cambios en textos, headlines, descripciones
- design: Cambios visuales, colores, layout
- feature: Nuevas funcionalidades o características
- technical: Cambios técnicos, performance, SEO
- marketing: Cambios en CTAs, formularios, campañas
- other: Otros cambios

Responde SOLO con el nombre de la categoría (una palabra).
`

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const category = response.text().trim().toLowerCase()
      
      const validCategories = ['pricing', 'content', 'design', 'feature', 'technical', 'marketing', 'other']
      const finalCategory = validCategories.includes(category) ? category : 'other'
      
      logger.info('Cambio categorizado', { category: finalCategory })
      
      return finalCategory
    } catch (error) {
      logger.error('Error al categorizar cambio con IA:', error)
      return 'other'
    }
  }

  /**
   * Genera insights sobre un competidor basado en su historial
   */
  async generateCompetitorInsights(competitorData) {
    if (!this.genAI) {
      throw new Error('Google AI no está configurado')
    }

    try {
      const prompt = `
Eres un analista de inteligencia competitiva. Analiza el siguiente perfil de competidor:

**Competidor:** ${competitorData.name}
**URL:** ${competitorData.url}
**Total de cambios detectados:** ${competitorData.totalChanges}
**Último cambio:** ${competitorData.lastChange}
**Frecuencia de cambios:** ${competitorData.changeFrequency}

**Historial reciente:**
${JSON.stringify(competitorData.recentChanges, null, 2)}

Proporciona:
1. **Estrategia observada** (2-3 líneas): ¿Qué estrategia está siguiendo este competidor?
2. **Fortalezas** (2-3 puntos): ¿Qué están haciendo bien?
3. **Oportunidades para nosotros** (2-3 puntos): ¿Cómo podemos aprovechar esto?
4. **Predicción** (1-2 líneas): ¿Qué cambios podrían hacer próximamente?

Responde en formato JSON con esta estructura:
{
  "estrategia": "...",
  "fortalezas": ["punto 1", "punto 2"],
  "oportunidades": ["punto 1", "punto 2"],
  "prediccion": "..."
}
`

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      logger.info('Insights de competidor generados', { competitorName: competitorData.name })
      
      // Intentar parsear la respuesta JSON
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (parseError) {
        logger.warn('No se pudo parsear respuesta JSON, devolviendo texto plano')
      }
      
      return {
        estrategia: text,
        fortalezas: [],
        oportunidades: [],
        prediccion: ''
      }
    } catch (error) {
      logger.error('Error al generar insights con IA:', error)
      throw error
    }
  }

  /**
   * Test básico del servicio de IA
   */
  async testConnection() {
    if (!this.genAI) {
      throw new Error('Google AI no está configurado')
    }

    try {
      const prompt = 'Responde con "OK" si puedes leer este mensaje.'
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      logger.info('Test de conexión con Google AI exitoso', { response: text })
      
      return {
        success: true,
        message: 'Conexión con Google AI establecida correctamente',
        response: text
      }
    } catch (error) {
      logger.error('Error en test de conexión con Google AI:', error)
      throw error
    }
  }
}

module.exports = new AIService()

