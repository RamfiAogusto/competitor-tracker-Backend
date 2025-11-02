const cheerio = require('cheerio')
const logger = require('../utils/logger')

/**
 * Servicio para extraer secciones específicas del HTML donde ocurrieron cambios
 */
class SectionExtractor {
  /**
   * Identifica y extrae la sección específica donde ocurrió un cambio
   * @param {string} htmlBefore - HTML antes del cambio
   * @param {string} htmlAfter - HTML después del cambio
   * @param {Array} diffChanges - Array de cambios del diff
   * @returns {Object} - Sección extraída con contexto
   */
  extractChangedSection(htmlBefore, htmlAfter, diffChanges) {
    try {
      const $before = cheerio.load(htmlBefore)
      const $after = cheerio.load(htmlAfter)
      
      // Analizar los cambios para identificar las secciones afectadas
      const changedSections = this.identifyChangedSections(diffChanges, $before, $after)
      
      // Extraer el contexto relevante de cada sección
      const extractedSections = changedSections.map(section => {
        return this.extractSectionContext(section, $before, $after)
      })
      
      return {
        sections: extractedSections,
        totalChanges: diffChanges.length,
        summary: this.generateSectionSummary(extractedSections)
      }
    } catch (error) {
      logger.error('Error al extraer sección cambiada:', error)
      return {
        sections: [],
        totalChanges: diffChanges.length,
        summary: 'No se pudo extraer la sección específica',
        error: error.message
      }
    }
  }

  /**
   * Identifica las secciones del HTML que fueron modificadas
   */
  identifyChangedSections(diffChanges, $before, $after) {
    const sections = []
    const seenSelectors = new Set()

    diffChanges.forEach(change => {
      // Intentar identificar el elemento padre más cercano con significado semántico
      const selector = this.findSemanticParent(change, $after)
      
      if (selector && !seenSelectors.has(selector)) {
        seenSelectors.add(selector)
        sections.push({
          selector,
          changeType: change.type || 'modified',
          value: change.value,
          path: change.path
        })
      }
    })

    return sections
  }

