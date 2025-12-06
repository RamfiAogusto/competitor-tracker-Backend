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
   * Analiza la estructura inicial de un sitio (Perfilado de Competidor)
   */
  async analyzeInitialStructure(data) {
    if (!this.genAI) {
      throw new Error('Google AI no está configurado')
    }

    try {
      const sectionsList = data.sections.map(s => 
        `- ${s.type} (${s.selector}): Confianza ${(s.confidence * 100).toFixed(0)}%`
      ).join('\n')

      const prompt = `
Eres un Estratega de Inteligencia Competitiva. Acabamos de descubrir un nuevo competidor y esta es la estructura de su sitio web.
Tu trabajo es crear un "Perfil de Amenaza" inicial.

**Datos del Competidor:**
- Nombre Interno (Asignado por el usuario): ${data.competitorName}
- URL Real: ${data.url}
- Secciones Detectadas:
${sectionsList}

**Instrucción:**
Analiza qué tipo de negocio es y cuál es su estrategia basándote PRINCIPALMENTE en su URL y estructura web.
ADVERTENCIA: El "Nombre Interno" es solo una etiqueta que le puso el usuario al guardarlo (ej: "portfolio", "competencia 1"). NO bases tu análisis estratégico en este nombre a menos que te sirva de contexto. Lo importante es lo que hay en el sitio.

NO menciones obviedades como "se ha iniciado el monitoreo".
Céntrate 100% en perfilar el negocio real detrás de esa URL.

Responde en formato JSON:
{
  "resumen": "Perfil breve del competidor (ej: 'Consultor freelance enfocado en UX...', 'SaaS B2B agresivo con modelo freemium...'). Deduce su enfoque basado en las secciones (ej: si tiene 'pricing' es producto, si tiene 'blog' busca SEO).",
  "impacto": [
    "Punto 1: Nivel de madurez digital percibido (basado en tecnologías/estructura)",
    "Punto 2: Posible modelo de negocio (ej: Venta directa vs Lead generation)",
    "Punto 3: Enfoque de mercado (ej: Corporativo vs Startup)"
  ],
  "recomendaciones": [
    "Acción estratégica 1 (ej: Revisar sus precios si tienen tabla de precios)",
    "Acción estratégica 2 (ej: Analizar su copy en la sección Hero)"
  ],
  "urgencia": "Bajo|Medio|Alto (Basado en qué tan completa/profesional se ve su web)",
  "insights": "Cualquier observación técnica o estratégica adicional (ej: 'Usa frameworks modernos', 'Estructura muy simple')"
}
`

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      logger.info('Análisis inicial de estructura completado', { competitorName: data.competitorName })
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (parseError) {
        logger.warn('No se pudo parsear respuesta JSON inicial, devolviendo texto plano')
      }
      
      return {
        resumen: text,
        impacto: [],
        recomendaciones: [],
        urgencia: 'Bajo',
        insights: text
      }
    } catch (error) {
      logger.error('Error al analizar estructura inicial:', error)
      throw error // Re-throw to be handled by caller
    }
  }

  /**
   * Analiza los cambios detectados en un competidor (optimizado para tokens)
   */
  /**
   * Analiza los cambios detectados en un competidor (optimizado para tokens)
  async analyzeChanges(changeData) {
    if (!this.genAI) {
      throw new Error('Google AI no está configurado')
    }

    // 🛑 SAFETY CHECK: Si no hubo cambios en secciones específicas (ruido técnico), cortar alucinaciones.
    if (changeData.sections && changeData.sections.length === 0) {
      logger.info('Skipping deep AI analysis for technical noise (0 sections changed)')
      return {
        resumen: "Mantenimiento Técnico / Ruido",
        impacto: ["Cambios en código interno sin impacto estratégico visible", "Posible limpieza de scripts o atributos dinámicos"],
        recomendaciones: ["Ignorar esta alerta si el sitio se ve igual", "Verificar manualmente si persiste"],
        urgencia: "Bajo",
        insights: "El sistema detectó cambios menores en el código HTML (atributos, espaciado) pero ninguna sección de contenido principal fue afectada."
      }
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
Eres un Consultor Senior de Estrategia Digital. Tu cliente compite contra esta empresa.
Se han detectado cambios en su sitio web. Tu trabajo NO es describir el cambio técnico, sino DESCUBRIR LA ESTRATEGIA detrás del cambio.

**Contexto del Cambio:**
- Competidor: ${changeData.competitorName}
- URL: ${changeData.url}
- Tipo de Cambio Detectado: ${changeData.changeType || 'general'}
- Severidad Técnica: ${changeData.severity || 'medium'}

**Detalles Técnicos (INPUT):**
${changesInfo}
${sectionsInfo}
${htmlContextInfo}

**TU ANÁLISIS (OUTPUT):**
Analiza estos datos técnicos y tradúcelos a lenguaje de negocios.
IMPORTANTE: Sé ESCÉPTICO. Si los cambios son solo códigos, IDs, URLs de imágenes (ej: 'apple-touch-icon'), o ajustes menores de estilo, NO INVENTES una estrategia. Simplemente repórtalo como "Mantenimiento Técnico".
Solo reporta "Estrategia" si ves cambios en: TEXTO, PRECIOS, OFERTAS o ESTRUCTURA VISIBLE.

- Si cambiaron precios -> ¿Están iniciando una guerra de precios? ¿Subieron mercado?
- Si cambiaron el Hero -> ¿Han cambiado su Propuesta de Valor? ¿A qué nuevo segmento apuntan?
- Si añadieron Features -> ¿Están cerrando una brecha de producto?
- Si cambiaron botones/CTAs -> ¿Están optimizando conversión agresivamente?
- Si solo son hashes/iconos -> "Mantenimiento/Optimización técnica menor".

Responde en formato JSON estrictamente:
{
  "resumen": "Titular de impacto. (ej: 'Pivote estratégico hacia clientes Enterprise', 'Aumento de precios encubierto', 'Rediseño total de marca').",
  "impacto": [
    "Consecuencia directa 1 (ej: Su nueva oferta deja la nuestra obsoleta en precio)",
    "Consecuencia directa 2 (ej: Están atacando nuestro nicho principal)"
  ],
  "recomendaciones": [
    "Contramedida inmediata 1",
    "Contramedida a mediano plazo 2"
  ],
  "urgencia": "Alto/Medio/Bajo",
  "insights": "Deducción profunda (ej: 'Este cambio sugiere que están perdiendo clientes pequeños y buscan subir el ticket promedio')"
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

