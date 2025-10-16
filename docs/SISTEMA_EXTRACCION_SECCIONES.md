# 🎯 Sistema de Extracción de Secciones - Documentación Técnica

> **Propósito**: Sistema para identificar, aislar y procesar secciones específicas de sitios web competidores, permitiendo análisis y herramientas especializadas por tipo de sección.

---

## 📋 Índice

1. [Arquitectura General](#arquitectura-general)
2. [Identificación de Secciones](#identificación-de-secciones)
3. [Procesamiento por Sección](#procesamiento-por-sección)
4. [Herramientas Especializadas](#herramientas-especializadas)
5. [Estructura de Datos](#estructura-de-datos)
6. [Implementación Técnica](#implementación-técnica)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)

---

## 🏗️ Arquitectura General

### Flujo del Sistema

```
📄 HTML COMPLETO DEL COMPETIDOR
         ↓
┌────────────────────────────────────────┐
│ PASO 1: IDENTIFICADOR DE SECCIONES    │
│ - Usa selectores CSS múltiples         │
│ - Detecta 9 tipos de secciones        │
│ - Aísla el HTML de cada sección       │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ PASO 2: EXTRACTOR ESPECIALIZADO       │
│ - Procesa SOLO el HTML de esa sección │
│ - Usa selectores + regex específicos  │
│ - Estructura los datos extraídos      │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ PASO 3: ANÁLISIS CON IA (Opcional)    │
│ - Reviews → Detecta quejas            │
│ - Pricing → Evalúa competitividad     │
│ - Features → Compara con los tuyos    │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ PASO 4: HERRAMIENTAS POR SECCIÓN      │
│ - Pricing → Alertas de cambio precio  │
│ - Reviews → Dashboard de oportunidades │
│ - Features → Gap analysis             │
└────────────────────────────────────────┘
         ↓
📊 DASHBOARD CON TABS POR SECCIÓN
```

---

## 🔍 Identificación de Secciones

### ⚠️ El Problema Real

**La mayoría de sitios web NO tienen IDs claros como `#pricing`**. Entonces, ¿cómo encontramos las secciones?

### 🎯 Estrategia de Detección Multi-Nivel

El sistema usa **5 estrategias** en orden de prioridad:

```javascript
ESTRATEGIA 1: IDs y clases explícitas (ideal pero raro)
  ↓ Si falla...
ESTRATEGIA 2: Búsqueda por headers (h2/h3 con palabras clave)
  ↓ Si falla...
ESTRATEGIA 3: Análisis de keywords en texto
  ↓ Si falla...
ESTRATEGIA 4: Análisis de estructura DOM (posición, hermanos)
  ↓ Si falla...
ESTRATEGIA 5: Regex en todo el HTML + scoring
```

### Ejemplo Práctico: Detectar Sección de Pricing

```javascript
// Página SIN IDs claros:
<div class="container-fluid">
  <div class="row">
    <div class="col-md-12">
      <h2>Nuestros Planes</h2>
      <div class="row">
        <div class="col-md-4">
          <div class="card">
            <h3>Básico</h3>
            <p class="text-large">$29/mes</p>
            <ul>
              <li>Feature 1</li>
              <li>Feature 2</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

// ¿Cómo lo detectamos?
```

#### Implementación de las 5 Estrategias:

```javascript
class SectionIdentifier {
  
  async findPricingSection(html) {
    const $ = cheerio.load(html)
    
    // ═══════════════════════════════════════════════════
    // ESTRATEGIA 1: IDs y Clases Explícitas
    // ═══════════════════════════════════════════════════
    const explicitSelectors = [
      '#pricing',
      '.pricing-section',
      '[data-section="pricing"]',
      '#plans',
      '.plans-section'
    ]
    
    for (const selector of explicitSelectors) {
      const elem = $(selector)
      if (elem.length > 0 && this.looksLikePricing(elem)) {
        return {
          found: true,
          element: elem,
          method: 'explicit_selector',
          confidence: 0.95,
          selector: selector
        }
      }
    }
    
    // ═══════════════════════════════════════════════════
    // ESTRATEGIA 2: Búsqueda por Headers (h2/h3)
    // ═══════════════════════════════════════════════════
    const pricingKeywords = [
      'pricing', 'precios', 'planes', 'plans', 
      'suscripción', 'subscription', 'paquetes',
      'tarifas', 'membresía'
    ]
    
    // Buscar h2 o h3 que contengan estas palabras
    $('h2, h3').each((i, header) => {
      const headerText = $(header).text().toLowerCase()
      
      const hasKeyword = pricingKeywords.some(keyword => 
        headerText.includes(keyword)
      )
      
      if (hasKeyword) {
        // Obtener la sección padre (section, div, article)
        const section = $(header).closest('section, div[class*="section"], article')
        
        if (section.length > 0 && this.looksLikePricing(section)) {
          return {
            found: true,
            element: section,
            method: 'header_keyword',
            confidence: 0.85,
            matched_header: headerText,
            selector: this.generateSelector(section)
          }
        }
      }
    })
    
    // ═══════════════════════════════════════════════════
    // ESTRATEGIA 3: Análisis de Keywords en Texto
    // ═══════════════════════════════════════════════════
    $('section, div, article').each((i, elem) => {
      const text = $(elem).text()
      const score = this.calculatePricingScore(text)
      
      // Si el score es alto, probablemente es la sección de pricing
      if (score > 0.7) {
        return {
          found: true,
          element: $(elem),
          method: 'keyword_scoring',
          confidence: score,
          selector: this.generateSelector($(elem))
        }
      }
    })
    
    // ═══════════════════════════════════════════════════
    // ESTRATEGIA 4: Análisis de Estructura DOM
    // ═══════════════════════════════════════════════════
    // Buscar divs que contengan múltiples cards/boxes con precios
    $('div, section').each((i, container) => {
      const children = $(container).children()
      
      // Contar cuántos hijos tienen símbolos de precio
      let childrenWithPrice = 0
      children.each((j, child) => {
        const text = $(child).text()
        if (/[$€£¥]\s*\d+/.test(text)) {
          childrenWithPrice++
        }
      })
      
      // Si tiene 2+ hijos con precios, probablemente es pricing
      if (childrenWithPrice >= 2) {
        return {
          found: true,
          element: $(container),
          method: 'dom_structure',
          confidence: 0.75,
          selector: this.generateSelector($(container)),
          plans_detected: childrenWithPrice
        }
      }
    })
    
    // ═══════════════════════════════════════════════════
    // ESTRATEGIA 5: Regex + Scoring en Todo el HTML
    // ═══════════════════════════════════════════════════
    // Última opción: buscar áreas con mayor densidad de precios
    const sections = this.splitIntoLogicalSections($)
    
    let bestMatch = null
    let bestScore = 0
    
    sections.forEach(section => {
      const score = this.calculatePricingSectionScore(section)
      if (score > bestScore) {
        bestScore = score
        bestMatch = section
      }
    })
    
    if (bestMatch && bestScore > 0.5) {
      return {
        found: true,
        element: bestMatch.element,
        method: 'regex_scoring',
        confidence: bestScore,
        selector: this.generateSelector(bestMatch.element)
      }
    }
    
    return { found: false }
  }
  
  /**
   * Verificar si un elemento parece ser sección de pricing
   */
  looksLikePricing(element) {
    const text = element.text().toLowerCase()
    const html = element.html().toLowerCase()
    
    // Indicadores positivos
    const hasPriceSymbols = /[$€£¥]/.test(text)
    const hasPeriod = /(\/mes|\/mo|\/month|\/año|\/year|monthly|yearly|anual)/i.test(text)
    const hasMultiplePrices = (text.match(/\$\d+/g) || []).length >= 2
    const hasPlanKeywords = /(plan|suscripción|subscription|tier|paquete)/i.test(text)
    
    // Indicadores negativos (falsos positivos a evitar)
    const hasProductPrices = /(productos?|items?|comprar|buy|cart)/i.test(text)
    const isFooter = element.is('footer') || element.closest('footer').length > 0
    
    // Scoring
    let score = 0
    if (hasPriceSymbols) score += 0.3
    if (hasPeriod) score += 0.3
    if (hasMultiplePrices) score += 0.2
    if (hasPlanKeywords) score += 0.2
    if (hasProductPrices) score -= 0.3
    if (isFooter) score -= 0.5
    
    return score > 0.5
  }
  
  /**
   * Calcular score de probabilidad de que sea pricing
   */
  calculatePricingScore(text) {
    const lowerText = text.toLowerCase()
    let score = 0
    
    // Keywords de pricing
    const pricingKeywords = {
      'pricing': 0.15,
      'precios': 0.15,
      'planes': 0.12,
      'plans': 0.12,
      'suscripción': 0.10,
      'subscription': 0.10,
      '/mes': 0.08,
      '/month': 0.08,
      'monthly': 0.08,
      'anual': 0.08,
      'yearly': 0.08,
      'free trial': 0.05,
      'prueba gratis': 0.05,
      'básico': 0.05,
      'basic': 0.05,
      'premium': 0.05,
      'enterprise': 0.05
    }
    
    Object.entries(pricingKeywords).forEach(([keyword, weight]) => {
      const count = (lowerText.match(new RegExp(keyword, 'g')) || []).length
      score += count * weight
    })
    
    // Bonus por tener múltiples símbolos de precio
    const priceSymbolCount = (text.match(/[$€£¥]/g) || []).length
    if (priceSymbolCount >= 2) score += 0.2
    if (priceSymbolCount >= 3) score += 0.1
    
    // Normalizar score a 0-1
    return Math.min(score, 1.0)
  }
  
  /**
   * Dividir HTML en secciones lógicas
   */
  splitIntoLogicalSections($) {
    const sections = []
    
    // Buscar todos los posibles contenedores de sección
    $('section, div[class*="section"], article, main > div').each((i, elem) => {
      sections.push({
        element: $(elem),
        text: $(elem).text(),
        index: i
      })
    })
    
    return sections
  }
  
  /**
   * Generar selector CSS para un elemento
   */
  generateSelector(element) {
    // Intentar generar selector único
    const id = element.attr('id')
    if (id) return `#${id}`
    
    const classes = element.attr('class')
    if (classes) {
      const firstClass = classes.split(' ')[0]
      return `.${firstClass}`
    }
    
    const tagName = element.prop('tagName').toLowerCase()
    const index = element.index()
    
    return `${tagName}:nth-child(${index + 1})`
  }
}
```

---

### Tipos de Secciones Detectables

```javascript
const SECTION_TYPES = {
  PRICING: 'pricing',           // 💰 Precios y planes
  REVIEWS: 'reviews',           // ⭐ Opiniones y valoraciones
  FEATURES: 'features',         // ✨ Características del producto
  HERO: 'hero',                 // 🎯 Sección principal/hero
  SOCIAL_PROOF: 'social_proof', // 🤝 Testimonios, logos clientes
  CTA: 'cta',                   // 📞 Call-to-actions
  TEAM: 'team',                 // 👥 Equipo/About us
  BLOG: 'blog',                 // 📰 Blog/Noticias
  TECH: 'tech',                 // 🔧 Stack tecnológico
  CONTACT: 'contact',           // 📧 Información de contacto
  FAQ: 'faq'                    // ❓ Preguntas frecuentes
}
```

### Configuración de Selectores por Sección

```javascript
// src/config/sectionSelectors.js

const SECTION_SELECTORS = {
  // 💰 PRICING
  pricing: {
    primary_selectors: [
      '#pricing',
      '.pricing-section',
      '.pricing-container',
      '[data-section="pricing"]',
      'section[id*="price"]',
      'div[class*="pricing"]'
    ],
    fallback_selectors: [
      'section:has(h2:contains("Pricing"))',
      'section:has(h2:contains("Plans"))',
      'section:has(h2:contains("Precios"))',
      'div:has(.price)',
      'section:has([data-price])'
    ],
    confidence_keywords: [
      'pricing', 'plans', 'precios', 'suscripción', 
      'subscription', '$', '€', 'month', 'mes', '/mo'
    ]
  },

  // ⭐ REVIEWS
  reviews: {
    primary_selectors: [
      '#reviews',
      '.reviews-section',
      '.testimonials',
      '[data-section="reviews"]',
      '#testimonials',
      '.customer-reviews'
    ],
    fallback_selectors: [
      'section:has(h2:contains("Reviews"))',
      'section:has(h2:contains("Testimonials"))',
      'section:has(h2:contains("Opiniones"))',
      'div:has(.review)',
      'section:has(.rating)'
    ],
    confidence_keywords: [
      'reviews', 'testimonials', 'opiniones', 'valoraciones',
      'rating', 'stars', 'estrellas', 'customers say'
    ],
    external_sources: {
      g2: 'https://www.g2.com/products/{slug}/reviews',
      capterra: 'https://www.capterra.com/p/{slug}/reviews',
      trustpilot: 'https://www.trustpilot.com/review/{domain}'
    }
  },

  // ✨ FEATURES
  features: {
    primary_selectors: [
      '#features',
      '.features-section',
      '.capabilities',
      '[data-section="features"]',
      '#capabilities'
    ],
    fallback_selectors: [
      'section:has(h2:contains("Features"))',
      'section:has(h2:contains("Características"))',
      'section:has(h2:contains("Capacidades"))',
      'div:has(.feature-list)'
    ],
    confidence_keywords: [
      'features', 'características', 'capabilities', 
      'funcionalidades', 'what we offer'
    ]
  },

  // 🎯 HERO
  hero: {
    primary_selectors: [
      '.hero',
      '#hero',
      'header + section',
      'section:first-of-type',
      '[data-section="hero"]'
    ],
    fallback_selectors: [
      'section:has(h1)',
      'div:has(.hero-title)',
      'section:has(.cta-button)'
    ],
    confidence_keywords: [
      'h1', 'hero', 'headline', 'main-title'
    ]
  },

  // 🤝 SOCIAL PROOF
  social_proof: {
    primary_selectors: [
      '#social-proof',
      '.social-proof',
      '.testimonials',
      '.clients',
      '.logos',
      '[data-section="clients"]'
    ],
    fallback_selectors: [
      'section:has(h2:contains("Trusted by"))',
      'section:has(h2:contains("Clientes"))',
      'div:has(.client-logo)',
      'section:has(.testimonial)'
    ],
    confidence_keywords: [
      'trusted by', 'clientes', 'clients', 'testimonios',
      'companies', 'customers', 'used by'
    ]
  },

  // 📞 CTA
  cta: {
    primary_selectors: [
      '.cta-section',
      '#cta',
      '[data-section="cta"]'
    ],
    fallback_selectors: [
      'section:has(.cta-button)',
      'div:has(button[class*="cta"])',
      'section:last-of-type:has(button)'
    ],
    button_selectors: [
      'button.cta',
      'a.cta-button',
      'button[class*="primary"]',
      'a[class*="call-to-action"]'
    ]
  },

  // 👥 TEAM
  team: {
    primary_selectors: [
      '#team',
      '.team-section',
      '#about-us',
      '[data-section="team"]'
    ],
    fallback_selectors: [
      'section:has(h2:contains("Team"))',
      'section:has(h2:contains("About"))',
      'section:has(h2:contains("Equipo"))'
    ],
    confidence_keywords: [
      'team', 'equipo', 'about us', 'who we are'
    ]
  },

  // 📧 CONTACT
  contact: {
    primary_selectors: [
      '#contact',
      '.contact-section',
      '#contacto',
      '[data-section="contact"]'
    ],
    fallback_selectors: [
      'section:has(h2:contains("Contact"))',
      'section:has(h2:contains("Contacto"))',
      'footer'
    ],
    extract_patterns: {
      email: /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/g,
      phone: /[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}/g
    }
  }
}

module.exports = SECTION_SELECTORS
```

---

## 🔧 Procesamiento por Sección

### Clase SectionIdentifier

```javascript
// src/services/sectionIdentifier.js

const cheerio = require('cheerio')
const logger = require('../utils/logger')
const SECTION_SELECTORS = require('../config/sectionSelectors')

class SectionIdentifier {
  constructor() {
    this.selectors = SECTION_SELECTORS
  }

  /**
   * Identificar todas las secciones en un HTML
   */
  identifySections(html) {
    const $ = cheerio.load(html)
    const sections = {}
    
    // Intentar identificar cada tipo de sección
    Object.entries(this.selectors).forEach(([sectionType, config]) => {
      const sectionData = this.findSection($, config, sectionType)
      
      if (sectionData.found) {
        sections[sectionType] = sectionData
        logger.info(`✅ Sección "${sectionType}" identificada con: ${sectionData.selector_used}`)
      } else {
        logger.info(`❌ Sección "${sectionType}" no encontrada`)
        sections[sectionType] = { found: false }
      }
    })
    
    return sections
  }

  /**
   * Encontrar una sección específica
   */
  findSection($, config, sectionType) {
    // Intentar con selectores primarios
    for (const selector of config.primary_selectors) {
      const element = $(selector).first()
      
      if (element.length > 0) {
        const html = element.html()
        const text = element.text()
        
        // Verificar confianza usando keywords
        const confidence = this.calculateConfidence(text, config.confidence_keywords)
        
        if (confidence > 0.3) { // 30% de confianza mínima
          return {
            found: true,
            selector_used: selector,
            confidence: confidence,
            html: html,
            text: text,
            element_count: element.length
          }
        }
      }
    }
    
    // Intentar con selectores fallback
    if (config.fallback_selectors) {
      for (const selector of config.fallback_selectors) {
        try {
          const element = $(selector).first()
          
          if (element.length > 0) {
            return {
              found: true,
              selector_used: selector,
              confidence: 0.5, // Confianza media con fallback
              html: element.html(),
              text: element.text(),
              element_count: element.length
            }
          }
        } catch (error) {
          logger.debug(`Selector fallback falló: ${selector}`)
        }
      }
    }
    
    return { found: false }
  }

  /**
   * Calcular confianza de que encontramos la sección correcta
   */
  calculateConfidence(text, keywords) {
    if (!keywords || keywords.length === 0) return 1.0
    
    const lowerText = text.toLowerCase()
    const matches = keywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    )
    
    return matches.length / keywords.length
  }
}

module.exports = new SectionIdentifier()
```

---

## 📦 Extractores Especializados por Sección

### 1. 💰 Pricing Extractor

```javascript
// src/services/extractors/pricingExtractor.js

class PricingExtractor {
  /**
   * Extraer datos de pricing de una sección
   */
  extract(sectionHtml) {
    const $ = cheerio.load(sectionHtml)
    const plans = []
    
    // Selectores para encontrar cada plan
    const planSelectors = [
      '.plan',
      '.pricing-card',
      '.price-box',
      '[data-plan]',
      'div[class*="plan"]'
    ]
    
    // Buscar planes
    planSelectors.forEach(selector => {
      $(selector).each((i, elem) => {
        const plan = this.extractPlan($, $(elem))
        if (plan && plan.price) {
          plans.push(plan)
        }
      })
    })
    
    // Si no encontró con selectores, usar regex
    if (plans.length === 0) {
      plans.push(...this.extractWithRegex(sectionHtml))
    }
    
    return {
      plans: this.deduplicatePlans(plans),
      currency: this.detectCurrency(plans),
      has_free_tier: plans.some(p => p.price.toLowerCase().includes('free')),
      extracted_at: new Date().toISOString()
    }
  }

  /**
   * Extraer datos de un plan individual
   */
  extractPlan($, planElement) {
    return {
      name: this.extractPlanName($, planElement),
      price: this.extractPrice($, planElement),
      period: this.extractPeriod($, planElement),
      features: this.extractFeatures($, planElement),
      is_popular: this.checkIfPopular($, planElement),
      cta_text: this.extractCTA($, planElement)
    }
  }

  extractPlanName($, elem) {
    const selectors = [
      '.plan-name',
      'h3',
      'h4',
      '.title',
      '[data-plan-name]'
    ]
    
    for (const selector of selectors) {
      const text = elem.find(selector).first().text().trim()
      if (text) return text
    }
    
    return 'Unknown Plan'
  }

  extractPrice($, elem) {
    const selectors = [
      '.price',
      '.amount',
      '[data-price]',
      '.cost',
      'span[class*="price"]'
    ]
    
    for (const selector of selectors) {
      const text = elem.find(selector).first().text().trim()
      if (text && /[$€£¥\d]/.test(text)) {
        return this.normalizePrice(text)
      }
    }
    
    // Fallback: buscar con regex en todo el elemento
    const allText = elem.text()
    const match = allText.match(/[$€£¥]\s*\d+(?:[.,]\d{2})?/)
    return match ? match[0] : null
  }

  extractPeriod($, elem) {
    const text = elem.text().toLowerCase()
    
    if (text.includes('/mo') || text.includes('/mes') || text.includes('month')) {
      return 'monthly'
    }
    if (text.includes('/yr') || text.includes('/año') || text.includes('year') || text.includes('anual')) {
      return 'yearly'
    }
    
    return 'monthly' // Default
  }

  extractFeatures($, elem) {
    const features = []
    
    elem.find('li, .feature-item, [data-feature]').each((i, feature) => {
      const text = $(feature).text().trim()
      if (text && text.length > 0) {
        features.push(text)
      }
    })
    
    return features
  }

  checkIfPopular($, elem) {
    const text = elem.text().toLowerCase()
    const classes = elem.attr('class') || ''
    
    return (
      text.includes('popular') ||
      text.includes('recommended') ||
      text.includes('best value') ||
      classes.includes('popular') ||
      classes.includes('featured')
    )
  }

  extractCTA($, elem) {
    const button = elem.find('button, a.button, .cta-button').first()
    return button.text().trim() || 'Get Started'
  }

  /**
   * Extraer precios usando regex (fallback)
   */
  extractWithRegex(html) {
    const text = cheerio.load(html).text()
    const pricePattern = /[$€£¥]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\/?\s*(mo|month|mes|yr|year|año)?/gi
    
    const matches = [...text.matchAll(pricePattern)]
    
    return matches.map(match => ({
      name: 'Plan detectado',
      price: match[0],
      period: match[2] || 'monthly',
      features: [],
      extracted_with: 'regex'
    }))
  }

  normalizePrice(price) {
    // Remover espacios extra
    return price.replace(/\s+/g, ' ').trim()
  }

  deduplicatePlans(plans) {
    const seen = new Set()
    return plans.filter(plan => {
      const key = `${plan.name}_${plan.price}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  detectCurrency(plans) {
    const currencySymbols = {
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY'
    }
    
    for (const plan of plans) {
      if (plan.price) {
        for (const [symbol, currency] of Object.entries(currencySymbols)) {
          if (plan.price.includes(symbol)) {
            return currency
          }
        }
      }
    }
    
    return 'USD' // Default
  }
}

module.exports = new PricingExtractor()
```

---

### 2. ⭐ Reviews Extractor

```javascript
// src/services/extractors/reviewsExtractor.js

class ReviewsExtractor {
  /**
   * Extraer reviews de una sección
   */
  extract(sectionHtml) {
    const $ = cheerio.load(sectionHtml)
    const reviews = []
    
    // Selectores para encontrar cada review
    const reviewSelectors = [
      '.review',
      '.testimonial',
      '[data-review]',
      '.customer-review',
      'div[class*="review"]'
    ]
    
    reviewSelectors.forEach(selector => {
      $(selector).each((i, elem) => {
        const review = this.extractReview($, $(elem))
        if (review && review.text) {
          reviews.push(review)
        }
      })
    })
    
    return {
      reviews: reviews,
      total_count: reviews.length,
      average_rating: this.calculateAverageRating(reviews),
      sentiment_distribution: this.analyzeSentimentDistribution(reviews),
      extracted_at: new Date().toISOString()
    }
  }

  extractReview($, elem) {
    return {
      author: this.extractAuthor($, elem),
      rating: this.extractRating($, elem),
      text: this.extractText($, elem),
      date: this.extractDate($, elem),
      sentiment: null, // Se llenará con IA
      verified: this.checkIfVerified($, elem)
    }
  }

  extractAuthor($, elem) {
    const selectors = ['.author', '.reviewer-name', '.name', '[data-author]']
    
    for (const selector of selectors) {
      const text = elem.find(selector).first().text().trim()
      if (text) return text
    }
    
    return 'Anónimo'
  }

  extractRating($, elem) {
    // Buscar rating como número
    const ratingSelectors = [
      '[data-rating]',
      '.rating',
      '.stars'
    ]
    
    for (const selector of ratingSelectors) {
      const ratingElem = elem.find(selector).first()
      const dataRating = ratingElem.attr('data-rating')
      
      if (dataRating) {
        return parseFloat(dataRating)
      }
      
      // Contar estrellas llenas
      const filledStars = ratingElem.find('.star-filled, .fa-star').length
      if (filledStars > 0) {
        return filledStars
      }
    }
    
    // Buscar en texto: "5 stars", "4.5/5"
    const text = elem.text()
    const ratingMatch = text.match(/(\d+\.?\d*)\s*(?:\/\s*5)?\s*(?:stars?|estrellas?)/i)
    if (ratingMatch) {
      return parseFloat(ratingMatch[1])
    }
    
    return null
  }

  extractText($, elem) {
    const selectors = [
      '.review-text',
      '.comment-text',
      'p',
      '.content',
      '[data-review-text]'
    ]
    
    for (const selector of selectors) {
      const text = elem.find(selector).first().text().trim()
      if (text && text.length > 10) {
        return text
      }
    }
    
    // Fallback: todo el texto del elemento
    return elem.text().trim()
  }

  extractDate($, elem) {
    const selectors = ['.date', 'time', '[data-date]', '.review-date']
    
    for (const selector of selectors) {
      const dateText = elem.find(selector).first().text().trim()
      if (dateText) {
        return dateText
      }
    }
    
    return null
  }

  checkIfVerified($, elem) {
    const text = elem.text().toLowerCase()
    const classes = elem.attr('class') || ''
    
    return (
      text.includes('verified') ||
      text.includes('verificado') ||
      classes.includes('verified')
    )
  }

  calculateAverageRating(reviews) {
    const ratingsWithValue = reviews.filter(r => r.rating !== null)
    if (ratingsWithValue.length === 0) return null
    
    const sum = ratingsWithValue.reduce((acc, r) => acc + r.rating, 0)
    return (sum / ratingsWithValue.length).toFixed(1)
  }

  analyzeSentimentDistribution(reviews) {
    // Esto se llenará después del análisis con IA
    return {
      positive: 0,
      neutral: 0,
      negative: 0
    }
  }
}

module.exports = new ReviewsExtractor()
```

---

### 3. 🤖 Complaint Analyzer (Para Reviews)

```javascript
// src/services/analyzers/complaintAnalyzer.js

class ComplaintAnalyzer {
  constructor() {
    // Patrones de quejas por categoría
    this.complaintPatterns = {
      soporte: {
        keywords: ['soporte', 'support', 'ayuda', 'help', 'atención al cliente'],
        negative_modifiers: ['lento', 'malo', 'terrible', 'pésimo', 'inexistente', 'no responde', 'tarda', 'demora'],
        regex: /(?:soporte|support|ayuda|help).*(?:lento|malo|terrible|pésimo|inexistente|no responde|tarda|demora)/gi,
        severity_weight: 'high' // Quejas de soporte son críticas
      },
      
      precio: {
        keywords: ['precio', 'price', 'caro', 'expensive', 'cost'],
        negative_modifiers: ['caro', 'expensive', 'overpriced', 'demasiado', 'muy caro'],
        regex: /(?:muy )?(?:caro|expensive|overpriced)|precio (?:alto|elevado)/gi,
        severity_weight: 'medium'
      },
      
      bugs: {
        keywords: ['bug', 'error', 'falla', 'problema', 'issue'],
        negative_modifiers: ['no funciona', 'crash', 'se cae', 'falla', 'error'],
        regex: /bug|error|falla|no funciona|crash|se cae|se cierra/gi,
        severity_weight: 'high'
      },
      
      ui_ux: {
        keywords: ['interfaz', 'UI', 'diseño', 'design', 'navigation', 'navegación'],
        negative_modifiers: ['confusa', 'complicada', 'difícil', 'mala', 'confusing', 'complicated'],
        regex: /(?:interfaz|UI|diseño|navigation|navegación).*(?:confusa|complicada|difícil|mala|confusing)/gi,
        severity_weight: 'medium'
      },
      
      features_faltantes: {
        keywords: ['falta', 'missing', 'necesito', 'need', 'debería', 'should'],
        negative_modifiers: ['falta', 'missing', 'no tiene', 'doesn\'t have', 'need'],
        regex: /(?:falta|missing|necesito|need|debería tener|should have|no tiene|doesn't have)/gi,
        severity_weight: 'medium'
      },
      
      onboarding: {
        keywords: ['onboarding', 'setup', 'configuración', 'getting started'],
        negative_modifiers: ['difícil', 'complicado', 'confuso', 'difficult', 'hard', 'complicated'],
        regex: /(?:onboarding|setup|configuración).*(?:difícil|complicado|confuso|difficult|hard)/gi,
        severity_weight: 'medium'
      },
      
      performance: {
        keywords: ['lento', 'slow', 'performance', 'velocidad', 'speed'],
        negative_modifiers: ['lento', 'slow', 'lag', 'loading'],
        regex: /(?:muy )?(?:lento|slow|lag)|(?:carga|loading).*(?:mucho|forever)/gi,
        severity_weight: 'medium'
      }
    }
  }

  /**
   * Analizar quejas en un conjunto de reviews
   */
  analyzeComplaints(reviews) {
    const complaints = {}
    
    // Inicializar categorías
    Object.keys(this.complaintPatterns).forEach(category => {
      complaints[category] = {
        mentions: 0,
        severity: this.complaintPatterns[category].severity_weight,
        examples: [],
        reviews_ids: []
      }
    })
    
    // Analizar cada review
    reviews.forEach(review => {
      Object.entries(this.complaintPatterns).forEach(([category, pattern]) => {
        const matches = review.text.match(pattern.regex)
        
        if (matches) {
          complaints[category].mentions++
          complaints[category].reviews_ids.push(review.id)
          
          // Guardar ejemplo si es uno de los primeros 3
          if (complaints[category].examples.length < 3) {
            complaints[category].examples.push({
              author: review.author,
              text: review.text,
              rating: review.rating,
              date: review.date,
              matched_text: matches[0]
            })
          }
        }
      })
    })
    
    // Filtrar solo categorías con menciones
    const significantComplaints = Object.entries(complaints)
      .filter(([_, data]) => data.mentions > 0)
      .map(([category, data]) => ({
        category,
        ...data,
        percentage: (data.mentions / reviews.length * 100).toFixed(1) + '%'
      }))
      .sort((a, b) => b.mentions - a.mentions)
    
    return significantComplaints
  }

  /**
   * Generar insights de oportunidades competitivas
   */
  generateOpportunities(complaints, myProductStrengths = []) {
    return complaints.map(complaint => {
      // Verificar si esta queja es una de tus fortalezas
      const isMyStrength = myProductStrengths.some(strength => 
        strength.toLowerCase().includes(complaint.category)
      )
      
      return {
        opportunity_type: complaint.category,
        competitor_weakness: {
          mentions: complaint.mentions,
          severity: complaint.severity,
          examples: complaint.examples.map(e => e.text.substring(0, 100))
        },
        is_your_strength: isMyStrength,
        recommended_actions: this.getRecommendedActions(complaint, isMyStrength),
        priority: this.calculatePriority(complaint, isMyStrength)
      }
    })
    .sort((a, b) => {
      const priorityOrder = { 'urgent': 3, 'high': 2, 'medium': 1, 'low': 0 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  getRecommendedActions(complaint, isMyStrength) {
    const actions = []
    
    if (isMyStrength) {
      actions.push({
        action: `Destaca tu ${complaint.category} en la homepage`,
        type: 'marketing',
        effort: 'low'
      })
      actions.push({
        action: `Crea landing page comparativa: "Por qué elegir nosotros"`,
        type: 'marketing',
        effort: 'medium'
      })
      actions.push({
        action: `Email a prospects: "La ventaja que ${complaint.category}"`,
        type: 'sales',
        effort: 'low'
      })
    } else {
      actions.push({
        action: `Mejora tu ${complaint.category} - es debilidad del mercado`,
        type: 'product',
        effort: 'high'
      })
      actions.push({
        action: `Evalúa cómo otros competidores manejan ${complaint.category}`,
        type: 'research',
        effort: 'low'
      })
    }
    
    return actions
  }

  calculatePriority(complaint, isMyStrength) {
    // Si es tu fortaleza y ellos tienen muchas quejas = URGENT
    if (isMyStrength && complaint.mentions > 10) {
      return 'urgent'
    }
    
    // Si no es tu fortaleza pero tiene muchas quejas = HIGH (mejorar)
    if (!isMyStrength && complaint.mentions > 10) {
      return 'high'
    }
    
    // Quejas moderadas
    if (complaint.mentions > 5) {
      return 'medium'
    }
    
    return 'low'
  }
}

module.exports = new ComplaintAnalyzer()
```

---

## 🗄️ Estructura de Base de Datos

### Nueva Tabla: competitor_sections

```sql
CREATE TABLE competitor_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  section_type VARCHAR(50) NOT NULL,
  
  -- Metadatos de identificación
  section_found BOOLEAN DEFAULT false,
  selector_used VARCHAR(255),
  confidence_score DECIMAL(3,2), -- 0.00 a 1.00
  
  -- Datos extraídos
  raw_html TEXT,
  extracted_data JSONB, -- Datos estructurados
  
  -- Control de cambios
  previous_data JSONB,
  has_changes BOOLEAN DEFAULT false,
  change_summary TEXT,
  
  -- Timestamps
  extracted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Índices
  UNIQUE(competitor_id, section_type, extracted_at)
);

CREATE INDEX idx_sections_competitor ON competitor_sections(competitor_id);
CREATE INDEX idx_sections_type ON competitor_sections(section_type);
CREATE INDEX idx_sections_has_changes ON competitor_sections(has_changes);
```

### Nueva Tabla: section_insights

```sql
CREATE TABLE section_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  section_type VARCHAR(50) NOT NULL,
  
  -- Tipo de insight
  insight_type VARCHAR(50), -- 'opportunity', 'threat', 'trend', 'alert'
  category VARCHAR(50), -- 'pricing', 'feature_gap', 'complaint', etc.
  
  -- Contenido del insight
  title VARCHAR(255),
  description TEXT,
  severity VARCHAR(20), -- 'urgent', 'high', 'medium', 'low'
  
  -- Datos de soporte
  supporting_data JSONB, -- Ejemplos, estadísticas, etc.
  
  -- Recomendaciones
  recommended_actions JSONB,
  
  -- Estado
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'dismissed', 'acted_upon'
  dismissed_at TIMESTAMP,
  acted_upon_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_insights_competitor ON section_insights(competitor_id);
CREATE INDEX idx_insights_severity ON section_insights(severity);
CREATE INDEX idx_insights_status ON section_insights(status);
```

---

## 🔌 API Endpoints

### Endpoints para Secciones

```javascript
// GET /api/competitors/:id/sections
// Listar todas las secciones identificadas
router.get('/:id/sections', async (req, res) => {
  const sections = await CompetitorSection.findAll({
    where: { 
      competitorId: req.params.id,
      sectionFound: true 
    },
    order: [['extracted_at', 'DESC']],
    limit: 1 // Último capture
  })
  
  res.json({ success: true, data: sections })
})

// GET /api/competitors/:id/sections/:type
// Obtener datos de una sección específica
router.get('/:id/sections/:type', async (req, res) => {
  const section = await CompetitorSection.findOne({
    where: {
      competitorId: req.params.id,
      sectionType: req.params.type,
      sectionFound: true
    },
    order: [['extracted_at', 'DESC']]
  })
  
  res.json({ success: true, data: section })
})

// GET /api/competitors/:id/sections/pricing/history
// Historial de una sección (ej: cambios de precio)
router.get('/:id/sections/pricing/history', async (req, res) => {
  const history = await CompetitorSection.findAll({
    where: {
      competitorId: req.params.id,
      sectionType: 'pricing',
      sectionFound: true
    },
    order: [['extracted_at', 'DESC']],
    limit: 20
  })
  
  res.json({ success: true, data: history })
})

// GET /api/competitors/:id/insights
// Obtener insights y oportunidades
router.get('/:id/insights', async (req, res) => {
  const insights = await SectionInsight.findAll({
    where: {
      competitorId: req.params.id,
      status: 'active'
    },
    order: [
      ['severity', 'DESC'],
      ['created_at', 'DESC']
    ]
  })
  
  res.json({ success: true, data: insights })
})

// POST /api/competitors/:id/analyze-section
// Analizar una sección específica con IA
router.post('/:id/analyze-section', async (req, res) => {
  const { sectionType } = req.body
  
  // Obtener la última versión de esa sección
  const section = await CompetitorSection.findOne({
    where: {
      competitorId: req.params.id,
      sectionType,
      sectionFound: true
    },
    order: [['extracted_at', 'DESC']]
  })
  
  // Analizar con IA según el tipo
  let analysis
  switch(sectionType) {
    case 'reviews':
      analysis = await complaintAnalyzer.analyze(section.extracted_data)
      break
    case 'pricing':
      analysis = await pricingAnalyzer.analyze(section.extracted_data)
      break
    case 'features':
      analysis = await featuresAnalyzer.analyze(section.extracted_data)
      break
  }
  
  res.json({ success: true, data: analysis })
})
```

---

## 🎨 Frontend Components por Sección

### Vista del Dashboard

```tsx
// app/dashboard/competitors/[id]/sections/page.tsx

export default function CompetitorSectionsPage({ params }) {
  const [selectedSection, setSelectedSection] = useState('overview')
  const [sectionsData, setSectionsData] = useState(null)
  
  return (
    <div className="space-y-6">
      <h1>Análisis por Secciones - {competitor.name}</h1>
      
      {/* Tabs por sección */}
      <Tabs value={selectedSection} onValueChange={setSelectedSection}>
        <TabsList>
          <TabsTrigger value="overview">📊 Overview</TabsTrigger>
          <TabsTrigger value="pricing">💰 Pricing</TabsTrigger>
          <TabsTrigger value="reviews">⭐ Reviews</TabsTrigger>
          <TabsTrigger value="features">✨ Features</TabsTrigger>
          <TabsTrigger value="hero">🎯 Hero</TabsTrigger>
          <TabsTrigger value="social">🤝 Social Proof</TabsTrigger>
        </TabsList>
        
        {/* OVERVIEW - Resumen de todas las secciones */}
        <TabsContent value="overview">
          <SectionsOverview sections={sectionsData} />
        </TabsContent>
        
        {/* PRICING - Herramientas de pricing */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>💰 Análisis de Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Herramienta 1: Tabla de precios actual */}
              <PricingTable data={sectionsData.pricing} />
              
              {/* Herramienta 2: Historial de cambios de precio */}
              <PriceHistoryChart competitorId={params.id} />
              
              {/* Herramienta 3: Comparación con tu producto */}
              <PriceComparison 
                their_pricing={sectionsData.pricing}
                my_pricing={myPricingData}
              />
              
              {/* Herramienta 4: Alertas configuradas */}
              <PriceAlertSettings competitorId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* REVIEWS - Herramientas de análisis de reviews */}
        <TabsContent value="reviews">
          <div className="grid gap-6">
            {/* Herramienta 1: Dashboard de quejas recurrentes */}
            <Card>
              <CardHeader>
                <CardTitle>⚠️ Quejas Recurrentes Detectadas</CardTitle>
              </CardHeader>
              <CardContent>
                <ComplaintsDetector 
                  reviews={sectionsData.reviews.reviews}
                  complaints={sectionsData.reviews.complaints_analysis}
                />
              </CardContent>
            </Card>
            
            {/* Herramienta 2: Oportunidades competitivas */}
            <Card>
              <CardHeader>
                <CardTitle>🎯 Oportunidades para Ti</CardTitle>
              </CardHeader>
              <CardContent>
                <OpportunityFinder 
                  complaints={sectionsData.reviews.complaints_analysis}
                  myStrengths={myProductStrengths}
                />
              </CardContent>
            </Card>
            
            {/* Herramienta 3: Análisis de sentimiento */}
            <Card>
              <CardHeader>
                <CardTitle>📊 Análisis de Sentimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <SentimentChart reviews={sectionsData.reviews.reviews} />
              </CardContent>
            </Card>
            
            {/* Herramienta 4: Timeline de opiniones */}
            <Card>
              <CardHeader>
                <CardTitle>📈 Tendencia de Opiniones</CardTitle>
              </CardHeader>
              <CardContent>
                <ReviewsTrendChart competitorId={params.id} />
              </CardContent>
            </Card>
            
            {/* Herramienta 5: Alerta de aumento de quejas */}
            <Card>
              <CardHeader>
                <CardTitle>🚨 Configurar Alertas</CardTitle>
              </CardHeader>
              <CardContent>
                <ComplaintAlertSettings 
                  categories={Object.keys(complaints)}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* FEATURES - Herramientas de features */}
        <TabsContent value="features">
          <div className="grid gap-6">
            {/* Herramienta 1: Gap Analysis */}
            <FeatureGapAnalysis 
              their_features={sectionsData.features}
              my_features={myFeatures}
            />
            
            {/* Herramienta 2: Timeline de nuevas features */}
            <NewFeaturesTimeline competitorId={params.id} />
            
            {/* Herramienta 3: Alerta de feature nueva */}
            <NewFeatureAlerts competitorId={params.id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

## 💡 Ejemplo Completo de Uso

### Caso Real: Analizar Competidor

```javascript
// 1. Capturar HTML
const html = await headlessXService.extractHTML('https://competitor.com')

// 2. Identificar secciones
const sections = sectionIdentifier.identifySections(html)

// 3. Extraer datos de cada sección
const extractedData = {}

if (sections.pricing.found) {
  extractedData.pricing = pricingExtractor.extract(sections.pricing.html)
}

if (sections.reviews.found) {
  extractedData.reviews = reviewsExtractor.extract(sections.reviews.html)
  
  // 4. Analizar quejas (SOLO en la sección de reviews)
  const complaints = complaintAnalyzer.analyzeComplaints(
    extractedData.reviews.reviews
  )
  
  // 5. Generar oportunidades
  const opportunities = complaintAnalyzer.generateOpportunities(
    complaints,
    ['soporte rápido', 'UI intuitiva'] // Tus fortalezas
  )
  
  extractedData.reviews.complaints_analysis = complaints
  extractedData.reviews.opportunities = opportunities
}

// 6. Guardar en BD
await CompetitorSection.create({
  competitorId: competitorId,
  sectionType: 'reviews',
  sectionFound: true,
  selectorUsed: sections.reviews.selector_used,
  confidenceScore: sections.reviews.confidence,
  rawHtml: sections.reviews.html,
  extractedData: extractedData.reviews
})

// 7. Crear insights
opportunities.forEach(async (opp) => {
  await SectionInsight.create({
    competitorId: competitorId,
    sectionType: 'reviews',
    insightType: 'opportunity',
    category: opp.opportunity_type,
    title: `Oportunidad: ${opp.opportunity_type}`,
    description: `${opp.competitor_weakness.mentions} usuarios se quejan de esto`,
    severity: opp.priority,
    supportingData: opp.competitor_weakness,
    recommendedActions: opp.recommended_actions
  })
})
```

---

## 🎯 Resultado: Dashboard por Sección

El usuario ve:

```
┌─────────────────────────────────────────────────┐
│ 📊 Competidor A - Vista por Secciones          │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Overview] [💰Pricing] [⭐Reviews] [✨Features] │
│                                                 │
│ ════════════════════════════════════════════    │
│ TAB: ⭐ REVIEWS                                 │
│                                                 │
│ 🔍 HERRAMIENTAS DISPONIBLES:                    │
│                                                 │
│ ┌─────────────────────────────────────┐        │
│ │ ⚠️ Quejas Recurrentes               │        │
│ │                                     │        │
│ │ 1. Soporte lento (15 menciones)    │        │
│ │ 2. UI confusa (12 menciones)       │        │
│ │ 3. Sin Slack (8 menciones)         │        │
│ └─────────────────────────────────────┘        │
│                                                 │
│ ┌─────────────────────────────────────┐        │
│ │ 🎯 Tus Oportunidades                │        │
│ │                                     │        │
│ │ ✅ Soporte rápido = Tu ventaja #1   │        │
│ │ Acciones sugeridas:                 │        │
│ │ • Destaca en homepage               │        │
│ │ • Landing page comparativa          │        │
│ │ • Email campaign                    │        │
│ └─────────────────────────────────────┘        │
│                                                 │
│ ┌─────────────────────────────────────┐        │
│ │ 📈 Tendencia de Sentimiento         │        │
│ │ [Gráfico mostrando evolución]       │        │
│ └─────────────────────────────────────┘        │
│                                                 │
│ ┌─────────────────────────────────────┐        │
│ │ 🚨 Configurar Alertas               │        │
│ │ ☑ Alertar si quejas de soporte > 20│        │
│ │ ☐ Alertar si rating baja < 4.0     │        │
│ └─────────────────────────────────────┘        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## ✅ Ventajas de Este Enfoque

1. **Modular**: Cada sección es independiente
2. **Especializado**: Herramientas específicas por tipo
3. **Escalable**: Fácil agregar nuevos tipos de sección
4. **Preciso**: No mezcla datos de diferentes áreas
5. **Flexible**: Cada competidor puede tener diferentes secciones detectadas

---

**Fecha de creación**: 11 de Octubre, 2025  
**Última actualización**: 11 de Octubre, 2025  
**Estado**: Especificación técnica completa

