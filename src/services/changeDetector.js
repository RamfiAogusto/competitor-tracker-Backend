/**
 * Servicio para detección y manejo de cambios
 * Implementa el sistema de versionado inteligente
 */

const diff = require('diff')
const zlib = require('zlib')
const { promisify } = require('util')
const config = require('../config')
const logger = require('../utils/logger')
const headlessXService = require('./headlessXService')
const alertService = require('./alertService')
const sectionExtractor = require('./sectionExtractor')
const aiService = require('./aiService')
const { AppError } = require('../middleware/errorHandler')

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

class ChangeDetector {
  constructor () {
    this.config = config.versioning
  }

  /**
   * Capturar cambio en un competidor
   */
  async captureChange (competitorId, url, options = {}) {
    try {
      logger.info(`Iniciando captura de cambio para competidor ${competitorId}`, {
        competitorId,
        url: typeof url === 'string' ? url : 'NO_URL',
        urlType: typeof url,
        isManualCheck: options.isManualCheck,
        simulate: options.simulate,
        htmlVersion: options.htmlVersion
      })

      // Si se llama desde el endpoint manual, obtener URL del competidor
      if ((!url || typeof url !== 'string') && options.isManualCheck) {
        logger.info('Obteniendo URL del competidor desde la base de datos')
        const { Competitor } = require('../models')
        const competitor = await Competitor.findByPk(competitorId)
        if (!competitor) {
          throw new AppError('Competidor no encontrado', 404)
        }
        url = competitor.url
        logger.info(`URL obtenida del competidor: ${url}`)
      }

      // Validar que tenemos una URL válida
      if (!url || typeof url !== 'string') {
        throw new AppError(`URL inválida: ${typeof url} - ${JSON.stringify(url)}`, 400)
      }

      // Normalizar URL (agregar protocolo si no lo tiene)
      const normalizedUrl = this.normalizeUrl(url)
      logger.info(`URL normalizada: ${url} → ${normalizedUrl}`)

      // 1. Obtener HTML actual
      const currentHtml = await this.getPageHTML(normalizedUrl, options)
      
      // 2. Obtener última versión
      const lastSnapshot = await this.getCurrentSnapshot(competitorId)
      
      if (!lastSnapshot) {
        // Primera captura - guardar versión completa
        logger.info(`Primera captura para competidor ${competitorId}`)
        const initialVersion = await this.captureInitialVersion(competitorId, normalizedUrl, currentHtml, options)
        
        // Retornar resultado para monitoreo manual
        if (options.isManualCheck) {
          return {
            changesDetected: false,
            alertCreated: false,
            snapshotId: initialVersion.id,
            changeCount: 0,
            severity: 'low',
            changePercentage: 0,
            changeSummary: 'Primera captura - versión inicial guardada'
          }
        }
        
        return initialVersion
      }

      // Para monitoreo manual, simular cambios usando diferentes versiones
      if (options.isManualCheck && options.simulate) {
        logger.info(`Simulando cambios para monitoreo manual usando versión ${options.htmlVersion}`)
        
        // Si ya hay una captura previa, forzar detección de cambios
        if (options.htmlVersion === 'v3') {
          // v3 tiene más cambios que v2, forzar detección
          logger.info('Forzando detección de cambios para v3')
          
          // Crear comparación simulada
          const simulatedComparison = {
            changeCount: 15,
            changePercentage: 12.5,
            severity: 'medium',
            changeSummary: 'Nuevo plan Enterprise agregado a $99/mes, características avanzadas añadidas',
            currentHtml: currentHtml,
            changes: [
              { added: true, content: 'Enterprise Plan - $99/month' },
              { added: true, content: 'Advanced Feature 3' },
              { removed: true, content: 'Old feature removed' },
              { modified: true, content: 'Support section added' }
            ]
          }
          
          // Crear nueva versión
          const newVersion = await this.createNewVersion(competitorId, simulatedComparison, options)
          
          // Guardar diferencias
          await this.saveDifferences(lastSnapshot.id, newVersion.id, simulatedComparison)
          
          // Crear alerta
          const alert = await this.createChangeAlert(competitorId, newVersion, simulatedComparison)
          
          return {
            changesDetected: true,
            alertCreated: !!alert,
            snapshotId: newVersion.id,
            changeCount: simulatedComparison.changeCount,
            severity: simulatedComparison.severity,
            changePercentage: simulatedComparison.changePercentage,
            changeSummary: simulatedComparison.changeSummary
          }
        }
      }

      // 3. Comparar con la versión anterior
      const comparison = await this.compareVersions(lastSnapshot, currentHtml)
      
      if (!this.isSignificantChange(comparison)) {
        logger.info(`No hay cambios significativos para ${url}`, {
          changeCount: comparison.changeCount,
          changePercentage: comparison.changePercentage,
          threshold: this.config.significantChangeThreshold
        })
        
        // Retornar resultado para monitoreo manual
        if (options.isManualCheck) {
          return {
            changesDetected: false,
            alertCreated: false,
            snapshotId: null,
            changeCount: 0,
            severity: 'low',
            changePercentage: 0,
            changeSummary: 'No se detectaron cambios significativos'
          }
        }
        
        return null
      }

      logger.info(`✅ Cambios detectados:`, {
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage.toFixed(4) + '%',
        severity: comparison.severity
      })
      
      if (comparison.changeSummary) {
        logger.info(`📍 Detalles: ${comparison.changeSummary}`)
      }

      // 4. Crear nueva versión
      const newVersion = await this.createNewVersion(competitorId, comparison, options)
      
      // 5. Guardar diferencias
      await this.saveDifferences(lastSnapshot.id, newVersion.id, comparison)
      
      // 6. Crear alerta automática
      const alert = await this.createChangeAlert(competitorId, newVersion, comparison)
      
      // 7. Limpiar versiones antiguas si es necesario
      await this.cleanupOldVersions(competitorId)
      
      // 8. Retornar resultado para monitoreo manual
      if (options.isManualCheck) {
        return {
          changesDetected: true,
          alertCreated: !!alert,
          snapshotId: newVersion.id,
          changeCount: comparison.changeCount,
          severity: comparison.severity,
          changePercentage: comparison.changePercentage,
          changeSummary: comparison.changeSummary
        }
      }
      
      return newVersion
      
    } catch (error) {
      logger.error('Error capturando cambio:', error)
      throw new AppError(`Error capturando cambios: ${error.message || error}`, 500)
    }
  }

