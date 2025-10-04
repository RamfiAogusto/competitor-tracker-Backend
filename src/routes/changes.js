/**
 * Rutas para el manejo de cambios y historial
 */

const express = require('express')
const { Competitor, Snapshot } = require('../models')
const { authenticateToken } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { AppError } = require('../middleware/errorHandler')
const logger = require('../utils/logger')

const router = express.Router()

// Aplicar autenticación a todas las rutas
router.use(authenticateToken)

/**
 * GET /api/changes
 * Obtener lista global de cambios con filtros
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    competitorId,
    type,
    severity,
    sortBy = 'created_at',
    sortOrder = 'DESC',
    startDate,
    endDate
  } = req.query

  logger.info('Obteniendo lista de cambios', {
    userId: req.user.id,
    filters: { search, competitorId, type, severity, sortBy, sortOrder }
  })

  try {
    // Configurar paginación
    const limitNum = Math.min(parseInt(limit), 100) // Máximo 100 por página
    const offset = (parseInt(page) - 1) * limitNum

    // Construir condiciones WHERE
    const whereConditions = {}

    // Filtro por competidor
    if (competitorId) {
      whereConditions.competitorId = competitorId
    }

    // Filtro por severidad
    if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) {
      whereConditions.severity = severity
    }

    // Filtro por tipo (basado en changeSummary)
    if (type) {
      whereConditions.changeSummary = {
        [require('sequelize').Op.iLike]: `%${type}%`
      }
    }

    // Filtro por fecha
    if (startDate || endDate) {
      whereConditions.created_at = {}
      if (startDate) {
        whereConditions.created_at[require('sequelize').Op.gte] = new Date(startDate)
      }
      if (endDate) {
        whereConditions.created_at[require('sequelize').Op.lte] = new Date(endDate)
      }
    }

    // Validar campos de ordenamiento
    const allowedSortFields = ['created_at', 'versionNumber', 'changeCount', 'severity', 'changePercentage']
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at'
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    // Ejecutar consulta con paginación
    const { count, rows } = await Snapshot.findAndCountAll({
      where: whereConditions,
      limit: limitNum,
      offset: offset,
      order: [[sortField, sortDirection]],
      include: [
        {
          model: Competitor,
          as: 'competitor',
          required: true,
          where: {
            userId: req.user.id
          },
          attributes: ['id', 'name', 'url']
        }
      ],
      attributes: [
        'id',
        'competitorId',
        'versionNumber',
        'changeCount',
        'changePercentage',
        'severity',
        'changeSummary',
        'isFullVersion',
        'isCurrent',
        'created_at'
      ]
    })

    // Transformar datos para incluir información del competidor
    const changes = rows.map(snapshot => {
      const changeData = snapshot.toJSON()
      
      // Generar título y descripción basado en changeSummary
      const summary = changeData.changeSummary || 'Cambios detectados'
      const title = summary.length > 50 ? summary.substring(0, 50) + '...' : summary
      const description = `Detectados ${changeData.changeCount} cambios (${changeData.changePercentage}%)`
      
      // Determinar tipo basado en changeSummary
      let type = 'other'
      const summaryLower = summary.toLowerCase()
      if (summaryLower.includes('price') || summaryLower.includes('pricing') || summaryLower.includes('cost')) {
        type = 'pricing'
      } else if (summaryLower.includes('feature') || summaryLower.includes('funcionalidad')) {
        type = 'features'
      } else if (summaryLower.includes('design') || summaryLower.includes('style') || summaryLower.includes('color')) {
        type = 'design'
      } else if (summaryLower.includes('content') || summaryLower.includes('text') || summaryLower.includes('blog')) {
        type = 'content'
      }

      return {
        id: changeData.id,
        competitorId: changeData.competitorId,
        competitorName: changeData.competitor?.name || 'Competidor desconocido',
        competitorUrl: changeData.competitor?.url || '',
        versionNumber: changeData.versionNumber,
        title,
        description,
        type,
        severity: changeData.severity,
        changeCount: changeData.changeCount,
        changePercentage: changeData.changePercentage,
        changeSummary: changeData.changeSummary,
        timestamp: changeData.created_at,
        date: formatDate(changeData.created_at),
        isFullVersion: changeData.isFullVersion,
        isCurrent: changeData.isCurrent
      }
    })

    logger.info('Cambios obtenidos exitosamente', {
      userId: req.user.id,
      totalCount: count,
      returnedCount: changes.length,
      page: parseInt(page)
    })

    res.json({
      success: true,
      data: changes,
      pagination: {
        limit: limitNum,
        offset: offset,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limitNum)
      }
    })
  } catch (error) {
    logger.error('Error obteniendo cambios:', error)
    throw error
  }
}))

/**
 * GET /api/changes/stats
 * Obtener estadísticas globales de cambios
 */
