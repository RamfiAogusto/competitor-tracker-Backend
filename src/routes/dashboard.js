/**
 * Rutas para dashboard y métricas
 * Estadísticas generales y datos para el dashboard
 */

const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../middleware/errorHandler')
const headlessXService = require('../services/headlessXService')
const logger = require('../utils/logger')
const { Competitor, Snapshot, Alert } = require('../models')
const { Op } = require('sequelize')

/**
 * GET /api/dashboard/overview
 * Obtener resumen general del dashboard
 */
router.get('/overview', asyncHandler(async (req, res) => {
  logger.info('Obteniendo resumen del dashboard', {
    userId: req.user.id
  })

  try {
    // Obtener estadísticas básicas
    const totalCompetitors = await Competitor.count({
      where: { userId: req.user.id, isActive: true }
    })

    const activeMonitors = await Competitor.count({
      where: { 
        userId: req.user.id, 
        isActive: true,
        monitoringEnabled: true 
      }
    })

    const totalChanges = await Snapshot.count({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: []
      }],
      where: {
        versionNumber: { [Op.gt]: 1 } // Excluir capturas iniciales
      }
    })

    const criticalAlerts = await Alert.count({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: []
      }],
      where: { severity: 'critical' }
    })

    // Log para debugging
    logger.info('Estadísticas obtenidas del dashboard', {
      userId: req.user.id,
      totalCompetitors,
      activeMonitors,
      totalChanges,
      criticalAlerts
    })

    // Obtener última verificación
    const lastCheck = await Competitor.findOne({
      where: { userId: req.user.id, isActive: true },
      order: [['lastCheckedAt', 'DESC']],
      attributes: ['lastCheckedAt']
    })

    // Obtener cambios recientes para actividad reciente
    const recentChanges = await Snapshot.findAll({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: ['name', 'url']
      }],
      where: {
        versionNumber: { [Op.gt]: 1 }
      },
      order: [['created_at', 'DESC']],
      limit: 5
    })

    // Obtener alertas recientes
    const recentAlerts = await Alert.findAll({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: ['name', 'url']
      }],
      order: [['created_at', 'DESC']],
      limit: 3
    })

    // Construir actividad reciente
    const recentActivity = []
    
    recentChanges.forEach((change, index) => {
      recentActivity.push({
        id: `change_${change.id}`,
        type: 'change_detected',
        competitorName: change.competitor?.name || 'Competidor desconocido',
        message: change.changeSummary || 'Cambios detectados',
        severity: change.severity || 'medium',
        timestamp: change.created_at
      })
    })

    recentAlerts.forEach((alert) => {
      recentActivity.push({
        id: `alert_${alert.id}`,
        type: 'alert_created',
        competitorName: alert.competitor?.name || 'Competidor desconocido',
        message: alert.message || 'Nueva alerta generada',
        severity: alert.severity || 'medium',
        timestamp: alert.created_at
      })
    })

    // Ordenar por timestamp descendente
    recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    const overview = {
      stats: {
        totalCompetitors,
        activeMonitors,
        totalChanges,
        criticalAlerts,
        lastCheck: lastCheck?.lastCheckedAt || null
      },
      trends: {
        // TODO: Implementar tendencias reales
        changesLast7Days: [12, 8, 15, 22, 18, 14, 16],
        alertsLast7Days: [2, 1, 4, 6, 3, 2, 3],
        competitorsAdded: [1, 0, 2, 1, 0, 1, 0]
      },
      recentActivity: recentActivity.slice(0, 5)
    }

    res.json({
      success: true,
      data: overview
    })
  } catch (error) {
    logger.error('Error obteniendo resumen del dashboard:', error)
    throw error
  }
}))

