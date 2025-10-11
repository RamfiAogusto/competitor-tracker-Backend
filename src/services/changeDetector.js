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

      logger.info(`Cambios detectados para competidor ${competitorId}:`, {
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage,
        severity: comparison.severity,
        changeSummary: comparison.changeSummary
      })

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
      logger.info(`🌐 Obteniendo HTML real de ${url}`, {
        waitFor: options.waitFor || 2000,
        viewport: options.viewport || { width: 1920, height: 1080 },
        removeScripts: true,
        timeout: options.timeout || 30000
      })
      
      const result = await headlessXService.extractHTML(url, {
        waitFor: options.waitFor || 2000,
        viewport: options.viewport || { width: 1920, height: 1080 },
        removeScripts: true,
        timeout: options.timeout || 30000,
        screenshot: options.screenshot || false,
        fullPage: options.fullPage !== false
      })

      logger.info(`✅ HTML obtenido exitosamente de ${url}`, {
        htmlLength: result.html?.length || 0,
        title: result.title,
        contentLength: result.contentLength,
        wasTimeout: result.wasTimeout,
        htmlPreview: result.html?.substring(0, 200)
      })

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
      
      // NUNCA comprimir HTML - siempre guardar tal como viene de HeadlessX
      const htmlToSave = html
      
      logger.info('Guardando HTML sin comprimir (tal como viene de HeadlessX):', {
        originalLength: html.length,
        competitorId,
        isManualCheck: options.isManualCheck,
        htmlPreview: html.substring(0, 100) + '...'
      })

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
        changeSummary: 'Primera captura - versión inicial'
      })

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
      logger.info('🔄 Iniciando comparación de versiones', {
        snapshotId: lastSnapshot.id,
        versionNumber: lastSnapshot.versionNumber
      })
      
      // Obtener HTML anterior (descomprimir si es necesario)
      const previousHtml = await this.getHTMLFromSnapshot(lastSnapshot)
      
      // Validar que ambos HTMLs son strings
      const prevHtmlStr = typeof previousHtml === 'string' ? previousHtml : String(previousHtml || '')
      const currHtmlStr = typeof currentHtml === 'string' ? currentHtml : String(currentHtml || '')
      
      logger.info('📊 Tamaños de HTML originales:', {
        previous: prevHtmlStr.length,
        current: currHtmlStr.length,
        difference: currHtmlStr.length - prevHtmlStr.length,
        differencePercent: ((currHtmlStr.length - prevHtmlStr.length) / prevHtmlStr.length * 100).toFixed(2) + '%'
      })
      
      // Normalizar HTMLs para eliminar diferencias irrelevantes
      logger.info('🔧 Normalizando HTML anterior...')
      const normalizedPrevHtml = this.normalizeHTML(prevHtmlStr)
      
      logger.info('🔧 Normalizando HTML actual...')
      const normalizedCurrHtml = this.normalizeHTML(currHtmlStr)
      
      logger.info('📊 Tamaños después de normalización:', {
        normalizedPrevious: normalizedPrevHtml.length,
        normalizedCurrent: normalizedCurrHtml.length,
        difference: normalizedCurrHtml.length - normalizedPrevHtml.length,
        differencePercent: ((normalizedCurrHtml.length - normalizedPrevHtml.length) / normalizedPrevHtml.length * 100).toFixed(2) + '%',
        areIdentical: normalizedPrevHtml === normalizedCurrHtml
      })

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
        logger.info('✅ HTMLs normalizados son IDÉNTICOS - NO hay cambios reales')
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

      logger.info('⚠️  HTMLs normalizados son DIFERENTES - analizando cambios...')

      // Generar diferencias usando la librería 'diff' con HTMLs normalizados
      const changes = diff.diffLines(normalizedPrevHtml, normalizedCurrHtml)
      
      logger.info('📝 Diferencias detectadas por diff:', {
        totalChanges: changes.length,
        added: changes.filter(c => c.added).length,
        removed: changes.filter(c => c.removed).length,
        unchanged: changes.filter(c => !c.added && !c.removed).length
      })
      
      // Log de los primeros 5 cambios para análisis
      logger.info('🔍 Primeros cambios detectados:')
      changes.slice(0, 5).forEach((change, index) => {
        if (change.added || change.removed) {
          const type = change.added ? '➕ ADDED' : '➖ REMOVED'
          const preview = change.value.trim().substring(0, 150)
          const lines = change.count || 0
          logger.info(`  ${index + 1}. ${type} (${lines} líneas, ${change.value.length} chars):`)
          logger.info(`     "${preview}${change.value.length > 150 ? '...' : ''}"`)
        }
      })
      
      // Filtrar cambios significativos
      const significantChanges = changes.filter(change => {
        if (change.added || change.removed) {
          const changeLength = change.value.trim().length
          const isSignificant = changeLength >= this.config.significantChangeThreshold
          
          if (!isSignificant) {
            logger.debug(`🔻 Cambio descartado (muy pequeño: ${changeLength} chars):`, {
              type: change.added ? 'added' : 'removed',
              content: change.value.trim().substring(0, 50)
            })
          }
          
          return isSignificant
        }
        return false
      })

      logger.info('📊 Filtrado de cambios significativos:', {
        totalChanges: changes.length,
        significantChanges: significantChanges.length,
        filtered: changes.length - significantChanges.length,
        threshold: this.config.significantChangeThreshold + ' caracteres'
      })

      // Calcular métricas
      const totalLines = normalizedCurrHtml.split('\n').length
      const changedLines = significantChanges.reduce((acc, change) => {
        return acc + (change.added ? change.count : 0) + (change.removed ? change.count : 0)
      }, 0)

      const changePercentage = totalLines > 0 ? (changedLines / totalLines) * 100 : 0
      const severity = this.calculateSeverity(changePercentage, significantChanges)

      logger.info('📊 Métricas finales de comparación:', {
        totalLines,
        changedLines,
        changePercentage: changePercentage.toFixed(2) + '%',
        severity,
        significantChanges: significantChanges.length,
        normalizationApplied: true
      })

      // Log detallado de cambios significativos
      if (significantChanges.length > 0) {
        logger.info('⚠️  Cambios SIGNIFICATIVOS detectados:')
        significantChanges.forEach((change, index) => {
          const type = change.added ? '➕ ADDED' : '➖ REMOVED'
          const preview = change.value.trim().substring(0, 100)
          const lines = change.count || 0
          logger.info(`  ${index + 1}. ${type} (${lines} líneas):`)
          logger.info(`     "${preview}${change.value.length > 100 ? '...' : ''}"`)
        })
      } else {
        logger.info('✅ No se detectaron cambios SIGNIFICATIVOS después del filtrado')
      }

      return {
        changes: significantChanges,
        changeCount: significantChanges.length,
        changePercentage: changePercentage,
        totalLines: totalLines,
        changedLines: changedLines,
        severity: severity,
        currentHtml: currHtmlStr,
        normalizedComparison: true
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
      const shouldBeFullVersion = (newVersionNumber % this.config.fullVersionInterval) === 0
      
      // Clasificar automáticamente el tipo de cambio
      const changeType = this.classifyChangeType(comparison.changes || [], comparison.changeSummary || '')
      
      // Marcar versión anterior como no actual
      if (lastSnapshot) {
        await lastSnapshot.update({ isCurrent: false })
      }
      
      // Crear nueva versión en la base de datos
      const snapshot = await Snapshot.create({
        competitorId: competitorId,
        versionNumber: newVersionNumber,
        fullHtml: comparison.currentHtml, // NUNCA comprimir - siempre guardar tal como viene de HeadlessX
        isFullVersion: true, // Siempre marcar como versión completa
        isCurrent: true,
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage,
        severity: comparison.severity,
        changeType: changeType,
        changeSummary: comparison.changeSummary
      })

      logger.info(`Nueva versión creada para competidor ${competitorId}:`, {
        snapshotId: snapshot.id,
        versionNumber: snapshot.versionNumber,
        changeCount: snapshot.changeCount,
        severity: snapshot.severity,
        changeType: snapshot.changeType,
        htmlLength: comparison.currentHtml.length,
        htmlUncompressed: true
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
      const diffData = {
        changes: comparison.changes,
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage,
        totalLines: comparison.totalLines,
        changedLines: comparison.changedLines,
        timestamp: new Date().toISOString()
      }

      // TODO: Guardar en base de datos
      const snapshotDiff = {
        id: this.generateId(),
        from_snapshot_id: fromSnapshotId,
        to_snapshot_id: toSnapshotId,
        diff_data: diffData,
        change_summary: this.generateChangeSummary(comparison.changes),
        change_count: comparison.changeCount,
        change_percentage: comparison.changePercentage,
        created_at: new Date()
      }

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
      // HTML siempre sin comprimir ahora - usar directamente
      const html = snapshot.fullHtml
      
      logger.info('📦 HTML obtenido del snapshot (sin comprimir):', {
        snapshotId: snapshot.id,
        versionNumber: snapshot.versionNumber,
        htmlLength: html.length,
        htmlType: typeof html,
        isString: typeof html === 'string',
        htmlPreview: html.substring(0, 100) + '...'
      })
      
      // Asegurar que es string
      const htmlStr = typeof html === 'string' ? html : String(html || '')
      
      if (htmlStr.length === 0) {
        logger.warn('⚠️  HTML del snapshot está vacío!', {
          snapshotId: snapshot.id,
          versionNumber: snapshot.versionNumber
        })
      }
      
      return htmlStr
    }

    logger.warn('⚠️  Snapshot no tiene fullHtml, intentando reconstruir desde diffs:', {
      snapshotId: snapshot.id,
      versionNumber: snapshot.versionNumber
    })
    
    // Reconstruir desde diferencias
    return await this.reconstructHTMLFromDiffs(snapshot.id)
  }

  /**
   * Reconstruir HTML desde diferencias
   */
  async reconstructHTMLFromDiffs (snapshotId) {
    try {
      // TODO: Implementar reconstrucción desde base de datos
      logger.info(`Reconstruyendo HTML para snapshot ${snapshotId}`)
      return '<html>Reconstructed HTML</html>' // Placeholder
    } catch (error) {
      logger.error('Error reconstruyendo HTML:', error)
      throw new AppError('Error reconstruyendo HTML', 500)
    }
  }

  /**
   * Verificar si hay cambios significativos
   */
  isSignificantChange (comparison) {
    const thresholdPercentage = this.config.changeThreshold * 100
    const isSignificant = comparison.changePercentage >= thresholdPercentage && comparison.changeCount > 0
    
    logger.info('🔍 Verificando si los cambios son significativos:', {
      changePercentage: comparison.changePercentage.toFixed(2) + '%',
      changeCount: comparison.changeCount,
      thresholdPercentage: thresholdPercentage + '%',
      thresholdCount: 0,
      isSignificant: isSignificant ? '✅ SÍ' : '❌ NO',
      severity: comparison.severity
    })
    
    return isSignificant
  }

  /**
   * Calcular severidad del cambio
   */
  calculateSeverity (changePercentage, changes) {
    if (changePercentage > 20 || changes.length > 50) return 'critical'
    if (changePercentage > 10 || changes.length > 20) return 'high'
    if (changePercentage > 5 || changes.length > 10) return 'medium'
    return 'low'
  }

  /**
   * Generar resumen de cambios
   */
  generateChangeSummary (changes) {
    const addedLines = changes.filter(c => c.added).length
    const removedLines = changes.filter(c => c.removed).length
    
    return `${addedLines} líneas añadidas, ${removedLines} líneas eliminadas`
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
      const changes = diff.diffLines(oldHtml, newHtml)
      
      const significantChanges = changes.filter(change => {
        if (change.added || change.removed) {
          const changeLength = change.value.trim().length
          return changeLength >= this.config.significantChangeThreshold
        }
        return false
      })

      const totalLines = newHtml.split('\n').length
      const changedLines = significantChanges.reduce((acc, change) => {
        return acc + (change.added ? change.count : 0) + (change.removed ? change.count : 0)
      }, 0)

      const changePercentage = (changedLines / totalLines) * 100

      return {
        changes: significantChanges,
        changeCount: significantChanges.length,
        changePercentage: changePercentage,
        totalLines: totalLines,
        changedLines: changedLines,
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
    
    logger.info('🔍 Iniciando normalización de HTML', {
      originalLength: html.length,
      firstChars: html.substring(0, 200)
    })
    
    let normalized = html
    
    // 1. Remover scripts completos (pueden cambiar entre cargas)
    const scriptsRemoved = (normalized.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []).length
    normalized = normalized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    logger.info('✂️  Scripts removidos:', scriptsRemoved)
    
    // 2. Remover noscript tags
    normalized = normalized.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    
    // 3. Remover comentarios HTML
    const commentsRemoved = (normalized.match(/<!--[\s\S]*?-->/g) || []).length
    normalized = normalized.replace(/<!--[\s\S]*?-->/g, '')
    logger.info('✂️  Comentarios removidos:', commentsRemoved)
    
    // 4. Remover timestamps dinámicos (múltiples formatos)
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[TIMESTAMP]')
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, '[TIMESTAMP]')
    normalized = normalized.replace(/\d{13,}/g, '[UNIX_TIMESTAMP]') // Unix timestamps
    
    // 5. Remover IDs únicos y hashes (React, Next.js, etc.)
    normalized = normalized.replace(/__className_[a-f0-9]+/g, '__className_[ID]')
    normalized = normalized.replace(/__nextjs_[a-f0-9]+/g, '__nextjs_[ID]')
    normalized = normalized.replace(/id="[a-f0-9]{8,}"/gi, 'id="[HASH]"')
    normalized = normalized.replace(/class="[^"]*[a-f0-9]{8,}[^"]*"/gi, 'class="[HASH_CLASS]"')
    
    // 6. Remover TODOS los atributos data-* (suelen ser dinámicos)
    const dataAttrsRemoved = (normalized.match(/\s*data-[a-z0-9-]+="[^"]*"/gi) || []).length
    normalized = normalized.replace(/\s*data-[a-z0-9-]+="[^"]*"/gi, '')
    logger.info('✂️  Atributos data-* removidos:', dataAttrsRemoved)
    
    // 7. Remover atributos aria-* dinámicos
    normalized = normalized.replace(/\s*aria-describedby="[^"]*"/gi, '')
    normalized = normalized.replace(/\s*aria-labelledby="[^"]*"/gi, '')
    normalized = normalized.replace(/\s*aria-controls="[^"]*"/gi, '')
    
    // 8. Remover atributos de estilo inline (pueden variar)
    const stylesRemoved = (normalized.match(/\s*style="[^"]*"/gi) || []).length
    normalized = normalized.replace(/\s*style="[^"]*"/gi, '')
    logger.info('✂️  Atributos style removidos:', stylesRemoved)
    
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
    const reductionPercent = (reduction / html.length * 100).toFixed(2)
    
    logger.info('✅ Normalización completada:', {
      originalLength: html.length,
      normalizedLength: normalized.length,
      reduction: reduction,
      reductionPercent: `${reductionPercent}%`,
      scriptsRemoved,
      commentsRemoved,
      dataAttrsRemoved,
      stylesRemoved
    })
    
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
      
      logger.info('📝 Debug info guardado en archivo:', {
        file: debugFile,
        totalLogs: debugLogs.length
      })
      
      // Guardar muestras de HTML completas para análisis detallado
      if (debugData.originalHtml || debugData.normalizedHtml) {
        const timestamp = new Date().getTime()
        
        // Guardar HTML anterior original completo
        if (debugData.originalHtml?.previousFull) {
          const prevOriginalFile = path.join(debugDir, `html-previous-original-${timestamp}.html`)
          await fs.writeFile(prevOriginalFile, debugData.originalHtml.previousFull || '')
          logger.info('📄 HTML anterior original completo guardado:', {
            file: prevOriginalFile,
            size: debugData.originalHtml.previousFull.length
          })
        }
        
        // Guardar HTML actual original completo
        if (debugData.originalHtml?.currentFull) {
          const currOriginalFile = path.join(debugDir, `html-current-original-${timestamp}.html`)
          await fs.writeFile(currOriginalFile, debugData.originalHtml.currentFull || '')
          logger.info('📄 HTML actual original completo guardado:', {
            file: currOriginalFile,
            size: debugData.originalHtml.currentFull.length
          })
        }
        
        // Guardar HTML anterior normalizado completo
        if (debugData.normalizedHtml?.previousFull) {
          const prevNormalizedFile = path.join(debugDir, `html-previous-normalized-${timestamp}.html`)
          await fs.writeFile(prevNormalizedFile, debugData.normalizedHtml.previousFull || '')
          logger.info('📄 HTML anterior normalizado completo guardado:', {
            file: prevNormalizedFile,
            size: debugData.normalizedHtml.previousFull.length
          })
        }
        
        // Guardar HTML actual normalizado completo
        if (debugData.normalizedHtml?.currentFull) {
          const currNormalizedFile = path.join(debugDir, `html-current-normalized-${timestamp}.html`)
          await fs.writeFile(currNormalizedFile, debugData.normalizedHtml.currentFull || '')
          logger.info('📄 HTML actual normalizado completo guardado:', {
            file: currNormalizedFile,
            size: debugData.normalizedHtml.currentFull.length
          })
        }
        
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
        logger.info('📄 Resumen de comparación guardado:', summaryFile)
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
        changeSummary: this.generateChangeSummary(comparison.changes),
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
}

// Crear instancia singleton
const changeDetector = new ChangeDetector()

module.exports = changeDetector