  /**
   * Obtener HTML de una página usando HeadlessX
   */
  async getPageHTML (url, options = {}) {
    try {
      // Si se proporciona HTML simulado, usarlo
      if (options.html && options.simulate) {
        logger.info(`🧪 Usando HTML simulado para ${url}`)
        return options.html
      }

      // Si se está simulando, usar HTML simulado basado en la versión
      if (options.simulate && options.htmlVersion) {
        logger.info(`🧪 Usando HTML simulado versión ${options.htmlVersion} para ${url}`)
        return this.getSimulatedHTML(options.htmlVersion)
      }

      // Usar HeadlessX para obtener HTML real
      logger.info(`🌐 Capturando ${url}...`)
      
      const result = await headlessXService.extractHTML(url, {
        waitFor: options.waitFor || 2000,
        viewport: options.viewport || { width: 1920, height: 1080 },
        removeScripts: true,
        timeout: options.timeout || 30000,
        screenshot: options.screenshot || false,
        fullPage: options.fullPage !== false
      })

      logger.info(`✅ Capturado: ${result.html?.length || 0} caracteres`)

      return result.html
    } catch (error) {
      logger.error(`❌ Error obteniendo HTML de ${url}:`, error)
      
      // Si es una captura inicial, no fallar completamente
      if (options.isInitialCapture) {
        logger.warn(`⚠️  Captura inicial falló para ${url}, usando HTML básico`)
        return `<html><head><title>Error - ${url}</title></head><body><h1>Error al cargar página</h1><p>URL: ${url}</p><p>Error: ${error.message}</p></body></html>`
      }
      
      throw new AppError(`Error obteniendo HTML de ${url}: ${error.message}`, 502)
    }
  }

