/**
 * Servicio para generar mensajes inteligentes de alertas
 * Analiza los cambios detectados y genera descripciones más descriptivas
 */

const logger = require('../utils/logger')

class SmartMessageGenerator {
  constructor() {
    this.changePatterns = {
      // Patrones para precios
      pricing: {
        regex: [
          /\$(\d+(?:\.\d{2})?)\/month/gi,
          /\$(\d+(?:\.\d{2})?)\/year/gi,
          /€(\d+(?:\.\d{2})?)\/month/gi,
          /€(\d+(?:\.\d{2})?)\/year/gi,
          /price[:\s]*\$?(\d+(?:\.\d{2})?)/gi,
          /cost[:\s]*\$?(\d+(?:\.\d{2})?)/gi,
          /(\d+(?:\.\d{2})?)\s*(?:USD|EUR|dollars?|euros?)/gi
        ],
        keywords: ['price', 'pricing', 'cost', 'plan', 'tier', 'subscription', 'monthly', 'yearly'],
        templates: {
          new_tier: 'Nuevo plan "{tierName}" agregado a ${price}/mes',
          price_change: 'Precio del plan "{planName}" cambiado de ${oldPrice} a ${newPrice}',
          new_pricing: 'Nueva estructura de precios detectada'
        }
      },

      // Patrones para productos/features
      features: {
        regex: [
          /new\s+(?:feature|product|service)/gi,
          /introducing\s+(.+?)(?:\n|$)/gi,
          /now\s+available[:\s]*(.+?)(?:\n|$)/gi,
          /launch(?:ing)?\s+(.+?)(?:\n|$)/gi
        ],
        keywords: ['feature', 'product', 'service', 'tool', 'dashboard', 'analytics', 'api', 'integration'],
        templates: {
          new_feature: 'Nueva funcionalidad: "{featureName}"',
          new_product: 'Nuevo producto: "{productName}"',
          feature_update: 'Funcionalidad "{featureName}" actualizada'
        }
      },

      // Patrones para navegación
      navigation: {
        regex: [
          /<nav[^>]*>[\s\S]*?<\/nav>/gi,
          /<menu[^>]*>[\s\S]*?<\/menu>/gi,
          /<ul[^>]*class[^>]*nav[^>]*>[\s\S]*?<\/ul>/gi
        ],
        keywords: ['nav', 'menu', 'navigation', 'header', 'footer', 'sidebar'],
        templates: {
          nav_change: 'Navegación actualizada',
          new_menu: 'Nuevo elemento de menú agregado',
          nav_restructure: 'Reestructuración de navegación'
        }
      },

      // Patrones para contenido
      content: {
        regex: [
          /<h[1-6][^>]*>(.+?)<\/h[1-6]>/gi,
          /<p[^>]*>(.+?)<\/p>/gi,
          /<div[^>]*class[^>]*content[^>]*>[\s\S]*?<\/div>/gi
        ],
        keywords: ['content', 'text', 'article', 'blog', 'post', 'description', 'about'],
        templates: {
          content_update: 'Contenido de la página actualizado',
          new_section: 'Nueva sección: "{sectionName}"',
          text_change: 'Texto modificado en "{sectionName}"'
        }
      }
    }

    this.severityThresholds = {
      low: { changePercentage: 5, changeCount: 2 },
      medium: { changePercentage: 10, changeCount: 5 },
      high: { changePercentage: 20, changeCount: 10 },
      critical: { changePercentage: 30, changeCount: 20 }
    }
  }

  /**
   * Generar mensaje inteligente basado en los cambios detectados
   */
  generateSmartMessage({
    competitorName,
    changeCount,
    changePercentage,
    severity,
    previousHtml,
    currentHtml,
    changeSummary,
    affectedSections = []
  }) {
    try {
      // Si no hay HTML, usar mensaje genérico
      if (!previousHtml || !currentHtml) {
        return this.generateGenericMessage(competitorName, changeCount, changePercentage, severity, affectedSections)
      }

      // 1. Analizar el tipo de cambios
      const changeAnalysis = this.analyzeChanges(previousHtml, currentHtml)
      
      // 2. Determinar el tipo principal de cambio
      const primaryChangeType = this.determinePrimaryChangeType(changeAnalysis)
      
      // 3. Generar mensaje específico
      const specificMessage = this.generateSpecificMessage(primaryChangeType, changeAnalysis, competitorName)
      
      // 4. Si no se puede generar mensaje específico, usar mensaje genérico mejorado
      if (!specificMessage) {
        return this.generateGenericMessage(competitorName, changeCount, changePercentage, severity, affectedSections)
      }

      return specificMessage
    } catch (error) {
      logger.error('Error generando mensaje inteligente:', error)
      return this.generateGenericMessage(competitorName, changeCount, changePercentage, severity, affectedSections)
    }
  }

