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
   */
  findSemanticParent(change, $) {
    // Elementos semánticos que queremos identificar
    const semanticTags = [
      'header', 'nav', 'main', 'section', 'article', 'aside', 'footer',
      'div[class*="hero"]', 'div[class*="banner"]', 'div[class*="pricing"]',
      'div[class*="feature"]', 'div[class*="testimonial"]', 'div[class*="cta"]',
      'div[id*="hero"]', 'div[id*="pricing"]', 'div[id*="features"]'
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

    // Si no se encuentra, buscar por el valor del cambio
    if (change.value) {
      const text = typeof change.value === 'string' ? change.value : JSON.stringify(change.value)
      const element = $(`*:contains("${text.substring(0, 50)}")`).first()
      
      if (element.length > 0) {
        for (const tag of semanticTags) {
          const parent = element.closest(tag)
          if (parent.length > 0) {
            return this.generateSelector(parent)
          }
        }
      }
    }

    return null
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

    // Extraer información relevante
    const context = {
      selector: section.selector,
      sectionType: this.identifySectionType(section.selector),
      changeType: section.changeType,
      
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

    return context
  }

  /**
   * Identifica el tipo de sección basado en el selector
   */
  identifySectionType(selector) {
    const lowerSelector = selector.toLowerCase()
    
    if (lowerSelector.includes('hero') || lowerSelector.includes('banner')) return 'hero'
    if (lowerSelector.includes('pricing') || lowerSelector.includes('price')) return 'pricing'
    if (lowerSelector.includes('feature')) return 'features'
    if (lowerSelector.includes('testimonial') || lowerSelector.includes('review')) return 'testimonials'
    if (lowerSelector.includes('cta') || lowerSelector.includes('call-to-action')) return 'cta'
    if (lowerSelector.includes('nav')) return 'navigation'
    if (lowerSelector.includes('header')) return 'header'
    if (lowerSelector.includes('footer')) return 'footer'
    if (lowerSelector.includes('form')) return 'form'
    
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

    return `Se detectaron cambios en ${sections.length} sección(es): ${uniqueTypes.join(', ')}`
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

