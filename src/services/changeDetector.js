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
const { createError } = require('../middleware/errorHandler')

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
      logger.info(`Iniciando captura de cambio para competidor ${competitorId}`)

      // 1. Obtener HTML actual
      const currentHtml = await this.getPageHTML(url, options)
      
      // 2. Obtener última versión
      const lastSnapshot = await this.getCurrentSnapshot(competitorId)
      
      if (!lastSnapshot) {
        // Primera captura - guardar versión completa
        logger.info(`Primera captura para competidor ${competitorId}`)
        return await this.captureInitialVersion(competitorId, url, currentHtml)
      }

      // 3. Comparar con la versión anterior
      const comparison = await this.compareVersions(lastSnapshot, currentHtml)
      
      if (!this.isSignificantChange(comparison)) {
        logger.info(`No hay cambios significativos para ${url}`)
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
      
      // 6. Limpiar versiones antiguas si es necesario
      await this.cleanupOldVersions(competitorId)
      
      return newVersion
      
    } catch (error) {
      logger.error('Error capturando cambio:', error)
      throw createError('Error capturando cambios', 500)
    }
  }

  /**
   * Obtener HTML de una página usando HeadlessX
   */
  async getPageHTML (url, options = {}) {
    try {
      const result = await headlessXService.extractHTML(url, {
        waitFor: options.waitFor || 2000,
        viewport: options.viewport || { width: 1920, height: 1080 },
        removeScripts: true
      })

      return result.html
    } catch (error) {
      throw createError(`Error obteniendo HTML de ${url}: ${error.message}`, 502)
    }
  }

  /**
   * Captura inicial - versión completa
   */
  async captureInitialVersion (competitorId, url, html) {
    try {
      const compressedHtml = this.config.compressionEnabled 
        ? await this.compressHTML(html) 
        : html

      // TODO: Implementar guardado en base de datos
      const snapshot = {
        id: this.generateId(),
        competitor_id: competitorId,
        version_number: 1,
        full_html: compressedHtml,
        is_full_version: true,
        is_current: true,
        created_at: new Date()
      }

      // Crear metadatos iniciales
      await this.createChangeMetadata(snapshot.id, 'initial', [], 'low')
      
      return snapshot
    } catch (error) {
      logger.error('Error en captura inicial:', error)
      throw createError('Error en captura inicial', 500)
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
      throw createError('Error comparando versiones', 500)
    }
  }

  /**
   * Crear nueva versión
   */
  async createNewVersion (competitorId, comparison) {
    try {
      // TODO: Obtener de base de datos
      const lastSnapshot = { version_number: 1 } // Placeholder
      const newVersionNumber = lastSnapshot.version_number + 1
      
      // Determinar si debe ser versión completa
      const shouldBeFullVersion = (newVersionNumber % this.config.fullVersionInterval) === 0
      
      const snapshot = {
        id: this.generateId(),
        competitor_id: competitorId,
        version_number: newVersionNumber,
        full_html: shouldBeFullVersion ? await this.compressHTML(comparison.currentHtml) : null,
        is_full_version: shouldBeFullVersion,
        is_current: true,
        created_at: new Date()
      }

      // TODO: Guardar en base de datos y marcar versión anterior como no actual

      return snapshot
    } catch (error) {
      logger.error('Error creando nueva versión:', error)
      throw createError('Error creando nueva versión', 500)
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
      throw createError('Error guardando diferencias', 500)
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
      throw createError('Error reconstruyendo HTML', 500)
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
      throw createError('Error generando diff', 500)
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
   * Obtener snapshot actual (placeholder)
   */
  async getCurrentSnapshot (competitorId) {
    // TODO: Implementar consulta a base de datos
    return null
  }
}

// Crear instancia singleton
const changeDetector = new ChangeDetector()

module.exports = changeDetector