  /**
   * Analizar los cambios entre dos versiones de HTML
   */
  analyzeChanges(previousHtml, currentHtml) {
    if (!previousHtml || !currentHtml) {
      return { type: 'unknown', details: {} }
    }

    const analysis = {
      pricing: this.analyzePricingChanges(previousHtml, currentHtml),
      features: this.analyzeFeatureChanges(previousHtml, currentHtml),
      navigation: this.analyzeNavigationChanges(previousHtml, currentHtml),
      content: this.analyzeContentChanges(previousHtml, currentHtml)
    }

    return analysis
  }

  /**
   * Analizar cambios en precios
   */
  analyzePricingChanges(previousHtml, currentHtml) {
    const prevPrices = this.extractPrices(previousHtml)
    const currPrices = this.extractPrices(currentHtml)
    
    const changes = {
      newPrices: currPrices.filter(price => !prevPrices.includes(price)),
      removedPrices: prevPrices.filter(price => !currPrices.includes(price)),
      modifiedPrices: this.findModifiedPrices(prevPrices, currPrices)
    }

    return {
      hasChanges: changes.newPrices.length > 0 || changes.removedPrices.length > 0 || changes.modifiedPrices.length > 0,
      changes,
      confidence: this.calculateConfidence(changes, 'pricing')
    }
  }

  /**
   * Analizar cambios en funcionalidades
   */
  analyzeFeatureChanges(previousHtml, currentHtml) {
    const prevFeatures = this.extractFeatures(previousHtml)
    const currFeatures = this.extractFeatures(currentHtml)
    
    const changes = {
      newFeatures: currFeatures.filter(feature => !prevFeatures.includes(feature)),
      removedFeatures: prevFeatures.filter(feature => !currFeatures.includes(feature))
    }

    return {
      hasChanges: changes.newFeatures.length > 0 || changes.removedFeatures.length > 0,
      changes,
      confidence: this.calculateConfidence(changes, 'features')
    }
  }

  /**
   * Analizar cambios en navegación
   */
  analyzeNavigationChanges(previousHtml, currentHtml) {
    const prevNav = this.extractNavigation(previousHtml)
    const currNav = this.extractNavigation(currentHtml)
    
    const changes = {
      structureChanged: prevNav.structure !== currNav.structure,
      newItems: currNav.items.filter(item => !prevNav.items.includes(item)),
      removedItems: prevNav.items.filter(item => !currNav.items.includes(item))
    }

    return {
      hasChanges: changes.structureChanged || changes.newItems.length > 0 || changes.removedItems.length > 0,
      changes,
      confidence: this.calculateConfidence(changes, 'navigation')
    }
  }

  /**
   * Analizar cambios en contenido
   */
  analyzeContentChanges(previousHtml, currentHtml) {
    const prevContent = this.extractContent(previousHtml)
    const currContent = this.extractContent(currentHtml)
    
    const changes = {
      newSections: currContent.sections.filter(section => !prevContent.sections.includes(section)),
      removedSections: prevContent.sections.filter(section => !currContent.sections.includes(section)),
      modifiedText: this.findModifiedText(prevContent.text, currContent.text)
    }

    return {
      hasChanges: changes.newSections.length > 0 || changes.removedSections.length > 0 || changes.modifiedText.length > 0,
      changes,
      confidence: this.calculateConfidence(changes, 'content')
    }
  }

  /**
   * Extraer precios del HTML
   */
  extractPrices(html) {
    const prices = []
    this.changePatterns.pricing.regex.forEach(regex => {
      let match
      while ((match = regex.exec(html)) !== null) {
        prices.push(match[1])
      }
    })
    return [...new Set(prices)] // Eliminar duplicados
  }

  /**
   * Extraer funcionalidades del HTML
   */
  extractFeatures(html) {
    const features = []
    this.changePatterns.features.regex.forEach(regex => {
      let match
      while ((match = regex.exec(html)) !== null) {
        features.push(match[1]?.trim())
      }
    })
    return [...new Set(features.filter(Boolean))]
  }

  /**
   * Extraer navegación del HTML
   */
  extractNavigation(html) {
    const navMatches = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/gi) || []
    const menuMatches = html.match(/<ul[^>]*class[^>]*nav[^>]*>[\s\S]*?<\/ul>/gi) || []
    
    const allNav = [...navMatches, ...menuMatches].join(' ')
    const items = (allNav.match(/<a[^>]*>(.*?)<\/a>/gi) || [])
      .map(link => link.replace(/<[^>]*>/g, '').trim())
      .filter(item => item.length > 0)