  /**
   * Obtener HTML simulado para pruebas
   */
  getSimulatedHTML(version = 'v1') {
    const htmlVersions = {
      v1: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Competitor - Version 1</title>
        </head>
        <body>
          <header>
            <h1>Test Competitor</h1>
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
            </nav>
          </header>
          <main>
            <section class="pricing">
              <h2>Pricing Plans</h2>
              <div class="plan">
                <h3>Basic Plan</h3>
                <p class="price">$9/month</p>
                <ul>
                  <li>Feature 1</li>
                  <li>Feature 2</li>
                </ul>
              </div>
            </section>
          </main>
        </body>
        </html>
      `,
      v2: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Competitor - Version 2</title>
        </head>
        <body>
          <header>
            <h1>Test Competitor</h1>
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
              <a href="/features">Features</a>
            </nav>
          </header>
          <main>
            <section class="pricing">
              <h2>Pricing Plans</h2>
              <div class="plan">
                <h3>Basic Plan</h3>
                <p class="price">$12/month</p>
                <ul>
                  <li>Feature 1</li>
                  <li>Feature 2</li>
                  <li>Feature 3</li>
                </ul>
              </div>
              <div class="plan">
                <h3>Pro Plan</h3>
                <p class="price">$29/month</p>
                <ul>
                  <li>All Basic Features</li>
                  <li>Advanced Feature 1</li>
                  <li>Advanced Feature 2</li>
                </ul>
              </div>
            </section>
          </main>
        </body>
        </html>
      `,
      v3: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Competitor - Version 3</title>
        </head>
        <body>
          <header>
            <h1>Test Competitor</h1>
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
              <a href="/features">Features</a>
              <a href="/support">Support</a>
            </nav>
          </header>
          <main>
            <section class="pricing">
              <h2>Pricing Plans</h2>
              <div class="plan">
                <h3>Basic Plan</h3>
                <p class="price">$15/month</p>
                <ul>
                  <li>Feature 1</li>
                  <li>Feature 2</li>
                  <li>Feature 3</li>
                  <li>Feature 4</li>
                </ul>
              </div>
              <div class="plan">
                <h3>Pro Plan</h3>
                <p class="price">$39/month</p>
                <ul>
                  <li>All Basic Features</li>
                  <li>Advanced Feature 1</li>
                  <li>Advanced Feature 2</li>
                  <li>Advanced Feature 3</li>
                </ul>
              </div>
              <div class="plan">
                <h3>Enterprise Plan</h3>
                <p class="price">$99/month</p>
                <ul>
                  <li>All Pro Features</li>
                  <li>Enterprise Feature 1</li>
                  <li>Enterprise Feature 2</li>
                  <li>Priority Support</li>
                </ul>
              </div>
            </section>
          </main>
        </body>
        </html>
      `
    }
    
    return htmlVersions[version] || htmlVersions.v1
  }

  /**
   * Captura inicial - versión completa
   */
  async captureInitialVersion (competitorId, url, html, options = {}) {
    try {
      const { Snapshot } = require('../models')
      const { Competitor } = require('../models')
      
      // NUNCA comprimir HTML - siempre guardar tal como viene de HeadlessX
      const htmlToSave = html
      
      logger.info('Guardando HTML sin comprimir (tal como viene de HeadlessX):', {
        originalLength: html.length,
        competitorId,
        isManualCheck: options.isManualCheck,
        htmlPreview: html.substring(0, 100) + '...'
      })

      // ✅ NUEVO: Analizar estructura inicial del sitio
      let initialMetadata = null
      
      if (options.enableAI || true) { // Siempre analizar estructura inicial
        try {
          logger.info('🔍 Analizando estructura inicial del sitio web...')
          
          // Analizar estructura sin necesidad de comparación
          const cheerio = require('cheerio')
          const $ = cheerio.load(html)
          
          // Identificar todas las secciones principales del sitio
          const initialSections = []
          const commonSelectors = [
            'header', 'nav', 'main', 'section', 'article', 'footer',
            '#hero', '#pricing', '#features', '#about', '#contact', '#testimonials',
            '.hero', '.pricing', '.features', '.about', '.contact', '.testimonials',
            '[data-section]'
          ]
          
          const seenSelectors = new Set()
          
          commonSelectors.forEach(selector => {
            try {
              const elements = $(selector)
              elements.each((idx, elem) => {
                const element = $(elem)
                const generatedSelector = sectionExtractor.generateSelector(element)
                
                if (!seenSelectors.has(generatedSelector)) {
                  seenSelectors.add(generatedSelector)
                  
                  const sectionType = sectionExtractor.identifySectionType(generatedSelector, element)
                  const confidence = sectionExtractor.calculateConfidenceScore(generatedSelector, sectionType, element)
                  
                  initialSections.push({
                    selector: generatedSelector,
                    type: sectionType,
                    confidence: confidence,
                    text: sectionExtractor.extractRelevantText(element),
                    hasId: !!element.attr('id'),
                    hasClass: !!element.attr('class')
                  })
                }
              })
            } catch (err) {
              logger.debug(`Error analizando selector ${selector}:`, err.message)
            }
          })
          
          // Ordenar por confianza
          initialSections.sort((a, b) => b.confidence - a.confidence)
          
          logger.info(`✅ Estructura inicial analizada: ${initialSections.length} secciones detectadas`)
          
          initialMetadata = {
            initialStructure: {
              sectionsCount: initialSections.length,
              sections: initialSections.slice(0, 20), // Limitar a 20 secciones principales
              summary: `Sitio web con ${initialSections.length} secciones detectadas: ${[...new Set(initialSections.map(s => s.type))].join(', ')}`
            }
          }
          
          // Si enableAI está activado, hacer análisis de IA de la estructura inicial
          if (options.enableAI) {
            logger.info('🤖 Generando análisis de IA de la estructura inicial...')
            
            const competitor = await Competitor.findByPk(competitorId)
            
            const aiAnalysis = await aiService.analyzeInitialStructure({
              competitorName: competitor?.name || 'Desconocido',
              url: url,
              sections: initialSections.slice(0, 15).map(s => ({
                type: s.type,
                selector: s.selector,
                confidence: s.confidence
              }))
            })
            
            initialMetadata.aiAnalysis = aiAnalysis
            logger.info('✅ Análisis de IA completado para estructura inicial')
          }
          
        } catch (analysisError) {
          logger.error('❌ Error analizando estructura inicial:', analysisError)
          // Continuar sin metadata si falla el análisis
        }
      }

      // Crear snapshot en la base de datos
      const snapshot = await Snapshot.create({
        competitorId: competitorId,
        versionNumber: 1,
        fullHtml: htmlToSave,
        isFullVersion: true,
        isCurrent: true,
        changeCount: 0,
        changePercentage: 0,
        severity: 'low', // Usar 'low' en lugar de 'none' que no existe en el enum
        changeType: 'other', // Primera captura = other
        changeSummary: 'Primera captura - versión inicial',
        metadata: initialMetadata // ✅ Guardar metadata con estructura inicial
      })

      // Actualizar contador de versiones del competidor
      await Competitor.update(
        { totalVersions: 1 },
        { where: { id: competitorId } }
      )

      logger.info(`Snapshot inicial creado para competidor ${competitorId}:`, {
        snapshotId: snapshot.id,
        versionNumber: snapshot.versionNumber,
        changeType: snapshot.changeType,
        htmlLength: htmlToSave.length,
        htmlUncompressed: true
      })
      
      return snapshot
    } catch (error) {
      logger.error('Error en captura inicial:', error)
      throw new AppError('Error en captura inicial', 500)
    }
  }

  /**
   * Comparar versiones y generar diferencias
   */
  async compareVersions (lastSnapshot, currentHtml) {
    try {
      logger.info('🔄 Comparando versión #' + lastSnapshot.versionNumber)
      
      // Obtener HTML anterior (descomprimir si es necesario)
      const previousHtml = await this.getHTMLFromSnapshot(lastSnapshot)
      
      // Validar que ambos HTMLs son strings
      const prevHtmlStr = typeof previousHtml === 'string' ? previousHtml : String(previousHtml || '')
      const currHtmlStr = typeof currentHtml === 'string' ? currentHtml : String(currentHtml || '')
      
      logger.info('📊 Tamaño: ' + prevHtmlStr.length + ' → ' + currHtmlStr.length + ' (' + 
                  ((currHtmlStr.length - prevHtmlStr.length) / prevHtmlStr.length * 100).toFixed(1) + '% dif)')
      
      // Normalizar HTMLs para eliminar diferencias irrelevantes
      const normalizedPrevHtml = this.normalizeHTML(prevHtmlStr)
      const normalizedCurrHtml = this.normalizeHTML(currHtmlStr)
      
      const areIdentical = normalizedPrevHtml === normalizedCurrHtml
      logger.info('📊 Después normalización: ' + (areIdentical ? '✅ idénticos' : '⚠️ diferentes'))

      // Guardar información detallada en archivo de debug
      await this.saveDebugInfo({
        timestamp: new Date().toISOString(),
        snapshotInfo: {
          id: lastSnapshot.id,
          versionNumber: lastSnapshot.versionNumber,
          competitorId: lastSnapshot.competitorId
        },
        originalHtml: {
          previousLength: prevHtmlStr.length,
          currentLength: currHtmlStr.length,
          previousPreview: prevHtmlStr.substring(0, 500),
          currentPreview: currHtmlStr.substring(0, 500),
          previousFull: prevHtmlStr, // Guardar completo
          currentFull: currHtmlStr // Guardar completo
        },
        normalizedHtml: {
          previousLength: normalizedPrevHtml.length,
          currentLength: normalizedCurrHtml.length,
          areIdentical: normalizedPrevHtml === normalizedCurrHtml,
          previousPreview: normalizedPrevHtml.substring(0, 500),
          currentPreview: normalizedCurrHtml.substring(0, 500),
          previousFull: normalizedPrevHtml, // Guardar completo
          currentFull: normalizedCurrHtml // Guardar completo
        }
      })
      
      // Si los HTMLs normalizados son idénticos, no hay cambios reales
      if (normalizedPrevHtml === normalizedCurrHtml) {
        return {
          changes: [],
          changeCount: 0,
          changePercentage: 0,
          totalLines: 0,
          changedLines: 0,
          severity: 'low',
          currentHtml: currHtmlStr
        }
      }

      logger.info('⚠️  Analizando diferencias...')

      // Generar diferencias usando palabras para mayor precisión
      const changes = diff.diffWords(normalizedPrevHtml, normalizedCurrHtml)
      const changesWithModifications = changes.filter(c => c.added || c.removed)
      
      logger.info('📝 Diferencias: ' + changesWithModifications.length + ' cambios detectados')
      
      // Filtrar cambios significativos (ignorar solo espacios/puntuación)
      const significantChanges = changes.filter(change => {
        if (change.added || change.removed) {
          const trimmedValue = change.value.trim()
          const changeLength = trimmedValue.length
          
          // Ignorar cambios que son solo espacios en blanco
          if (changeLength === 0) {
            return false
          }
          
          // Ignorar solo puntuación o símbolos sin contenido
          if (changeLength < 3) {
            const isPunctuation = /^[.,;:!?¿¡()\[\]{}"'<>\/\\|@#$%^&*+=~`\-_]+$/.test(trimmedValue)
            if (isPunctuation) {
              logger.debug(`🔻 Descartado (solo puntuación): "${trimmedValue}"`)
              return false
            }
          }
          
