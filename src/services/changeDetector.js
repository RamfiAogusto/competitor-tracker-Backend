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

      // 1. Obtener HTML actual
      const currentHtml = await this.getPageHTML(url, options)
      
      // 2. Obtener última versión
      const lastSnapshot = await this.getCurrentSnapshot(competitorId)
      
      if (!lastSnapshot) {
        // Primera captura - guardar versión completa
        logger.info(`Primera captura para competidor ${competitorId}`)
        const initialVersion = await this.captureInitialVersion(competitorId, url, currentHtml)
        
        // Retornar resultado para monitoreo manual
        if (options.isManualCheck) {
          return {
            changesDetected: false,
            alertCreated: false,
            snapshotId: initialVersion.id,
            changeCount: 0,
            severity: 'none',
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
          const newVersion = await this.createNewVersion(competitorId, simulatedComparison)
          
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
        logger.info(`No hay cambios significativos para ${url}`)
        
        // Retornar resultado para monitoreo manual
        if (options.isManualCheck) {
          return {
            changesDetected: false,
            alertCreated: false,
            snapshotId: null,
            changeCount: 0,
            severity: 'none',
            changePercentage: 0,
            changeSummary: 'No se detectaron cambios significativos'
          }
        }
        
        return null
      }

      logger.info(`Cambios detectados para competidor ${competitorId}:`, {
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage,
        severity: comparison.severity
      })

      // 4. Crear nueva versión
      const newVersion = await this.createNewVersion(competitorId, comparison)
      
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
        logger.info(`Usando HTML simulado para ${url}`)
        return options.html
      }

      // Si se está simulando, usar HTML simulado basado en la versión
      if (options.simulate && options.htmlVersion) {
        logger.info(`Usando HTML simulado versión ${options.htmlVersion} para ${url}`)
        return this.getSimulatedHTML(options.htmlVersion)
      }

      // Usar HeadlessX para obtener HTML real
      logger.info(`Obteniendo HTML real de ${url}`)
      const result = await headlessXService.extractHTML(url, {
        waitFor: options.waitFor || 2000,
        viewport: options.viewport || { width: 1920, height: 1080 },
        removeScripts: true,
        timeout: options.timeout || 30000,
        screenshot: options.screenshot || false,
        fullPage: options.fullPage !== false
      })

      return result.html || result
    } catch (error) {
      logger.error(`Error obteniendo HTML de ${url}:`, error)
      
      // Si es una captura inicial, no fallar completamente
      if (options.isInitialCapture) {
        logger.warn(`Captura inicial falló para ${url}, usando HTML básico`)
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
  async captureInitialVersion (competitorId, url, html) {
    try {
      const { Snapshot } = require('../models')
      
      const compressedHtml = this.config.compressionEnabled 
        ? await this.compressHTML(html) 
        : html

      // Crear snapshot en la base de datos
      const snapshot = await Snapshot.create({
        competitorId: competitorId,
        versionNumber: 1,
        fullHtml: compressedHtml,
        isFullVersion: true,
        isCurrent: true,
        changeCount: 0,
        changePercentage: 0,
        severity: 'low', // Usar 'low' en lugar de 'none' que no existe en el enum
        changeSummary: 'Primera captura - versión inicial'
      })

      logger.info(`Snapshot inicial creado para competidor ${competitorId}:`, {
        snapshotId: snapshot.id,
        versionNumber: snapshot.versionNumber,
        htmlLength: compressedHtml.length
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
      // Obtener HTML anterior (descomprimir si es necesario)
      const previousHtml = await this.getHTMLFromSnapshot(lastSnapshot)
      
      // Generar diferencias usando la librería 'diff'
      const changes = diff.diffLines(previousHtml, currentHtml)
      
      // Filtrar cambios significativos
      const significantChanges = changes.filter(change => {
        if (change.added || change.removed) {
          const changeLength = change.value.trim().length
          return changeLength >= this.config.significantChangeThreshold
        }
        return false
      })

      // Calcular métricas
      const totalLines = currentHtml.split('\n').length
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
        currentHtml: currentHtml
      }
    } catch (error) {
      logger.error('Error comparando versiones:', error)
      throw new AppError('Error comparando versiones', 500)
    }
  }

  /**
   * Crear nueva versión
   */
  async createNewVersion (competitorId, comparison) {
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
      
      // Marcar versión anterior como no actual
      if (lastSnapshot) {
        await lastSnapshot.update({ isCurrent: false })
      }
      
      // Crear nueva versión en la base de datos
      const snapshot = await Snapshot.create({
        competitorId: competitorId,
        versionNumber: newVersionNumber,
        fullHtml: shouldBeFullVersion ? await this.compressHTML(comparison.currentHtml) : null,
        isFullVersion: shouldBeFullVersion,
        isCurrent: true,
        changeCount: comparison.changeCount,
        changePercentage: comparison.changePercentage,
        severity: comparison.severity,
        changeSummary: comparison.changeSummary
      })

      logger.info(`Nueva versión creada para competidor ${competitorId}:`, {
        snapshotId: snapshot.id,
        versionNumber: snapshot.versionNumber,
        changeCount: snapshot.changeCount,
        severity: snapshot.severity
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
    if (snapshot.full_html) {
      return this.config.compressionEnabled 
        ? await this.decompressHTML(snapshot.full_html)
        : snapshot.full_html
    }

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
    return comparison.changePercentage >= (this.config.changeThreshold * 100) &&
           comparison.changeCount > 0
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
}

// Crear instancia singleton
const changeDetector = new ChangeDetector()

module.exports = changeDetector