    return {
      structure: allNav,
      items: [...new Set(items)]
    }
  }

  /**
   * Extraer contenido del HTML
   */
  extractContent(html) {
    const sections = (html.match(/<h[1-6][^>]*>(.+?)<\/h[1-6]>/gi) || [])
      .map(heading => heading.replace(/<[^>]*>/g, '').trim())
    
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    return {
      sections: [...new Set(sections)],
      text
    }
  }

  /**
   * Encontrar precios modificados
   */
  findModifiedPrices(prevPrices, currPrices) {
    // Lógica simple: si hay cambios en precios pero no son completamente nuevos/eliminados
    const modified = []
    const commonPrices = prevPrices.filter(price => currPrices.includes(price))
    
    if (commonPrices.length > 0 && prevPrices.length !== currPrices.length) {
      modified.push('Precios modificados detectados')
    }

    return modified
  }

  /**
   * Encontrar texto modificado
   */
  findModifiedText(prevText, currText) {
    if (!prevText || !currText) return []
    
    const prevWords = prevText.split(' ')
    const currWords = currText.split(' ')
    
    if (Math.abs(prevWords.length - currWords.length) > 10) {
      return ['Contenido de texto significativamente modificado']
    }

    return []
  }

  /**
   * Calcular confianza en el análisis
   */
  calculateConfidence(changes, type) {
    let confidence = 0
    
    if (changes.newPrices?.length > 0) confidence += 0.8
    if (changes.newFeatures?.length > 0) confidence += 0.7
    if (changes.newItems?.length > 0) confidence += 0.6
    if (changes.newSections?.length > 0) confidence += 0.5

    return Math.min(confidence, 1.0)
  }

  /**
   * Determinar el tipo principal de cambio
   */
  determinePrimaryChangeType(analysis) {
    const types = Object.keys(analysis)
    let bestType = 'content'
    let bestConfidence = 0

    types.forEach(type => {
      if (analysis[type].hasChanges && analysis[type].confidence > bestConfidence) {
        bestType = type
        bestConfidence = analysis[type].confidence
      }
    })

    return bestType
  }

  /**
   * Generar mensaje específico basado en el tipo de cambio
   */
  generateSpecificMessage(changeType, analysis, competitorName) {
    const changeData = analysis[changeType]
    
    if (!changeData.hasChanges) return null

    switch (changeType) {
      case 'pricing':
        return this.generatePricingMessage(changeData, competitorName)
      case 'features':
        return this.generateFeatureMessage(changeData, competitorName)
      case 'navigation':
        return this.generateNavigationMessage(changeData, competitorName)
      case 'content':
        return this.generateContentMessage(changeData, competitorName)
      default:
        return null
    }
  }

  /**
   * Generar mensaje para cambios de precios
   */
  generatePricingMessage(changeData, competitorName) {
    const { changes } = changeData

    if (changes.newPrices.length > 0) {
      const newPrice = changes.newPrices[0]
      return `Nuevo plan detectado en ${competitorName} a $${newPrice}/mes`
    }

    if (changes.modifiedPrices.length > 0) {
      return `Estructura de precios modificada en ${competitorName}`
    }

    if (changes.removedPrices.length > 0) {
      return `Plan de precios eliminado en ${competitorName}`
    }

    return `Cambios en precios detectados en ${competitorName}`
  }

  /**
   * Generar mensaje para cambios de funcionalidades
   */
  generateFeatureMessage(changeData, competitorName) {
    const { changes } = changeData

    if (changes.newFeatures.length > 0) {
      const newFeature = changes.newFeatures[0]
      return `Nueva funcionalidad en ${competitorName}: ${newFeature}`
    }

    if (changes.removedFeatures.length > 0) {
      return `Funcionalidad eliminada en ${competitorName}`
    }

    return `Cambios en funcionalidades detectados en ${competitorName}`
  }

  /**
   * Generar mensaje para cambios de navegación
   */
  generateNavigationMessage(changeData, competitorName) {
    const { changes } = changeData

    if (changes.newItems.length > 0) {
      return `Nuevo elemento de navegación en ${competitorName}: ${changes.newItems[0]}`
    }

    if (changes.structureChanged) {
      return `Navegación reestructurada en ${competitorName}`
    }

    return `Cambios en navegación detectados en ${competitorName}`
  }

  /**
   * Generar mensaje para cambios de contenido
   */
  generateContentMessage(changeData, competitorName) {
    const { changes } = changeData

    if (changes.newSections.length > 0) {
      return `Nueva sección en ${competitorName}: ${changes.newSections[0]}`
    }

    if (changes.modifiedText.length > 0) {
      return `Contenido actualizado en ${competitorName}`
    }

    return `Cambios en contenido detectados en ${competitorName}`
  }

  /**
   * Generar mensaje genérico mejorado
   */
  generateGenericMessage(competitorName, changeCount, changePercentage, severity, affectedSections) {
    const severityText = this.getSeverityText(severity)
    const sectionText = affectedSections.length > 0 ? ` en ${affectedSections.join(', ')}` : ''
    
    let message = `${changeCount} cambio${changeCount > 1 ? 's' : ''} detectado${changeCount > 1 ? 's' : ''} en ${competitorName}${sectionText}`
    
    if (changePercentage > 0) {
      message += ` (${changePercentage.toFixed(1)}% del contenido)`
    }
    
    message += `. Severidad: ${severityText}`

    return message
  }

  /**
   * Obtener texto de severidad
   */
  getSeverityText(severity) {
    const severityMap = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      critical: 'Crítica'
    }
    return severityMap[severity] || 'Desconocida'
  }
}

const smartMessageGenerator = new SmartMessageGenerator()
module.exports = smartMessageGenerator