          // Aceptar cualquier cambio con letras o números
          const hasContent = /[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/.test(trimmedValue)
          
          if (!hasContent) {
            logger.debug(`🔻 Descartado (sin contenido): "${trimmedValue}"`)
            return false
          }
          
          // Todos los cambios con contenido son significativos
          return true
        }
        return false
      })

      // Calcular métricas basadas en caracteres (más preciso)
      const totalChars = normalizedCurrHtml.length
      const changedChars = significantChanges.reduce((acc, change) => {
        return acc + change.value.length
      }, 0)

      const changePercentage = totalChars > 0 ? (changedChars / totalChars) * 100 : 0
      const severity = this.calculateSeverity(changePercentage, significantChanges)

      // Generar resumen detallado con contexto
      const changeSummary = this.generateChangeSummary(significantChanges, currHtmlStr)
      
      logger.info('📊 Análisis: ' + significantChanges.length + ' cambios, ' + 
                  changePercentage.toFixed(4) + '% modificado, severidad: ' + severity)
      
      if (changeSummary && changeSummary.length < 200) {
        logger.info('📍 ' + changeSummary)
      }
      
      // Log de cambios solo si son pocos (para no llenar logs)
      if (significantChanges.length > 0 && significantChanges.length <= 5) {
        significantChanges.forEach((change, index) => {
          const type = change.added ? '➕' : '➖'
          const preview = change.value.trim().substring(0, 50)
          logger.info(`  ${type} "${preview}${change.value.length > 50 ? '...' : ''}"`)
        })
      } else if (significantChanges.length > 5) {
        logger.info('  (Muchos cambios - ver archivo de debug para detalles)')
      }

      // 🤖 NUEVO: Extraer secciones específicas donde ocurrieron los cambios
      let extractedSections = null
      let aiAnalysis = null
      
      if (significantChanges.length > 0) {
        try {
          logger.info('🔍 Extrayendo secciones específicas de los cambios...')
          extractedSections = sectionExtractor.extractChangedSection(
            prevHtmlStr,
            currHtmlStr,
            significantChanges
          )
          
          logger.info(`✅ Secciones extraídas: ${extractedSections.sections.length}`)
          logger.info(`📊 ${extractedSections.summary}`)
          
          // Preparar datos optimizados para la IA
          const aiPayload = sectionExtractor.prepareForAI(extractedSections)
          logger.info(`📦 Datos preparados para IA: ${aiPayload.estimatedTokens} tokens estimados`)
          
        } catch (extractError) {
          logger.error('❌ Error extrayendo secciones:', extractError)
          // Continuar sin extracción de secciones
        }
      }

      // Extraer fragmentos de HTML alrededor de los cambios para contexto de IA
      const htmlSnippets = this.extractHTMLSnippets(prevHtmlStr, currHtmlStr, significantChanges)

      return {
        changes: significantChanges,
        changeCount: significantChanges.length,
        changePercentage: changePercentage,
        totalLines: totalChars, // Ahora representa caracteres totales
        changedLines: changedChars, // Ahora representa caracteres cambiados
        severity: severity,
        currentHtml: currHtmlStr,
        changeSummary: changeSummary,
        normalizedComparison: true,
        extractedSections: extractedSections, // 🆕 Secciones específicas
        aiAnalysis: aiAnalysis, // 🆕 Análisis de IA (si está disponible)
        htmlSnippets: htmlSnippets // 🆕 Fragmentos HTML para contexto de IA
      }
    } catch (error) {
      logger.error('❌ Error comparando versiones:', error)
      throw new AppError('Error comparando versiones', 500)
    }
  }

  /**
   * Clasificar tipo de cambio basado en el contenido
   */
  classifyChangeType(changes, changeSummary = '') {
    // Convertir a string para análisis
    const summary = changeSummary.toLowerCase()
    const changesText = changes.map(c => c.value).join(' ').toLowerCase()
    
    // Palabras clave para cada categoría
    const keywords = {
      pricing: ['precio', 'price', '$', 'plan', 'mes', 'month', 'año', 'year', 'descuento', 'discount', 'gratis', 'free', 'pago', 'payment', 'subscription', 'suscripción'],
      feature: ['funcionalidad', 'feature', 'función', 'integración', 'integration', 'api', 'herramienta', 'tool', 'nuevo', 'new', 'agregado', 'added', 'lanzamiento', 'launch'],
      design: ['diseño', 'design', 'color', 'estilo', 'style', 'tema', 'theme', 'interfaz', 'interface', 'ui', 'ux', 'layout', 'css', 'imagen', 'image'],
      content: ['contenido', 'content', 'texto', 'text', 'artículo', 'article', 'blog', 'página', 'page', 'sección', 'section', 'título', 'title', 'descripción', 'description']
    }
    
    // Contar coincidencias para cada categoría
    const scores = {
      pricing: 0,
      feature: 0,
      design: 0,
      content: 0,
      other: 0
    }
    
    // Analizar summary
    for (const [category, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (summary.includes(word)) scores[category]++
        if (changesText.includes(word)) scores[category] += 0.5
      }
    }
    
    // Encontrar la categoría con mayor score
    const maxCategory = Object.entries(scores).reduce((max, [category, score]) => {
      return score > max.score ? { category, score } : max
    }, { category: 'other', score: 0 })
    
    logger.info('🏷️  Clasificación automática de cambio:', {
      changeType: maxCategory.category,
      scores,
      summary: summary.substring(0, 100)
    })
    
    return maxCategory.category
  }

  /**
   * Crear nueva versión
   */
  async createNewVersion (competitorId, comparison, options = {}) {
    try {
      const { Snapshot } = require('../models')
      const { Competitor } = require('../models')
      
      // Obtener última versión de la base de datos
      const lastSnapshot = await Snapshot.findOne({
        where: {
          competitorId: competitorId,
          isCurrent: true
        },
        order: [['versionNumber', 'DESC']]
      })
      
      const newVersionNumber = lastSnapshot ? lastSnapshot.versionNumber + 1 : 1
      
      // Determinar si debe ser versión completa
      const shouldBeFullVersion = newVersionNumber === 1 || (newVersionNumber % this.config.fullVersionInterval) === 0
      
      // Clasificar automáticamente el tipo de cambio
      const changeType = this.classifyChangeType(comparison.changes || [], comparison.changeSummary || '')
      
      // Marcar versión anterior como no actual
      if (lastSnapshot) {
        await lastSnapshot.update({ isCurrent: false })
      }
      
      // 🤖 Análisis de IA (opcional, solo si se solicita)
      let aiAnalysisData = null
      if (options.enableAI && comparison.extractedSections) {
        try {
          logger.info('🤖 Iniciando análisis de IA...')
          const competitor = await Competitor.findByPk(competitorId)
          
          const aiPayload = sectionExtractor.prepareForAI(comparison.extractedSections)
          
          aiAnalysisData = await aiService.analyzeChanges({
            competitorName: competitor?.name || 'Desconocido',
            url: competitor?.url || '',
            date: new Date().toISOString(),
            changeType: changeType,
            severity: comparison.severity,
            totalChanges: comparison.changeCount,
            changeSummary: comparison.changeSummary,
            changes: comparison.changes,
            sections: aiPayload.data.sections,
            htmlSnippets: comparison.htmlSnippets
          })
          
          logger.info('✅ Análisis de IA completado', {
            urgencia: aiAnalysisData.urgencia,
            recomendaciones: aiAnalysisData.recomendaciones?.length || 0
          })
        } catch (aiError) {
          logger.error('❌ Error en análisis de IA:', aiError)
          // Continuar sin análisis de IA
        }
      }
      
      // Crear nueva versión en la base de datos
      const snapshot = await Snapshot.create({
        competitorId: competitorId,
        versionNumber: newVersionNumber,
        fullHtml: shouldBeFullVersion ? comparison.currentHtml : null, // Solo guardar HTML completo si es versión completa
        isFullVersion: shouldBeFullVersion,
        isCurrent: true,
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage,
        severity: comparison.severity,
        changeType: changeType,
        changeSummary: comparison.changeSummary,
        // 🆕 Guardar secciones extraídas y análisis de IA
        metadata: {
          extractedSections: comparison.extractedSections ? {
            summary: comparison.extractedSections.summary,
            sectionsCount: comparison.extractedSections.sections.length,
            sectionTypes: comparison.extractedSections.sections.map(s => s.sectionType)
          } : null,
          aiAnalysis: aiAnalysisData
        }
      })

      // Actualizar contador de versiones del competidor
      await Competitor.update(
        { 
          totalVersions: newVersionNumber,
          lastChangeAt: new Date()
        },
        { where: { id: competitorId } }
      )

      logger.info(`Nueva versión creada para competidor ${competitorId}:`, {
        snapshotId: snapshot.id,
        versionNumber: snapshot.versionNumber,
        changeCount: snapshot.changeCount,
        severity: snapshot.severity,
        changeType: snapshot.changeType,
        isFullVersion: shouldBeFullVersion,
        htmlLength: shouldBeFullVersion ? comparison.currentHtml.length : 0,
        storageType: shouldBeFullVersion ? 'FULL' : 'DIFF'
      })

      return snapshot
    } catch (error) {
      logger.error('Error creando nueva versión:', error)
      throw new AppError('Error creando nueva versión', 500)
    }
  }

  /**
   * Guardar diferencias entre versiones
   */
  async saveDifferences (fromSnapshotId, toSnapshotId, comparison) {
    try {
      const { SnapshotDiff } = require('../models')

      const diffData = {
        changes: comparison.changes,
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage,
        totalLines: comparison.totalLines,
        changedLines: comparison.changedLines,
        timestamp: new Date().toISOString()
      }

      // Guardar en base de datos
      const snapshotDiff = await SnapshotDiff.create({
        fromSnapshotId: fromSnapshotId,
        toSnapshotId: toSnapshotId,
        diffData: diffData,
        changeSummary: this.generateChangeSummary(comparison.changes),
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage
      })

      logger.info(`Diferencias guardadas entre snapshots ${fromSnapshotId} → ${toSnapshotId}:`, {
        diffId: snapshotDiff.id,
        changeCount: snapshotDiff.changeCount,
        changePercentage: snapshotDiff.changePercentage
      })

      // Crear metadatos de cambio
      await this.createChangeMetadata(
        toSnapshotId, 
        comparison.severity, 
        this.extractAffectedSections(comparison.changes),
        comparison.severity
      )

      return snapshotDiff
    } catch (error) {
      logger.error('Error guardando diferencias:', error)
      throw new AppError('Error guardando diferencias', 500)
    }
  }

  /**
   * Limpiar versiones antiguas manteniendo integridad
   */
  async cleanupOldVersions (competitorId) {
    try {
      // TODO: Implementar lógica de limpieza
      logger.info(`Limpieza de versiones para competidor ${competitorId}`)
    } catch (error) {
      logger.error('Error en limpieza de versiones:', error)
    }
  }

  /**
   * Obtener HTML de un snapshot
   */
  async getHTMLFromSnapshot (snapshot) {
    if (snapshot.fullHtml) {
      const html = snapshot.fullHtml
      const htmlStr = typeof html === 'string' ? html : String(html || '')
      
      if (htmlStr.length === 0) {
        logger.warn('⚠️  HTML del snapshot #' + snapshot.versionNumber + ' está vacío')
      }
      
      return htmlStr
    }

    logger.warn('⚠️  Snapshot #' + snapshot.versionNumber + ' sin HTML, reconstruyendo...')
    return await this.reconstructHTMLFromDiffs(snapshot.id)
  }

  /**
   * Reconstruir HTML desde diferencias
   */
  async reconstructHTMLFromDiffs (snapshotId) {
    try {
      const { Snapshot, SnapshotDiff } = require('../models')
      const { Op } = require('sequelize')

      logger.info(`🔧 Reconstruyendo HTML para snapshot ${snapshotId}`)

      // 1. Obtener el snapshot objetivo
      const targetSnapshot = await Snapshot.findByPk(snapshotId)
      if (!targetSnapshot) {
        throw new AppError('Snapshot no encontrado', 404)
      }

      // 2. Encontrar la versión completa más cercana hacia atrás
      const lastFullVersion = await Snapshot.findOne({
        where: {
          competitorId: targetSnapshot.competitorId,
          versionNumber: { [Op.lte]: targetSnapshot.versionNumber },
          isFullVersion: true
        },
        order: [['versionNumber', 'DESC']]
      })

      if (!lastFullVersion) {
        throw new AppError('No se encontró versión completa base para reconstrucción', 404)
      }

      // Si la versión completa es la misma que buscamos, retornar directamente
      if (lastFullVersion.id === snapshotId) {
        logger.info(`✅ Snapshot ${snapshotId} ya es versión completa`)
        return lastFullVersion.fullHtml
      }

      logger.info(`📍 Base de reconstrucción: versión ${lastFullVersion.versionNumber} (completa)`)

      // 3. Obtener todos los snapshots entre la versión completa y la objetivo
      const intermediateSnapshots = await Snapshot.findAll({
        where: {
          competitorId: targetSnapshot.competitorId,
          versionNumber: {
            [Op.gt]: lastFullVersion.versionNumber,
            [Op.lte]: targetSnapshot.versionNumber
          }
        },
        order: [['versionNumber', 'ASC']]
      })

      logger.info(`📦 Snapshots intermedios a reconstruir: ${intermediateSnapshots.length}`)

      // 4. Obtener todos los diffs en orden
      let currentHtml = lastFullVersion.fullHtml
      let currentSnapshotId = lastFullVersion.id

      for (const intermediateSnapshot of intermediateSnapshots) {
        // Buscar el diff entre currentSnapshotId y intermediateSnapshot.id
        const diff = await SnapshotDiff.findOne({
          where: {
            fromSnapshotId: currentSnapshotId,
            toSnapshotId: intermediateSnapshot.id
          }
        })

        if (!diff) {
          logger.warn(`⚠️  No se encontró diff entre ${currentSnapshotId} y ${intermediateSnapshot.id}`)
          continue
        }

        // Aplicar cambios
        currentHtml = await this.applyChanges(currentHtml, JSON.stringify(diff.diffData.changes))
        currentSnapshotId = intermediateSnapshot.id

        logger.info(`✓ Aplicado diff para versión ${intermediateSnapshot.versionNumber}`)
      }

      logger.info(`✅ HTML reconstruido exitosamente para snapshot ${snapshotId}`)
      return currentHtml
    } catch (error) {
      logger.error('Error reconstruyendo HTML:', error)
      throw new AppError('Error reconstruyendo HTML: ' + error.message, 500)
    }
  }

  /**
   * Verificar si hay cambios significativos
   * Un cambio es significativo si:
   * - Tiene al menos 1 palabra/elemento cambiado Y
   * - El porcentaje es >= 0.001% (muy bajo para captar cambios pequeños)
   */
  isSignificantChange (comparison) {
    const minChangePercentage = 0.001 // 0.001% = muy sensible
    const minChangeCount = 1 // Al menos 1 cambio
    
    const isSignificant = comparison.changePercentage >= minChangePercentage && 
                          comparison.changeCount >= minChangeCount
    
    logger.info('🔍 Verificando cambios:', {
      changePercentage: comparison.changePercentage.toFixed(4) + '%',
      changeCount: comparison.changeCount,
      isSignificant: isSignificant ? '✅ SÍ' : '❌ NO',
      severity: comparison.severity
    })
    
    return isSignificant
  }

  /**
   * Calcular severidad del cambio
   * Ajustado para comparación a nivel de palabras/caracteres
   */
  calculateSeverity (changePercentage, changes) {
    // Umbrales ajustados para comparación basada en caracteres
    // (más realistas que comparación por líneas)
    if (changePercentage > 5 || changes.length > 100) {
      return 'critical'
    }
    if (changePercentage > 2 || changes.length > 50) {
      return 'high'
    }
    if (changePercentage > 0.5 || changes.length > 20) {
      return 'medium'
    }
    return 'low'
  }

  /**
   * Generar resumen de cambios con contexto
   */
  generateChangeSummary (changes, fullHtml = '') {
    const summaryParts = []
    
    // Recorrer cambios en orden para obtener contexto
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]
      
      if (change.removed || change.added) {
        const text = change.value.trim()
        if (text.length === 0) continue
        
        // Obtener contexto antes y después del cambio
        let contextBefore = ''
        let contextAfter = ''
        
        // Contexto antes: buscar en el cambio anterior sin modificar
        for (let j = i - 1; j >= 0; j--) {
          if (!changes[j].added && !changes[j].removed) {
            const prevText = changes[j].value
            // Tomar últimas 50 caracteres del contexto anterior
            contextBefore = prevText.substring(Math.max(0, prevText.length - 50))
            break
          }
        }
        
        // Contexto después: buscar en el siguiente cambio sin modificar
        for (let j = i + 1; j < changes.length; j++) {
          if (!changes[j].added && !changes[j].removed) {
            const nextText = changes[j].value
            // Tomar primeros 50 caracteres del contexto siguiente
            contextAfter = nextText.substring(0, Math.min(50, nextText.length))
            break
          }
        }
        
        // Limpiar contexto de HTML
        const cleanBefore = this.cleanHtmlForContext(contextBefore)
        const cleanAfter = this.cleanHtmlForContext(contextAfter)
        const cleanText = text.length > 40 ? text.substring(0, 37) + '...' : text
        
        const type = change.added ? 'Agregado' : 'Eliminado'
        
        // Solo mostrar contexto si hay algo útil
        if (cleanBefore || cleanAfter) {
          summaryParts.push(`${type} "${cleanText}" en: "${cleanBefore}[${cleanText}]${cleanAfter}"`)
        } else {
          summaryParts.push(`${type} "${cleanText}"`)
        }
      }
    }
    
    // Si no hay resumen específico, usar resumen genérico
    if (summaryParts.length === 0) {
      const added = changes.filter(c => c.added).length
      const removed = changes.filter(c => c.removed).length
      return `${added} adiciones, ${removed} eliminaciones`
    }
    
    // Limitar a los primeros 3 cambios para no saturar
    if (summaryParts.length > 3) {
      return summaryParts.slice(0, 3).join('; ') + ` (y ${summaryParts.length - 3} más)`
    }
    
    return summaryParts.join('; ')
  }
  
  
  /**
   * Limpiar HTML para mostrar contexto legible
   */
  cleanHtmlForContext(html) {
    if (!html) return ''
    
    let clean = html
    
    // Remover tags HTML pero mantener el contenido
    clean = clean.replace(/<[^>]+>/g, '')
    
    // Normalizar espacios pero mantener palabras
    clean = clean.replace(/\s+/g, ' ').trim()
    
    // Si el contexto es muy corto, devolverlo tal cual
    if (clean.length <= 40) {
      return clean
    }
    
    // Para contextos largos, tomar solo las últimas palabras (para before) o primeras (para after)
    const words = clean.split(' ')
    if (words.length > 6) {
      // Tomar las últimas/primeras 6 palabras
      return words.slice(-6).join(' ')
    }
    
    return clean
  }

  /**
   * Extraer secciones afectadas
   */
  extractAffectedSections (changes) {
    // TODO: Implementar análisis de secciones afectadas
    return ['content', 'header'] // Placeholder
  }

  /**
   * Crear metadatos de cambio
   */
  async createChangeMetadata (snapshotId, changeType, affectedSections, severity) {
    try {
      // TODO: Guardar en base de datos
      const metadata = {
        id: this.generateId(),
        snapshot_id: snapshotId,
        change_type: changeType,
        affected_sections: affectedSections,
        severity: severity,
        detected_at: new Date()
      }

      return metadata
    } catch (error) {
      logger.error('Error creando metadatos:', error)
    }
  }

  /**
   * Generar diff entre dos HTML (método simplificado para tests)
   */
  generateDiff (oldHtml, newHtml) {
    try {
      const changes = diff.diffWords(oldHtml, newHtml)
      
      const significantChanges = changes.filter(change => {
        if (change.added || change.removed) {
          const trimmedValue = change.value.trim()
          const changeLength = trimmedValue.length
          
          if (changeLength === 0) return false
          
          // Ignorar solo puntuación
          if (changeLength < 3) {
            const isPunctuation = /^[.,;:!?¿¡()\[\]{}"'<>\/\\|@#$%^&*+=~`\-_]+$/.test(trimmedValue)
            if (isPunctuation) return false
          }

          // 🛡️ NOISE FILTER: Ignorar hashes hexadecimales (ej: "4d10dcc0", "a1b2c3d4e5")
          // Detecta strings de 6+ caracteres que son solo hex o combinaciones típicas de IDs generados
          const isHash = /^[a-f0-9]{6,}$/i.test(trimmedValue) || 
                         /^[a-z0-9]{20,}$/i.test(trimmedValue) ||
                         /^[0-9]+$/.test(trimmedValue) // Ignorar cambios puramente numéricos
          
          if (isHash) return false
          
          // Aceptar cualquier cambio con letras o números (que no sea hash)
          const hasContent = /[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/.test(trimmedValue)
          return hasContent
        }
        return false
      })

      const totalChars = newHtml.length
      const changedChars = significantChanges.reduce((acc, change) => {
        return acc + change.value.length
      }, 0)

      const changePercentage = (changedChars / totalChars) * 100

      return {
        changes: significantChanges,
        changeCount: significantChanges.length,
        changePercentage: changePercentage,
        totalLines: totalChars,
        changedLines: changedChars,
        severity: this.calculateSeverity(changePercentage, significantChanges),
        summary: this.generateChangeSummary(significantChanges)
      }
    } catch (error) {
      logger.error('Error generando diff:', error)
      throw new AppError('Error generando diff', 500)
    }
  }

  /**
   * Aplicar cambios a HTML (método simplificado para reconstrucción)
   */
  async applyChanges (baseHtml, changesJson) {
    try {
      const changes = JSON.parse(changesJson)
      let result = baseHtml
      
      // Aplicar cada cambio en orden
      for (const change of changes) {
        if (change.added) {
          result += change.value
        } else if (change.removed) {
          result = result.replace(change.value, '')
        }
      }
      
      return result
    } catch (error) {
      logger.error('Error aplicando cambios:', error)
      return baseHtml
    }
  }

  /**
   * Compresión/Descompresión
   */
  async compressHTML (html) {
    try {
      const buffer = await gzip(html)
      return buffer.toString('base64')
    } catch (error) {
      logger.error('Error comprimiendo HTML:', error)
      return html
    }
  }

  async decompressHTML (compressedHtml) {
    try {
      const buffer = Buffer.from(compressedHtml, 'base64')
      return await gunzip(buffer)
    } catch (error) {
      logger.error('Error descomprimiendo HTML:', error)
      return compressedHtml
    }
  }

  // Alias para compatibilidad con rutas
  async decompressHtml (compressedHtml) {
    return this.decompressHTML(compressedHtml)
  }

  /**
   * Verificar si el HTML está comprimido
   */
  isCompressedHTML(html) {
    // HTML comprimido es base64 y no contiene tags HTML típicos
    if (typeof html !== 'string') return false
    
    // Si contiene tags HTML, no está comprimido
    if (html.includes('<html') || html.includes('<head') || html.includes('<body')) {
      return false
    }
    
    // Si es base64 válido y no contiene HTML, está comprimido
    try {
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
      return base64Regex.test(html) && html.length > 100
    } catch {
      return false
    }
  }

  /**
   * Normalizar HTML para eliminar diferencias irrelevantes
   */
  normalizeHTML(html) {
    if (!html || typeof html !== 'string') return ''
    
    let normalized = html
    
    // 1. Remover scripts completos (pueden cambiar entre cargas)
    normalized = normalized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    
    // 🛡️ 1b. Remover tags <style> completos (CSS dinámico)
    normalized = normalized.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')

    // 🛡️ 1c. Remover inputs ocultos (tokens CSRF, viewstates, etc.)
    normalized = normalized.replace(/<input[^>]*type=["']hidden["'][^>]*>/gi, '')

    // 2. Remover noscript tags
    normalized = normalized.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    
    // 3. Remover comentarios HTML
    normalized = normalized.replace(/<!--[\s\S]*?-->/g, '')
    
    // 4. Remover timestamps dinámicos (múltiples formatos)
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[TIMESTAMP]')
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, '[TIMESTAMP]')
    normalized = normalized.replace(/\d{13,}/g, '[UNIX_TIMESTAMP]')
    
    // 5. Remover IDs únicos y hashes (React, Next.js, etc.)
    normalized = normalized.replace(/__className_[a-f0-9]+/g, '__className_[ID]')
    normalized = normalized.replace(/__nextjs_[a-f0-9]+/g, '__nextjs_[ID]')
    normalized = normalized.replace(/id="[a-f0-9]{8,}"/gi, 'id="[HASH]"')
    normalized = normalized.replace(/class="[^"]*[a-f0-9]{8,}[^"]*"/gi, 'class="[HASH_CLASS]"')
    
    // 6. Remover TODOS los atributos data-* (suelen ser dinámicos)
    normalized = normalized.replace(/\s*data-[a-z0-9-]+="[^"]*"/gi, '')
    
    // 7. Remover atributos aria-* dinámicos
    normalized = normalized.replace(/\s*aria-describedby="[^"]*"/gi, '')
    normalized = normalized.replace(/\s*aria-labelledby="[^"]*"/gi, '')
    normalized = normalized.replace(/\s*aria-controls="[^"]*"/gi, '')
    
    // 8. Remover atributos de estilo inline (pueden variar)
    normalized = normalized.replace(/\s*style="[^"]*"/gi, '')
    
    // 9. Normalizar espacios en blanco
    normalized = normalized.replace(/\s+/g, ' ')
    normalized = normalized.replace(/>\s+</g, '><')
    normalized = normalized.replace(/\s+>/g, '>')
    normalized = normalized.replace(/<\s+/g, '<')
    
    // 10. Remover meta tags dinámicos (csrf, tokens, etc.)
    normalized = normalized.replace(/<meta[^>]*name=["']csrf[^>]*>/gi, '')
    normalized = normalized.replace(/<meta[^>]*name=["']token[^>]*>/gi, '')
    normalized = normalized.replace(/<meta[^>]*property=["']og:updated_time[^>]*>/gi, '')
    
    // 11. Normalizar URLs con query strings de cache busting
    normalized = normalized.replace(/\?v=\d+/g, '?v=[VERSION]')
    normalized = normalized.replace(/\?t=\d+/g, '?t=[TIMESTAMP]')
    normalized = normalized.replace(/\?_=\d+/g, '?_=[CACHE]')
    
    // 12. Remover espacios al inicio y final
    normalized = normalized.trim()
    
    const reduction = html.length - normalized.length
    const reductionPercent = (reduction / html.length * 100).toFixed(1)
    
    logger.info('✅ Normalizado: ' + html.length + ' → ' + normalized.length + ' (' + reductionPercent + '% reducido)')
    
    return normalized
  }

  /**
   * Guardar información de debug en archivo
   */
  async saveDebugInfo(debugData) {
    try {
      const fs = require('fs').promises
      const path = require('path')
      
      const debugDir = path.join(__dirname, '..', '..', 'logs')
      const debugFile = path.join(debugDir, 'monitoring-debug.json')
      
      // Crear directorio si no existe
      try {
        await fs.mkdir(debugDir, { recursive: true })
      } catch (err) {
        // Directorio ya existe
      }
      
      // Leer archivo existente o crear array vacío
      let debugLogs = []
      try {
        const existingData = await fs.readFile(debugFile, 'utf8')
        debugLogs = JSON.parse(existingData)
      } catch (err) {
        // Archivo no existe, usar array vacío
      }
      
      // Agregar nuevo log
      debugLogs.push(debugData)
      
      // Mantener solo los últimos 50 logs
      if (debugLogs.length > 50) {
        debugLogs = debugLogs.slice(-50)
      }
      
      // Guardar archivo principal de debug
      await fs.writeFile(debugFile, JSON.stringify(debugLogs, null, 2))
      
      logger.debug('📝 Debug guardado (' + debugLogs.length + ' logs)')
      
      // Guardar muestras de HTML completas para análisis detallado
      if (debugData.originalHtml || debugData.normalizedHtml) {
        const timestamp = new Date().getTime()
        
        // Guardar HTML anterior original completo
        if (debugData.originalHtml?.previousFull) {
          const prevOriginalFile = path.join(debugDir, `html-previous-original-${timestamp}.html`)
          await fs.writeFile(prevOriginalFile, debugData.originalHtml.previousFull || '')
        }
        
        // Guardar HTML actual original completo
        if (debugData.originalHtml?.currentFull) {
          const currOriginalFile = path.join(debugDir, `html-current-original-${timestamp}.html`)
          await fs.writeFile(currOriginalFile, debugData.originalHtml.currentFull || '')
        }
        
        // Guardar HTML anterior normalizado completo
        if (debugData.normalizedHtml?.previousFull) {
          const prevNormalizedFile = path.join(debugDir, `html-previous-normalized-${timestamp}.html`)
          await fs.writeFile(prevNormalizedFile, debugData.normalizedHtml.previousFull || '')
        }
        
        // Guardar HTML actual normalizado completo
        if (debugData.normalizedHtml?.currentFull) {
          const currNormalizedFile = path.join(debugDir, `html-current-normalized-${timestamp}.html`)
          await fs.writeFile(currNormalizedFile, debugData.normalizedHtml.currentFull || '')
        }
        
        logger.debug('📄 4 archivos HTML guardados en logs/')
        
        // Crear archivo de resumen de comparación
        const summaryFile = path.join(debugDir, `comparison-summary-${timestamp}.txt`)
        const summary = `
RESUMEN DE COMPARACIÓN - ${new Date().toISOString()}
=========================================================

SNAPSHOT INFO:
  ID: ${debugData.snapshotInfo?.id}
  Version: ${debugData.snapshotInfo?.versionNumber}
  Competitor ID: ${debugData.snapshotInfo?.competitorId}

HTML ORIGINAL:
  Anterior: ${debugData.originalHtml?.previousLength} caracteres
  Actual: ${debugData.originalHtml?.currentLength} caracteres
  Diferencia: ${(debugData.originalHtml?.currentLength || 0) - (debugData.originalHtml?.previousLength || 0)} caracteres

HTML NORMALIZADO:
  Anterior: ${debugData.normalizedHtml?.previousLength} caracteres
  Actual: ${debugData.normalizedHtml?.currentLength} caracteres
  Diferencia: ${(debugData.normalizedHtml?.currentLength || 0) - (debugData.normalizedHtml?.previousLength || 0)} caracteres
  Son idénticos: ${debugData.normalizedHtml?.areIdentical ? 'SÍ ✅' : 'NO ❌'}

ARCHIVOS GENERADOS:
  - html-previous-original-${timestamp}.html
  - html-current-original-${timestamp}.html
  - html-previous-normalized-${timestamp}.html
  - html-current-normalized-${timestamp}.html
  - comparison-summary-${timestamp}.txt

NOTA: Los archivos normalizados son los que se usan para detectar cambios.
      Si son idénticos, NO se reportan cambios aunque los originales difieran.
`
        await fs.writeFile(summaryFile, summary)
      }
      
    } catch (error) {
      logger.error('❌ Error guardando debug info:', error)
    }
  }

  /**
   * Generar ID único
   */
  generateId () {
    return require('crypto').randomUUID()
  }

  /**
   * Crear alerta automática cuando se detectan cambios
   */
  async createChangeAlert (competitorId, newVersion, comparison) {
    try {
      // Obtener información del competidor para el userId
      const { Competitor } = require('../models')
      const competitor = await Competitor.findByPk(competitorId, {
        attributes: ['userId']
      })

      if (!competitor) {
        logger.warn(`No se pudo encontrar competidor ${competitorId} para crear alerta`)
        return
      }

      // Crear alerta usando el servicio de alertas
      await alertService.createChangeAlert({
        userId: competitor.userId,
        competitorId,
        snapshotId: newVersion.id,
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage,
        severity: comparison.severity,
        versionNumber: newVersion.version_number,
        changeSummary: comparison.changeSummary || this.generateChangeSummary(comparison.changes),
        affectedSections: this.extractAffectedSections(comparison.changes)
      })

      logger.info(`Alerta creada para competidor ${competitorId}`, {
        severity: comparison.severity,
        changeCount: comparison.changeCount
      })
    } catch (error) {
      logger.error('Error creando alerta de cambio:', error)
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Obtener snapshot actual (placeholder)
   */
  async getCurrentSnapshot (competitorId) {
    try {
      const { Snapshot } = require('../models')
      
      const snapshot = await Snapshot.findOne({
        where: {
          competitorId: competitorId,
          isCurrent: true
        },
        order: [['created_at', 'DESC']]
      })
      
      if (snapshot) {
        logger.info(`Snapshot encontrado para competidor ${competitorId}:`, {
          snapshotId: snapshot.id,
          versionNumber: snapshot.versionNumber,
          changeCount: snapshot.changeCount,
          severity: snapshot.severity
        })
      } else {
        logger.info(`No se encontró snapshot previo para competidor ${competitorId}`)
      }
      
      return snapshot
    } catch (error) {
      logger.error('Error obteniendo snapshot actual:', error)
      return null
    }
  }

  /**
   * Normalizar URL agregando protocolo si no lo tiene
   */
  normalizeUrl(url) {
    if (!url) return url
    
    // Si ya tiene protocolo, devolver tal como está
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    
    // Agregar https:// por defecto
    return `https://${url}`
  }

  /**
   * Extraer fragmentos de HTML alrededor de los cambios para contexto de IA
   */
  extractHTMLSnippets(prevHtml, currHtml, changes, contextSize = 300) {
    const snippets = []
    
    try {
      // Procesar cada cambio y extraer contexto
      changes.forEach((change, index) => {
        if (!change.added && !change.removed) return
        
        const changeValue = change.value || ''
        const isAddition = change.added
        const isDeletion = change.removed
        
        // Buscar la posición del cambio en el HTML correspondiente
        const sourceHtml = isDeletion ? prevHtml : currHtml
        const position = sourceHtml.indexOf(changeValue)
        
        if (position === -1) return
        
        // Extraer contexto antes y después
        const start = Math.max(0, position - contextSize)
        const end = Math.min(sourceHtml.length, position + changeValue.length + contextSize)
        
        const before = sourceHtml.substring(start, position)
        const after = sourceHtml.substring(position + changeValue.length, end)
        
        snippets.push({
          index: index,
          type: isAddition ? 'added' : 'removed',
          change: changeValue.trim().substring(0, 100), // Limitar tamaño
          contextBefore: before.trim().substring(Math.max(0, before.length - 150)),
          contextAfter: after.trim().substring(0, 150),
          position: position
        })
      })
      
      logger.info(`📄 Extraídos ${snippets.length} fragmentos HTML con contexto`)
      
      return {
        snippets: snippets.slice(0, 5), // Limitar a 5 fragmentos más relevantes
        totalChanges: changes.length
      }
    } catch (error) {
      logger.error('Error extrayendo fragmentos HTML:', error)
      return { snippets: [], totalChanges: 0 }
    }
  }
}

// Crear instancia singleton
const changeDetector = new ChangeDetector()

module.exports = changeDetector