  /**
   * Encuentra el elemento padre semántico más cercano
   * Usa múltiples estrategias de detección en cascada
   */
  findSemanticParent(change, $) {
    // ESTRATEGIA 1: IDs y clases explícitas (más confiable)
    const explicitSelectors = [
      '#hero', '#pricing', '#features', '#testimonials', '#reviews',
      '.hero-section', '.pricing-section', '.features-section', 
      '.testimonials-section', '.reviews-section',
      '[data-section="hero"]', '[data-section="pricing"]', '[data-section="features"]'
    ]

    for (const selector of explicitSelectors) {
      const element = $(selector)
      if (element.length > 0 && this.containsChange(element, change)) {
        return this.generateSelector(element)
      }
    }

    // ESTRATEGIA 2: Elementos semánticos HTML5 + clases comunes
    const semanticTags = [
      'header', 'nav', 'main', 'section', 'article', 'aside', 'footer',
      'div[class*="hero"]', 'div[class*="banner"]', 'div[class*="pricing"]',
      'div[class*="price"]', 'div[class*="plan"]', 'div[class*="feature"]', 
      'div[class*="testimonial"]', 'div[class*="review"]', 'div[class*="cta"]',
      'div[id*="hero"]', 'div[id*="pricing"]', 'div[id*="features"]',
      'section[class*="hero"]', 'section[class*="pricing"]', 'section[class*="features"]'
    ]

    // Si el cambio tiene un path, intentar usarlo
    if (change.path) {
      for (const tag of semanticTags) {
        const element = $(change.path).closest(tag)
        if (element.length > 0) {
          return this.generateSelector(element)
        }
      }
    }

    // ESTRATEGIA 3: Buscar por headers (h1-h3) con palabras clave
    if (change.value) {
      const headerResult = this.findByHeaderKeywords($, change)
      if (headerResult) return headerResult
    }

    // ESTRATEGIA 4: Buscar por el valor del cambio en el contenido
    if (change.value) {
      const text = typeof change.value === 'string' ? change.value : JSON.stringify(change.value)
      // Escapar caracteres especiales para el selector
      const escapedText = text.substring(0, 50).replace(/['"\\]/g, '')
      
      try {
        const element = $(`*:contains("${escapedText}")`).first()
        
        if (element.length > 0) {
          for (const tag of semanticTags) {
            const parent = element.closest(tag)
            if (parent.length > 0) {
              return this.generateSelector(parent)
            }
          }
          
          // Si no encontramos un padre semántico, buscar el contenedor más cercano
          const container = element.closest('div, section, article')
          if (container.length > 0) {
            return this.generateSelector(container)
          }
        }
      } catch (error) {
        logger.debug('Error buscando por contenido:', error.message)
      }
    }

    // ESTRATEGIA 5: Análisis de estructura DOM (buscar contenedores con múltiples elementos similares)
    const structuralResult = this.findByStructure($, change)
    if (structuralResult) return structuralResult

    return null
  }

  /**
   * ESTRATEGIA 3: Buscar sección por headers con palabras clave
   */
  findByHeaderKeywords($, change) {
    const keywords = {
      pricing: ['pricing', 'precios', 'planes', 'plans', 'suscripción', 'subscription', 'paquetes', 'tarifas'],
      features: ['features', 'características', 'funcionalidades', 'beneficios', 'ventajas'],
      testimonials: ['testimonials', 'testimonios', 'reviews', 'reseñas', 'opiniones', 'clientes'],
      hero: ['hero', 'inicio', 'bienvenida', 'welcome'],
      cta: ['cta', 'call to action', 'comenzar', 'empezar', 'registrarse', 'sign up', 'get started']
    }

    const headers = $('h1, h2, h3, h4')
    
    for (let i = 0; i < headers.length; i++) {
      const header = $(headers[i])
      const headerText = header.text().toLowerCase()
      
      // Verificar si el header contiene alguna palabra clave
      for (const [sectionType, keywordList] of Object.entries(keywords)) {
        if (keywordList.some(keyword => headerText.includes(keyword))) {
          // Encontrar la sección padre
          const section = header.closest('section, div[class*="section"], article, main')
          
          if (section.length > 0 && this.containsChange(section, change)) {
            logger.debug(`Sección encontrada por header: ${sectionType}`)
            return this.generateSelector(section)
          }
        }
      }
    }

    return null
  }

  /**
   * ESTRATEGIA 5: Buscar por estructura DOM (contenedores con elementos repetidos)
   */
  findByStructure($, change) {
    // Buscar contenedores con múltiples elementos similares (típico de pricing, features, testimonials)
    const containers = $('div, section, article')
    
    for (let i = 0; i < containers.length; i++) {
      const container = $(containers[i])
      const children = container.children()
      
      // Si tiene 2-6 hijos directos similares, probablemente es una sección de cards/planes
      if (children.length >= 2 && children.length <= 6) {
        const firstChildClass = $(children[0]).attr('class')
        
        if (firstChildClass) {
          // Contar cuántos hijos tienen la misma clase
          const similarChildren = children.filter((idx, child) => {
            return $(child).attr('class') === firstChildClass
          }).length
          
          // Si al menos el 50% son similares y contiene el cambio
          if (similarChildren >= children.length * 0.5 && this.containsChange(container, change)) {
            logger.debug('Sección encontrada por estructura DOM')
            return this.generateSelector(container)
          }
        }
      }
    }

    return null
  }

  /**
   * Verifica si un elemento contiene el cambio
   */
  containsChange(element, change) {
    if (!change.value) return true
    
    const text = typeof change.value === 'string' ? change.value : JSON.stringify(change.value)
    const elementText = element.text()
    
    return elementText.includes(text.substring(0, 50))
  }

  /**
   * Genera un selector CSS único para un elemento
   */
  generateSelector(element) {
    const tag = element.prop('tagName')?.toLowerCase()
    const id = element.attr('id')
    const classes = element.attr('class')

    if (id) {
      return `${tag}#${id}`
    }

    if (classes) {
      const classList = classes.split(' ').filter(c => c.trim()).slice(0, 2)
      return `${tag}.${classList.join('.')}`
    }

    return tag
  }

  /**
   * Extrae el contexto de una sección específica
   */
  extractSectionContext(section, $before, $after) {
    const elementBefore = $before(section.selector).first()
    const elementAfter = $after(section.selector).first()

    // Usar el elemento 'after' para identificar el tipo (es el más actual)
    const elementForType = elementAfter.length > 0 ? elementAfter : elementBefore
    
    // Identificar tipo de sección
    const sectionType = this.identifySectionType(section.selector, elementForType)
    
    // Calcular score de confianza
    const confidence = this.calculateConfidenceScore(section.selector, sectionType, elementForType)

    // Extraer información relevante
    const context = {
      selector: section.selector,
      sectionType: sectionType,
      changeType: section.changeType,
      confidence: confidence, // Agregar score de confianza
      
      before: {
        exists: elementBefore.length > 0,
        text: this.extractRelevantText(elementBefore),
        html: this.extractCleanHTML(elementBefore),
        attributes: this.extractRelevantAttributes(elementBefore)
      },
      
      after: {
        exists: elementAfter.length > 0,
        text: this.extractRelevantText(elementAfter),
        html: this.extractCleanHTML(elementAfter),
        attributes: this.extractRelevantAttributes(elementAfter)
      }
    }

    // Calcular el cambio específico
    context.changes = this.calculateSpecificChanges(context.before, context.after)
    
    // Log de detección
    logger.debug(`🎯 Sección detectada: ${sectionType} (confianza: ${(confidence * 100).toFixed(0)}%)`, {
      selector: section.selector,
      changes: context.changes.length
    })

    return context
  }

  /**
   * Identifica el tipo de sección basado en el selector y contenido
   * Usa patrones múltiples para mayor precisión
   */
  identifySectionType(selector, element = null) {
    const lowerSelector = selector.toLowerCase()
    
    // Patrones por tipo de sección (ordenados por especificidad)
    const patterns = {
      hero: ['hero', 'banner', 'jumbotron', 'splash', 'intro-section'],
      pricing: ['pricing', 'price', 'plan', 'subscription', 'tarifa', 'paquete'],
      features: ['feature', 'benefit', 'characteristic', 'funcionalidad', 'ventaja'],
      testimonials: ['testimonial', 'review', 'opinion', 'testimonio', 'reseña'],
      cta: ['cta', 'call-to-action', 'signup', 'register', 'get-started', 'comenzar'],
      navigation: ['nav', 'menu', 'navbar'],
      header: ['header', 'top-bar', 'site-header'],
      footer: ['footer', 'site-footer', 'bottom'],
      form: ['form', 'contact', 'subscribe', 'newsletter'],
      about: ['about', 'about-us', 'quienes-somos', 'nosotros'],
      team: ['team', 'equipo', 'staff', 'people'],
      gallery: ['gallery', 'galeria', 'portfolio'],
      blog: ['blog', 'news', 'noticias', 'articles'],
      faq: ['faq', 'preguntas', 'questions', 'ayuda']
    }
    
    // Verificar cada patrón
    for (const [type, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => lowerSelector.includes(keyword))) {
        return type
      }
    }
    
    // Si tenemos el elemento, analizar su contenido para mejor clasificación
    if (element && element.length > 0) {
      const text = element.text().toLowerCase()
      const html = element.html()?.toLowerCase() || ''
      
      // Detectar pricing por símbolos de moneda
      if (/[\$€£¥]/.test(text) || /price|precio|cost|costo/i.test(text)) {
        return 'pricing'
      }
      
      // Detectar forms por inputs
      if (html.includes('<input') || html.includes('<form')) {
        return 'form'
      }
      
      // Detectar testimonials por comillas o ratings
      if (/".*"|'.*'/.test(text) || /★|⭐|rating|stars/i.test(html)) {
        return 'testimonials'
      }
      
      // Detectar CTA por botones con texto específico
      if (/sign up|get started|try|demo|comenzar|empezar|probar/i.test(text)) {
        return 'cta'
      }
    }
    
    return 'content'
  }

  /**
   * Extrae texto relevante de un elemento (limitado para tokens)
   */
  extractRelevantText(element) {
    if (!element || element.length === 0) return ''

    // Extraer texto pero limitar a 500 caracteres
    const text = element.text().trim().replace(/\s+/g, ' ')
    return text.length > 500 ? text.substring(0, 500) + '...' : text
  }

  /**
   * Extrae HTML limpio y compacto
   */
  extractCleanHTML(element) {
    if (!element || element.length === 0) return ''

    // Clonar el elemento y limpiar scripts, estilos, etc.
    const clone = element.clone()
    clone.find('script, style, noscript').remove()
    
    // Obtener HTML y limpiarlo
    let html = clone.html() || ''
    html = html.replace(/\s+/g, ' ').trim()
    
    // Limitar a 1000 caracteres para no exceder tokens
    return html.length > 1000 ? html.substring(0, 1000) + '...' : html
  }

  /**
   * Extrae atributos relevantes
   */
  extractRelevantAttributes(element) {
    if (!element || element.length === 0) return {}

    const attrs = {}
    const relevantAttrs = ['class', 'id', 'data-price', 'data-value', 'href', 'src', 'alt', 'title']

    relevantAttrs.forEach(attr => {
      const value = element.attr(attr)
      if (value) {
        attrs[attr] = value
      }
    })

    return attrs
  }

  /**
   * Calcula los cambios específicos entre before y after
   */
  calculateSpecificChanges(before, after) {
    const changes = []

    // Cambio de texto
    if (before.text !== after.text) {
      changes.push({
        type: 'text',
        before: before.text,
        after: after.text
      })
    }

    // Cambio de atributos
    const allAttrs = new Set([
      ...Object.keys(before.attributes),
      ...Object.keys(after.attributes)
    ])

    allAttrs.forEach(attr => {
      if (before.attributes[attr] !== after.attributes[attr]) {
        changes.push({
          type: 'attribute',
          attribute: attr,
          before: before.attributes[attr],
          after: after.attributes[attr]
        })
      }
    })

    // Cambio de existencia
    if (before.exists !== after.exists) {
      changes.push({
        type: before.exists ? 'removed' : 'added',
        description: before.exists ? 'Elemento eliminado' : 'Elemento agregado'
      })
    }

    return changes
  }

  /**
   * Genera un resumen de las secciones extraídas
   */
  generateSectionSummary(sections) {
    if (sections.length === 0) return 'No se detectaron secciones específicas'

    const sectionTypes = sections.map(s => s.sectionType)
    const uniqueTypes = [...new Set(sectionTypes)]
    
    // Contar secciones por tipo
    const typeCounts = {}
    sectionTypes.forEach(type => {
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })
    
    // Crear resumen detallado
    const details = Object.entries(typeCounts)
      .map(([type, count]) => count > 1 ? `${type} (${count})` : type)
      .join(', ')

    logger.info(`📊 Resumen de secciones: ${details}`)

    return `Se detectaron cambios en ${sections.length} sección(es): ${details}`
  }

  /**
   * Calcula un score de confianza para la detección de una sección
   */
  calculateConfidenceScore(selector, sectionType, element) {
    let score = 0.5 // Base score
    
    const lowerSelector = selector.toLowerCase()
    
    // +0.3 si el selector tiene ID específico
    if (lowerSelector.includes(`#${sectionType}`)) {
      score += 0.3
    }
    
    // +0.2 si el selector tiene clase específica
    if (lowerSelector.includes(`.${sectionType}`) || lowerSelector.includes(`-${sectionType}`)) {
      score += 0.2
    }
    
    // +0.1 si es un elemento semántico HTML5
    if (['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'].some(tag => 
      lowerSelector.startsWith(tag)
    )) {
      score += 0.1
    }
    
    // Análisis de contenido si tenemos el elemento
    if (element && element.length > 0) {
      const text = element.text().toLowerCase()
      const html = element.html()?.toLowerCase() || ''
      
      // Verificaciones específicas por tipo
      if (sectionType === 'pricing' && /[\$€£¥]/.test(text)) {
        score += 0.15
      }
      
      if (sectionType === 'testimonials' && (/".*"|'.*'/.test(text) || /★|⭐/.test(html))) {
        score += 0.15
      }
      
      if (sectionType === 'form' && (html.includes('<input') || html.includes('<form'))) {
        score += 0.15
      }
    }
    
    return Math.min(score, 1.0) // Cap at 1.0
  }

  /**
   * Prepara los datos para enviar a la IA (optimizado para tokens)
   */
  prepareForAI(extractedData) {
    const aiPayload = {
      totalChanges: extractedData.totalChanges,
      summary: extractedData.summary,
      sections: extractedData.sections.map(section => ({
        type: section.sectionType,
        selector: section.selector,
        changeType: section.changeType,
        changes: section.changes.map(change => ({
          type: change.type,
          before: this.truncateForAI(change.before),
          after: this.truncateForAI(change.after),
          attribute: change.attribute,
          description: change.description
        }))
      }))
    }

    // Calcular tokens aproximados (1 token ≈ 4 caracteres)
    const jsonString = JSON.stringify(aiPayload)
    const estimatedTokens = Math.ceil(jsonString.length / 4)

    logger.info('Datos preparados para IA', {
      sections: aiPayload.sections.length,
      estimatedTokens,
      size: `${(jsonString.length / 1024).toFixed(2)} KB`
    })

    return {
      data: aiPayload,
      estimatedTokens,
      size: jsonString.length
    }
  }

  /**
   * Trunca texto para la IA manteniendo lo más relevante
   */
  truncateForAI(text) {
    if (!text || typeof text !== 'string') return text
    
    // Limitar a 200 caracteres para la IA
    if (text.length > 200) {
      return text.substring(0, 200) + '...'
    }
    
    return text
  }
}

module.exports = new SectionExtractor()