/**
 * GET /api/dashboard/stats
 * Obtener estadísticas detalladas
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { period = '30d', metric = 'all' } = req.query

  logger.info('Obteniendo estadísticas del dashboard', {
    userId: req.user.id,
    period,
    metric
  })

  try {
    // Estadísticas de competidores
    const totalCompetitors = await Competitor.count({
      where: { userId: req.user.id, isActive: true }
    })

    const activeCompetitors = await Competitor.count({
      where: { 
        userId: req.user.id, 
        isActive: true,
        monitoringEnabled: true 
      }
    })

    const inactiveCompetitors = await Competitor.count({
      where: { 
        userId: req.user.id, 
        isActive: true,
        monitoringEnabled: false 
      }
    })

    // Estadísticas de cambios
    const totalChanges = await Snapshot.count({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: []
      }],
      where: {
        versionNumber: { [Op.gt]: 1 }
      }
    })

    // Cambios por severidad
    const changesBySeverity = await Snapshot.findAll({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: []
      }],
      where: {
        versionNumber: { [Op.gt]: 1 }
      },
      attributes: [
        'severity',
        [Sequelize.fn('COUNT', Sequelize.col('Snapshot.id')), 'count']
      ],
      group: ['severity']
    })

    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    changesBySeverity.forEach(item => {
      const severity = item.dataValues.severity || 'low'
      severityCounts[severity] = parseInt(item.dataValues.count)
    })

    // Estadísticas de alertas
    const totalAlerts = await Alert.count({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: []
      }]
    })

    const unreadAlerts = await Alert.count({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: []
      }],
      where: { readAt: null }
    })

    // Alertas por severidad
    const alertsBySeverity = await Alert.findAll({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: []
      }],
      attributes: [
        'severity',
        [Sequelize.fn('COUNT', Sequelize.col('Alert.id')), 'count']
      ],
      group: ['severity']
    })

    const alertSeverityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    alertsBySeverity.forEach(item => {
      const severity = item.dataValues.severity || 'low'
      alertSeverityCounts[severity] = parseInt(item.dataValues.count)
    })

    const stats = {
      period,
      competitors: {
        total: totalCompetitors,
        active: activeCompetitors,
        inactive: inactiveCompetitors,
        addedThisPeriod: 0 // TODO: Implementar cálculo por período
      },
      changes: {
        total: totalChanges,
        bySeverity: severityCounts,
        byType: {
          content_change: totalChanges, // TODO: Implementar detección de tipos
          price_change: 0,
          new_page: 0,
          page_removed: 0,
          layout_change: 0
        }
      },
      alerts: {
        total: totalAlerts,
        unread: unreadAlerts,
        bySeverity: alertSeverityCounts
      },
      performance: {
        averageResponseTime: 2.3, // TODO: Implementar métricas reales
        successRate: 98.5,
        lastUptime: '99.9%'
      }
    }

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Error obteniendo estadísticas del dashboard:', error)
    throw error
  }
}))

/**
 * GET /api/dashboard/competitors/top-changes
 * Obtener competidores con más cambios
 */
router.get('/competitors/top-changes', asyncHandler(async (req, res) => {
  const { limit = 10, period = '30d' } = req.query

  logger.info('Obteniendo competidores con más cambios', {
    userId: req.user.id,
    limit,
    period
  })

  try {
    // Obtener competidores con conteo de cambios
    const topCompetitors = await Competitor.findAll({
      where: { userId: req.user.id, isActive: true },
      include: [{
        model: Snapshot,
        as: 'snapshots',
        where: {
          versionNumber: { [Op.gt]: 1 } // Excluir capturas iniciales
        },
        attributes: ['severity', 'created_at'],
        required: false
      }],
      attributes: [
        'id',
        'name', 
        'url',
        'priority',
        'monitoringEnabled',
        'lastCheckedAt',
        'lastChangeAt'
      ]
    })

    // Procesar datos para obtener estadísticas
    const competitorsWithStats = topCompetitors.map(competitor => {
      const changes = competitor.snapshots || []
      const totalChanges = changes.length
      const criticalChanges = changes.filter(s => s.severity === 'critical').length
      const highChanges = changes.filter(s => s.severity === 'high').length
      
      // Obtener último cambio
      const lastChange = changes.length > 0 
        ? changes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
        : null

      // Calcular tendencia (simplificado)
      const recentChanges = changes.filter(s => {
        const changeDate = new Date(s.created_at)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        return changeDate > weekAgo
      }).length

      const olderChanges = totalChanges - recentChanges
      let changeTrend = 'stable'
      if (recentChanges > olderChanges) changeTrend = 'increasing'
      else if (recentChanges < olderChanges) changeTrend = 'decreasing'

      return {
        id: competitor.id,
        name: competitor.name,
        url: competitor.url,
        totalChanges,
        criticalChanges,
        highChanges,
        lastChange,
        changeTrend,
        priority: competitor.priority || 'medium',
        monitoringEnabled: competitor.monitoringEnabled
      }
    })

    // Ordenar por total de cambios descendente
    competitorsWithStats.sort((a, b) => b.totalChanges - a.totalChanges)

    res.json({
      success: true,
      data: competitorsWithStats.slice(0, parseInt(limit))
    })
  } catch (error) {
    logger.error('Error obteniendo competidores con más cambios:', error)
    throw error
  }
}))

/**
 * GET /api/dashboard/recent-changes
 * Obtener cambios recientes
 */
router.get('/recent-changes', asyncHandler(async (req, res) => {
  const { limit = 20, severity } = req.query

  logger.info('Obteniendo cambios recientes', {
    userId: req.user.id,
    limit,
    severity
  })

  try {
    const whereClause = {
      versionNumber: { [Op.gt]: 1 } // Excluir capturas iniciales
    }

    // Filtrar por severidad si se especifica
    if (severity) {
      whereClause.severity = severity
    }

    const recentChanges = await Snapshot.findAll({
      include: [{
        model: Competitor,
        as: 'competitor',
        where: { userId: req.user.id, isActive: true },
        attributes: ['id', 'name', 'url']
      }],
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit)
    })

    const formattedChanges = recentChanges.map(change => ({
      id: change.id,
      competitorId: change.competitorId,
      competitorName: change.competitor?.name || 'Competidor desconocido',
      competitorUrl: change.competitor?.url || '',
      versionNumber: change.versionNumber,
      severity: change.severity || 'medium',
      changePercentage: change.changePercentage || 0,
      changeCount: change.changeCount || 0,
      changeSummary: change.changeSummary || 'Cambios detectados',
      changeType: 'content_change', // TODO: Determinar tipo de cambio basado en el contenido
      detectedAt: change.created_at
    }))

    res.json({
      success: true,
      data: formattedChanges
    })
  } catch (error) {
    logger.error('Error obteniendo cambios recientes:', error)
    throw error
  }
}))