router.get('/stats', asyncHandler(async (req, res) => {
  logger.info('Obteniendo estadísticas de cambios', {
    userId: req.user.id
  })

  try {
    // Obtener estadísticas básicas
    const totalChanges = await Snapshot.count({
      include: [
        {
          model: Competitor,
          as: 'competitor',
          required: true,
          where: {
            userId: req.user.id
          }
        }
      ]
    })

    // Cambios por severidad
    const severityStats = await Snapshot.findAll({
      include: [
        {
          model: Competitor,
          as: 'competitor',
          required: true,
          where: {
            userId: req.user.id
          },
          attributes: ['id', 'name']
        }
      ],
      attributes: ['severity', 'competitorId']
    })

    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    const competitorChangeCounts = {}

    severityStats.forEach(snapshot => {
      const severity = snapshot.severity
      severityCounts[severity] = (severityCounts[severity] || 0) + 1

      const competitorId = snapshot.competitorId
      competitorChangeCounts[competitorId] = (competitorChangeCounts[competitorId] || 0) + 1
    })

    // Competidor más activo
    const mostActiveCompetitorId = Object.keys(competitorChangeCounts).reduce((a, b) => 
      competitorChangeCounts[a] > competitorChangeCounts[b] ? a : b, Object.keys(competitorChangeCounts)[0]
    )

    const mostActiveCompetitor = mostActiveCompetitorId ? 
      severityStats.find(s => s.competitorId === mostActiveCompetitorId)?.competitor : 
      { name: 'N/A', changeCount: 0 }

    // Cambios en la última semana
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const changesThisWeek = await Snapshot.count({
      where: {
        created_at: {
          [require('sequelize').Op.gte]: oneWeekAgo
        }
      },
      include: [
        {
          model: Competitor,
          as: 'competitor',
          required: true,
          where: {
            userId: req.user.id
          }
        }
      ]
    })

    // Cambios en las últimas 24 horas
    const oneDayAgo = new Date()
    oneDayAgo.setHours(oneDayAgo.getHours() - 24)

    const changesLast24h = await Snapshot.count({
      where: {
        created_at: {
          [require('sequelize').Op.gte]: oneDayAgo
        }
      },
      include: [
        {
          model: Competitor,
          as: 'competitor',
          required: true,
          where: {
            userId: req.user.id
          }
        }
      ]
    })

    const stats = {
      totalChanges,
      criticalChanges: severityCounts.critical,
      highChanges: severityCounts.high,
      mediumChanges: severityCounts.medium,
      lowChanges: severityCounts.low,
      bySeverity: {
        critical: severityCounts.critical,
        high: severityCounts.high,
        medium: severityCounts.medium,
        low: severityCounts.low
      },
      mostActiveCompetitor: {
        name: mostActiveCompetitor.name || 'N/A',
        changeCount: competitorChangeCounts[mostActiveCompetitorId] || 0
      },
      avgResponseTime: "2.3h", // Simulado por ahora
      changesThisWeek,
      changesLast24h
    }

    logger.info('Estadísticas obtenidas exitosamente', {
      userId: req.user.id,
      stats
    })

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error)
    throw error
  }
}))

