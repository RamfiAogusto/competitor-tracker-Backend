/**
 * Servicio de Alertas
 * Gestiona la creación y manejo de alertas automáticas
 */

const { Alert, Competitor } = require('../models')
const logger = require('../utils/logger')
const { AppError } = require('../middleware/errorHandler')
const smartMessageGenerator = require('./smartMessageGenerator')

class AlertService {
  constructor() {
    this.alertTypes = {
      CONTENT_CHANGE: 'content_change',
      PRICE_CHANGE: 'price_change',
      NEW_PAGE: 'new_page',
      PAGE_REMOVED: 'page_removed',
      ERROR: 'error'
    }

    this.severityLevels = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical'
    }
  }

  /**
   * Crear alerta automática cuando se detecta un cambio
   */
  async createChangeAlert(changeData) {
    try {
      const {
        userId,
        competitorId,
        snapshotId,
        changeCount,
        changePercentage,
        severity,
        versionNumber,
        changeSummary,
        affectedSections,
        previousHtml,
        currentHtml
      } = changeData

      // Obtener información del competidor
      const competitor = await Competitor.findByPk(competitorId, {
        attributes: ['name', 'url']
      })

      if (!competitor) {
        throw new AppError({
          message: 'Competidor no encontrado',
          statusCode: 404
        })
      }

      // Generar mensaje inteligente si tenemos HTML anterior y actual
      let smartMessage = null
      if (previousHtml && currentHtml) {
        smartMessage = smartMessageGenerator.generateSmartMessage({
          competitorName: competitor.name,
          changeCount,
          changePercentage,
          severity,
          previousHtml,
          currentHtml,
          changeSummary,
          affectedSections
        })
      }

      // Generar título y mensaje
      const title = this.generateAlertTitle(competitor.name, changeCount, severity)
      const message = smartMessage || this.generateAlertMessage(
        competitor.name,
        changeCount,
        changePercentage,
        severity,
        changeSummary
      )

      // Crear la alerta
      const alert = await Alert.create({
        userId,
        competitorId,
        snapshotId,
        type: this.alertTypes.CONTENT_CHANGE,
        severity,
        status: 'unread',
        title,
        message,
        changeCount,
        changePercentage,
        versionNumber,
        changeSummary,
        affectedSections
      })

      logger.info('Alerta creada exitosamente', {
        alertId: alert.id,
        userId,
        competitorId,
        severity,
        changeCount
      })

      return alert
    } catch (error) {
      logger.error('Error creando alerta de cambio:', error)
      throw new AppError({
        message: 'Error creando alerta',
        statusCode: 500
      })
    }
  }

  /**
   * Crear alerta de error
   */
  async createErrorAlert(errorData) {
    try {
      const {
        userId,
        competitorId,
        errorMessage,
        errorType = 'monitoring_error'
      } = errorData

      const competitor = await Competitor.findByPk(competitorId, {
        attributes: ['name', 'url']
      })

      if (!competitor) {
        throw new AppError({
          message: 'Competidor no encontrado',
          statusCode: 404
        })
      }

      const title = `Error monitoreando ${competitor.name}`
      const message = `Se produjo un error al monitorear ${competitor.name}: ${errorMessage}`

      const alert = await Alert.create({
        userId,
        competitorId,
        type: this.alertTypes.ERROR,
        severity: this.severityLevels.HIGH,
        status: 'unread',
        title,
        message,
        changeCount: 0
      })

      logger.info('Alerta de error creada', {
        alertId: alert.id,
        userId,
        competitorId,
        errorType
      })

      return alert
    } catch (error) {
      logger.error('Error creando alerta de error:', error)
      throw new AppError({
        message: 'Error creando alerta de error',
        statusCode: 500
      })
    }
  }

  /**
   * Generar título de alerta
   */
  generateAlertTitle(competitorName, changeCount, severity) {
    const severityText = this.getSeverityText(severity)
    
    if (changeCount === 1) {
      return `${severityText}: Cambio detectado en ${competitorName}`
    } else {
      return `${severityText}: ${changeCount} cambios detectados en ${competitorName}`
    }
  }

  /**
   * Generar mensaje de alerta
   */
  generateAlertMessage(competitorName, changeCount, changePercentage, severity, changeSummary) {
    const severityText = this.getSeverityText(severity)
    const percentageText = changePercentage ? ` (${Number(changePercentage).toFixed(1)}% del contenido)` : ''
    
    let message = `Se detectaron ${changeCount} cambio${changeCount > 1 ? 's' : ''} en ${competitorName}${percentageText}.\n`
    message += `Severidad: ${severityText}\n`
    
    if (changeSummary) {
      message += `Resumen: ${changeSummary}`
    }

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

  /**
   * Obtener alertas de un usuario
   */
  async getUserAlerts(userId, options = {}) {
    try {
      const {
        status = 'unread',
        severity,
        type,
        competitorId,
        limit = 20,
        offset = 0
      } = options

      const whereClause = { userId }

      if (status !== 'all') {
        whereClause.status = status
      }

      if (severity) {
        whereClause.severity = severity
      }

      if (type) {
        whereClause.type = type
      }

      if (competitorId) {
        whereClause.competitorId = competitorId
      }

      const { count, rows } = await Alert.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Competitor,
            as: 'competitor',
            attributes: ['name', 'url']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      })

      return {
        alerts: rows,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    } catch (error) {
      logger.error('Error obteniendo alertas del usuario:', error)
      throw new AppError({
        message: 'Error obteniendo alertas',
        statusCode: 500
      })
    }
  }

  /**
   * Marcar alerta como leída
   */
  async markAsRead(alertId, userId) {
    try {
      const alert = await Alert.findOne({
        where: {
          id: alertId,
          userId
        }
      })

      if (!alert) {
        throw new AppError({
          message: 'Alerta no encontrada',
          statusCode: 404
        })
      }

      await alert.update({
        status: 'read',
        readAt: new Date()
      })

      logger.info('Alerta marcada como leída', {
        alertId,
        userId
      })

      return alert
    } catch (error) {
      logger.error('Error marcando alerta como leída:', error)
      throw error
    }
  }

  /**
   * Archivar alerta
   */
  async archiveAlert(alertId, userId) {
    try {
      const alert = await Alert.findOne({
        where: {
          id: alertId,
          userId
        }
      })

      if (!alert) {
        throw new AppError({
          message: 'Alerta no encontrada',
          statusCode: 404
        })
      }

      await alert.update({
        status: 'archived',
        archivedAt: new Date()
      })

      logger.info('Alerta archivada', {
        alertId,
        userId
      })

      return alert
    } catch (error) {
      logger.error('Error archivando alerta:', error)
      throw error
    }
  }

  /**
   * Obtener estadísticas de alertas
   */
  async getAlertStats(userId) {
    try {
      const stats = await Alert.findAll({
        where: { userId },
        attributes: [
          'status',
          'severity',
          'type',
          [Alert.sequelize.fn('COUNT', Alert.sequelize.col('id')), 'count']
        ],
        group: ['status', 'severity', 'type'],
        raw: true
      })

      // Procesar estadísticas
      const processedStats = {
        total: 0,
        unread: 0,
        read: 0,
        archived: 0,
        bySeverity: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        },
        byType: {
          content_change: 0,
          price_change: 0,
          new_page: 0,
          page_removed: 0,
          error: 0
        }
      }

      stats.forEach(stat => {
        const count = parseInt(stat.count)
        processedStats.total += count

        if (stat.status === 'unread') processedStats.unread += count
        if (stat.status === 'read') processedStats.read += count
        if (stat.status === 'archived') processedStats.archived += count

        if (processedStats.bySeverity[stat.severity] !== undefined) {
          processedStats.bySeverity[stat.severity] += count
        }

        if (processedStats.byType[stat.type] !== undefined) {
          processedStats.byType[stat.type] += count
        }
      })

      return processedStats
    } catch (error) {
      logger.error('Error obteniendo estadísticas de alertas:', error)
      throw new AppError({
        message: 'Error obteniendo estadísticas',
        statusCode: 500
      })
    }
  }
}

// Crear instancia singleton
const alertService = new AlertService()

module.exports = alertService