/**
 * GET /api/dashboard/alerts/summary
 * Obtener resumen de alertas
 */
router.get('/alerts/summary', asyncHandler(async (req, res) => {
  logger.info('Obteniendo resumen de alertas', {
    userId: req.user.id
  })

  // TODO: Implementar consulta a base de datos
  const alertSummary = {
    total: 45,
    unread: 8,
    bySeverity: {
      critical: 3,
      high: 12,
      medium: 20,
      low: 10
    },
    byType: {
      content_change: 25,
      price_change: 8,
      new_page: 5,
      page_removed: 2,
      error: 5
    },
    recent: [
      {
        id: '1',
        type: 'content_change',
        severity: 'high',
        message: 'Cambios significativos en TechCorp',
        competitorName: 'TechCorp',
        timestamp: new Date().toISOString()
      },
      {
        id: '2',
        type: 'new_page',
        severity: 'medium',
        message: 'Nueva página detectada',
        competitorName: 'StartupXYZ',
        timestamp: new Date(Date.now() - 1800000).toISOString()
      }
    ]
  }

  res.json({
    success: true,
    data: alertSummary
  })
}))

/**
 * GET /api/dashboard/performance
 * Obtener métricas de rendimiento
 */
router.get('/performance', asyncHandler(async (req, res) => {
  const { period = '7d' } = req.query

  logger.info('Obteniendo métricas de rendimiento', {
    userId: req.user.id,
    period
  })

  try {
    // Obtener estado de HeadlessX
    const headlessXStatus = await headlessXService.getUsageStats()

    // TODO: Implementar consultas de rendimiento de la aplicación
    const performance = {
      period,
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      headlessX: headlessXStatus || {
        activeBrowsers: 0,
        maxBrowsers: 5,
        queueLength: 0,
        uptime: 0
      },
      api: {
        averageResponseTime: 245, // ms
        totalRequests: 15420,
        successRate: 98.7,
        errorRate: 1.3
      },
      database: {
        connectionPool: {
          active: 3,
          idle: 2,
          total: 5
        },
        queryPerformance: {
          averageQueryTime: 12, // ms
          slowQueries: 2
        }
      }
    }

    res.json({
      success: true,
      data: performance
    })
  } catch (error) {
    logger.error('Error obteniendo métricas de rendimiento:', error)
    throw error
  }
}))

/**
 * GET /api/dashboard/trends
 * Obtener datos de tendencias
 */
router.get('/trends', asyncHandler(async (req, res) => {
  const { period = '30d', metric = 'changes' } = req.query

  logger.info('Obteniendo datos de tendencias', {
    userId: req.user.id,
    period,
    metric
  })

  // TODO: Implementar consultas de tendencias
  const trends = {
    period,
    metric,
    data: {
      labels: ['Ene 1', 'Ene 8', 'Ene 15', 'Ene 22', 'Ene 29'],
      datasets: [
        {
          label: 'Cambios detectados',
          data: [12, 19, 8, 25, 18],
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)'
        },
        {
          label: 'Alertas generadas',
          data: [3, 7, 2, 9, 6],
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)'
        }
      ]
    },
    summary: {
      totalChanges: 82,
      totalAlerts: 27,
      averageChangesPerDay: 2.7,
      trendDirection: 'increasing'
    }
  }

  res.json({
    success: true,
    data: trends
  })
}))

/**
 * GET /api/dashboard/health
 * Obtener estado de salud de todos los servicios
 */
router.get('/health', asyncHandler(async (req, res) => {
  logger.info('Verificando estado de salud de servicios', {
    userId: req.user.id
  })

  try {
    // Verificar HeadlessX
    const headlessXHealth = await headlessXService.checkHealth()

    // TODO: Verificar base de datos
    const databaseHealth = { status: 'healthy', responseTime: 5 }

    // TODO: Verificar Redis (si se implementa)
    const redisHealth = { status: 'healthy', responseTime: 2 }

    const healthStatus = {
      overall: 'healthy',
      services: {
        headlessX: headlessXHealth,
        database: databaseHealth,
        redis: redisHealth
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }

    // Determinar estado general
    const allHealthy = Object.values(healthStatus.services).every(
      service => service.status === 'healthy'
    )

    if (!allHealthy) {
      healthStatus.overall = 'degraded'
    }

    res.json({
      success: true,
      data: healthStatus
    })
  } catch (error) {
    logger.error('Error verificando estado de salud:', error)
    res.status(503).json({
      success: false,
      message: 'Error verificando estado de servicios',
      data: {
        overall: 'unhealthy',
        error: error.message
      }
    })
  }
}))

module.exports = router