/**
 * GET /api/changes/:id
 * Obtener detalles de un cambio específico
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  logger.info('Obteniendo detalles de cambio', {
    userId: req.user.id,
    changeId: id
  })

  try {
    // Buscar el snapshot
    const snapshot = await Snapshot.findOne({
      where: {
        id: id
      },
      include: [
        {
          model: Competitor,
          as: 'competitor',
          required: true,
          where: {
            userId: req.user.id
          },
          attributes: ['id', 'name', 'url']
        }
      ]
    })

    if (!snapshot) {
      throw new AppError({
        message: 'Cambio no encontrado',
        statusCode: 404
      })
    }

    const changeData = snapshot.toJSON()

    // Generar título y descripción
    const summary = changeData.changeSummary || 'Cambios detectados'
    const title = summary.length > 50 ? summary.substring(0, 50) + '...' : summary
    const description = `Detectados ${changeData.changeCount} cambios (${changeData.changePercentage}%)`

    // Determinar tipo
    let type = 'other'
    const summaryLower = summary.toLowerCase()
    if (summaryLower.includes('price') || summaryLower.includes('pricing')) {
      type = 'pricing'
    } else if (summaryLower.includes('feature')) {
      type = 'features'
    } else if (summaryLower.includes('design') || summaryLower.includes('style')) {
      type = 'design'
    } else if (summaryLower.includes('content') || summaryLower.includes('text')) {
      type = 'content'
    }

    // Simular cambios específicos basado en changeSummary
    const changes = generateMockChanges(changeData.changeSummary, changeData.changeCount)

    const changeDetails = {
      id: changeData.id,
      competitorId: changeData.competitorId,
      competitorName: changeData.competitor?.name || 'Competidor desconocido',
      competitorUrl: changeData.competitor?.url || '',
      versionNumber: changeData.versionNumber,
      title,
      description,
      type,
      severity: changeData.severity,
      changeCount: changeData.changeCount,
      changePercentage: changeData.changePercentage,
      changeSummary: changeData.changeSummary,
      timestamp: changeData.created_at,
      date: formatDate(changeData.created_at),
      isFullVersion: changeData.isFullVersion,
      isCurrent: changeData.isCurrent,
      changes
    }

    logger.info('Detalles de cambio obtenidos exitosamente', {
      userId: req.user.id,
      changeId: id,
      competitorName: changeData.competitor?.name || 'Competidor desconocido'
    })

    res.json({
      success: true,
      data: changeDetails
    })
  } catch (error) {
    logger.error('Error obteniendo detalles de cambio:', error)
    throw error
  }
}))

// Funciones helper
function formatTimestamp(date) {
  if (!date) return 'Fecha no disponible'
  
  try {
    // Convertir a Date si es necesario
    const dateObj = date instanceof Date ? date : new Date(date)
    
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida'
    }
    
    const now = new Date()
    const diff = now - dateObj
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Ahora mismo'
    if (minutes < 60) return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`
    if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`
    if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`
    
    return dateObj.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return 'Error de fecha'
  }
}

function formatDate(date) {
  if (!date) return 'Fecha no disponible'
  
  try {
    // Convertir a Date si es necesario
    const dateObj = date instanceof Date ? date : new Date(date)
    
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida'
    }
    
    return dateObj.toISOString().split('T')[0]
  } catch (error) {
    return 'Error de fecha'
  }
}

function generateMockChanges(summary, changeCount) {
  // Simular cambios específicos basado en el resumen
  const changes = []
  
  if (summary && summary.toLowerCase().includes('price')) {
    changes.push({ type: 'added', content: 'New pricing tier added' })
    changes.push({ type: 'modified', content: 'Updated pricing table layout' })
  }
  
  if (summary && summary.toLowerCase().includes('feature')) {
    changes.push({ type: 'added', content: 'New feature announcement' })
    changes.push({ type: 'modified', content: 'Updated features page' })
  }
  
  if (summary && summary.toLowerCase().includes('content')) {
    changes.push({ type: 'modified', content: 'Updated main headline' })
    changes.push({ type: 'added', content: 'New content section' })
  }
  
  // Si no hay cambios específicos, generar genéricos
  if (changes.length === 0) {
    changes.push({ type: 'modified', content: 'Website content updated' })
    changes.push({ type: 'added', content: 'New elements detected' })
  }
  
  return changes.slice(0, Math.min(changeCount, 5)) // Máximo 5 cambios
}

module.exports = router
