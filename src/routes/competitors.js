/**
 * Rutas para gestión de competidores
 * CRUD completo para competidores
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { validateCompetitor } = require('../middleware/validation')
const changeDetector = require('../services/changeDetector')
const logger = require('../utils/logger')
const { Competitor, Snapshot, Alert } = require('../models')

// Aplicar autenticación a todas las rutas
router.use(authenticateToken)

/**
 * GET /api/competitors
 * Listar todos los competidores del usuario
 */
router.get('/', validateCompetitor.list, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query

  logger.info('Listando competidores', {
    userId: req.user.id,
    page,
    limit,
    search,
    sortBy,
    sortOrder
  })

  try {
    // Configurar paginación
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const offset = (pageNum - 1) * limitNum

    // Construir condiciones de búsqueda
    const whereConditions = {
      userId: req.user.id,
      isActive: true
    }

    // Agregar búsqueda por nombre si se proporciona
    if (search && search.trim()) {
      whereConditions.name = {
        [require('sequelize').Op.iLike]: `%${search.trim()}%`
      }
    }

    // Validar campos de ordenamiento
    const allowedSortFields = ['name', 'url', 'created_at', 'updated_at', 'last_checked_at', 'total_versions']
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at'
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    // Ejecutar consulta con paginación y incluir último snapshot
    const { count, rows } = await Competitor.findAndCountAll({
      where: whereConditions,
      limit: limitNum,
      offset: offset,
      order: [[sortField, sortDirection]],
      attributes: [
        'id', 'name', 'url', 'description', 'monitoringEnabled', 'checkInterval', 
        'priority', 'lastCheckedAt', 'totalVersions', 'lastChangeAt', 'isActive', 
        'created_at', 'updated_at'
      ],
      include: [
        {
          model: Snapshot,
          as: 'lastSnapshot',
          required: false,
          where: {
            isCurrent: true
          },
          attributes: ['id', 'versionNumber', 'changeCount', 'severity', 'created_at']
        }
      ]
    })

    // Transformar datos para incluir información de severidad
    const competitorsWithSeverity = rows.map(competitor => {
      const competitorData = competitor.toJSON()
      
      // Agregar severidad del último cambio
      if (competitorData.lastSnapshot && competitorData.lastSnapshot.length > 0) {
        const lastSnapshot = competitorData.lastSnapshot[0]
        competitorData.severity = lastSnapshot.severity
        competitorData.changeCount = lastSnapshot.changeCount
        competitorData.lastChangeAt = lastSnapshot.created_at
      } else {
        competitorData.severity = 'low'
        competitorData.changeCount = 0
        competitorData.lastChangeAt = null
      }

      // Remover el array de snapshots de la respuesta
      delete competitorData.lastSnapshot
      
      return competitorData
    })

    const totalPages = Math.ceil(count / limitNum)

    res.json({
      success: true,
      data: competitorsWithSeverity,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    })
  } catch (error) {
    logger.error('Error al listar competidores:', error)
    throw error
  }
}))

/**
 * GET /api/competitors/overview
 * Obtener estadísticas de competidores
 */
router.get('/overview', asyncHandler(async (req, res) => {
  logger.info('Obteniendo estadísticas de competidores', {
    userId: req.user.id
  })

  try {
    // Obtener estadísticas básicas
    const totalCompetitors = await Competitor.count({
      where: {
        userId: req.user.id,
        isActive: true
      }
    })

    const activeMonitoring = await Competitor.count({
      where: {
        userId: req.user.id,
        isActive: true,
        monitoringEnabled: true
      }
    })

    const pausedMonitoring = totalCompetitors - activeMonitoring

    // Obtener estadísticas de prioridad
    const priorityStats = await Competitor.findAll({
      where: {
        userId: req.user.id,
        isActive: true
      },
      attributes: ['id', 'priority']
    })

    // Contar por prioridad
    const priorityCounts = {
      high: 0,
      medium: 0,
      low: 0
    }

    priorityStats.forEach(competitor => {
      const priority = competitor.priority || 'medium'
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1
    })

    // Obtener estadísticas de severidad para cambios
    const severityStats = await Competitor.findAll({
      where: {
        userId: req.user.id,
        isActive: true
      },
      include: [
        {
          model: Snapshot,
          as: 'lastSnapshot',
          required: false,
          where: {
            isCurrent: true
          },
          attributes: ['severity']
        }
      ],
      attributes: ['id']
    })

    // Contar por severidad de cambios
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    severityStats.forEach(competitor => {
      const lastSnapshot = competitor.lastSnapshot && competitor.lastSnapshot[0]
      const severity = lastSnapshot ? lastSnapshot.severity : 'low'
      severityCounts[severity] = (severityCounts[severity] || 0) + 1
    })

    // Calcular tiempo promedio de verificación (simulado por ahora)
    const avgCheckTime = "2.3m"

    res.json({
      success: true,
      data: {
        total: totalCompetitors,
        active: activeMonitoring,
        paused: pausedMonitoring,
        highPriority: priorityCounts.high,
        avgCheckTime: avgCheckTime,
        priority: priorityCounts,
        severity: severityCounts
      }
    })
  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error)
    throw error
  }
}))


/**
 * GET /api/competitors/:id/monitoring-status
 * Obtener estado del monitoreo de un competidor
 */
router.get('/:id/monitoring-status', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id } = req.params

  logger.info('Obteniendo estado de monitoreo', {
    userId: req.user.id,
    competitorId: id
  })

  try {
    // Buscar el competidor
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      },
      attributes: ['id', 'name', 'url', 'monitoringEnabled', 'checkInterval', 'lastCheckedAt', 'totalVersions', 'lastChangeAt']
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Calcular próxima captura
    const nextCapture = competitor.lastCheckedAt 
      ? new Date(new Date(competitor.lastCheckedAt).getTime() + competitor.checkInterval * 1000)
      : new Date(Date.now() + competitor.checkInterval * 1000)

    res.json({
      success: true,
      data: {
        id: competitor.id,
        name: competitor.name,
        url: competitor.url,
        monitoringEnabled: competitor.monitoringEnabled,
        checkInterval: competitor.checkInterval,
        lastCheckedAt: competitor.lastCheckedAt,
        nextCapture: nextCapture.toISOString(),
        totalVersions: competitor.totalVersions,
        lastChangeAt: competitor.lastChangeAt,
        status: competitor.monitoringEnabled ? 'active' : 'paused'
      }
    })
  } catch (error) {
    logger.error('Error obteniendo estado de monitoreo:', error)
    throw error
  }
}))

/**
 * GET /api/competitors/:id
 * Obtener un competidor específico
 */
router.get('/:id', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id } = req.params

  logger.info('Obteniendo competidor', {
    userId: req.user.id,
    competitorId: id
  })

  try {
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      },
      attributes: [
        'id', 'name', 'url', 'description', 'monitoringEnabled', 'checkInterval', 
        'priority', 'lastCheckedAt', 'totalVersions', 'lastChangeAt', 'isActive', 
        'created_at', 'updated_at'
      ],
      include: [
        {
          model: Snapshot,
          as: 'lastSnapshot',
          required: false,
          where: {
            isCurrent: true
          },
          attributes: ['id', 'versionNumber', 'changeCount', 'changePercentage', 'severity', 'changeType', 'created_at']
        }
      ]
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Transformar datos para incluir información de severidad
    const competitorData = competitor.toJSON()
    
    // Agregar severidad y changeCount del último cambio
    if (competitorData.lastSnapshot && competitorData.lastSnapshot.length > 0) {
      const lastSnapshot = competitorData.lastSnapshot[0]
      competitorData.severity = lastSnapshot.severity
      competitorData.changeCount = lastSnapshot.changeCount
      competitorData.lastChangeAt = lastSnapshot.created_at
    } else {
      competitorData.severity = 'low'
      competitorData.changeCount = 0
      competitorData.lastChangeAt = null
    }

    // Remover el array de snapshots de la respuesta
    delete competitorData.lastSnapshot

    res.json({
      success: true,
      data: competitorData
    })
  } catch (error) {
    logger.error('Error al obtener competidor:', error)
    throw error
  }
}))

/**
 * POST /api/competitors
 * Crear un nuevo competidor
 */
router.post('/', validateCompetitor.create, asyncHandler(async (req, res) => {
  const { name, url, description, monitoringEnabled = true, checkInterval = 3600, priority } = req.body

  logger.info('Creando competidor', {
    userId: req.user.id,
    name,
    url,
    priority,
    fullBody: req.body
  })

  try {
    // Normalizar la URL para asegurar que tenga protocolo
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    // Verificar que la URL no esté duplicada para este usuario (solo activos)
    const existingCompetitor = await Competitor.findOne({
      where: {
        userId: req.user.id,
        url: normalizedUrl,
        isActive: true
      }
    })


    if (existingCompetitor) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un competidor con esta URL. Por favor, usa una URL diferente.',
        code: 'DUPLICATE_COMPETITOR'
      })
    }

    // Crear el competidor
    const newCompetitor = await Competitor.create({
      userId: req.user.id,
      name,
      url: normalizedUrl,
      description,
      monitoringEnabled,
      checkInterval,
      priority: priority || 'medium'
    })

    // Remover userId de la respuesta
    const responseData = newCompetitor.toJSON()
    delete responseData.userId

    res.status(201).json({
      success: true,
      message: 'Competidor creado exitosamente',
      data: responseData
    })
  } catch (error) {
    logger.error('Error al crear competidor:', error)
    
    // Manejar errores específicos de validación
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => ({
        field: err.path,
        message: err.message
      }))
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        details: validationErrors
      })
    }

    // Manejar error de competidor duplicado
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un competidor con esta URL. Por favor, usa una URL diferente.',
        code: 'DUPLICATE_COMPETITOR'
      })
    }

    throw error
  }
}))

/**
 * PUT /api/competitors/:id
 * Actualizar un competidor
 */
router.put('/:id', validateCompetitor.update, asyncHandler(async (req, res) => {
  const { id } = req.params
  const updateData = req.body

  logger.info('Actualizando competidor', {
    userId: req.user.id,
    competitorId: id,
    updateData
  })

  try {
    // Buscar el competidor
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Si se está actualizando la URL, normalizar y verificar que no esté duplicada
    if (updateData.url && updateData.url !== competitor.url) {
      // Normalizar la URL para asegurar que tenga protocolo
      let normalizedUrl = updateData.url.trim()
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`
      }
      updateData.url = normalizedUrl

      const existingCompetitor = await Competitor.findOne({
        where: {
          userId: req.user.id,
          url: normalizedUrl,
          isActive: true,
          id: { [require('sequelize').Op.ne]: id }
        }
      })

      if (existingCompetitor) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un competidor con esta URL'
        })
      }
    }

    // Actualizar el competidor
    await competitor.update(updateData)

    // Obtener el competidor actualizado
    const updatedCompetitor = await Competitor.findByPk(id, {
      attributes: [
        'id', 'name', 'url', 'description', 'monitoringEnabled', 'checkInterval', 
        'priority', 'lastCheckedAt', 'totalVersions', 'lastChangeAt', 'isActive', 
        'created_at', 'updated_at'
      ],
      include: [
        {
          model: Snapshot,
          as: 'lastSnapshot',
          required: false,
          where: {
            isCurrent: true
          },
          attributes: ['id', 'versionNumber', 'changeCount', 'severity', 'created_at']
        }
      ]
    })

    // Transformar datos para incluir información de severidad
    const competitorData = updatedCompetitor.toJSON()
    
    // Agregar severidad del último cambio
    if (competitorData.lastSnapshot && competitorData.lastSnapshot.length > 0) {
      const lastSnapshot = competitorData.lastSnapshot[0]
      competitorData.severity = lastSnapshot.severity
      competitorData.changeCount = lastSnapshot.changeCount
      competitorData.lastChangeAt = lastSnapshot.created_at
    } else {
      competitorData.severity = 'low'
      competitorData.changeCount = 0
      competitorData.lastChangeAt = null
    }

    // Remover el array de snapshots de la respuesta
    delete competitorData.lastSnapshot

    res.json({
      success: true,
      message: 'Competidor actualizado exitosamente',
      data: competitorData
    })
  } catch (error) {
    logger.error('Error al actualizar competidor:', error)
    
    // Manejar errores específicos de validación
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => ({
        field: err.path,
        message: err.message
      }))
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        details: validationErrors
      })
    }

    throw error
  }
}))

/**
 * DELETE /api/competitors/:id
 * Eliminar un competidor y todos sus datos relacionados
 */
router.delete('/:id', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id } = req.params

  logger.info('Eliminando competidor y datos relacionados', {
    userId: req.user.id,
    competitorId: id
  })

  try {
    // Buscar el competidor
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      },
      include: [
        {
          model: Snapshot,
          as: 'snapshots',
          required: false
        },
        {
          model: Alert,
          as: 'alerts',
          required: false
        }
      ]
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Obtener estadísticas antes de eliminar para el log
    const snapshotCount = competitor.snapshots ? competitor.snapshots.length : 0
    const alertCount = competitor.alerts ? competitor.alerts.length : 0

    logger.info('Datos relacionados encontrados', {
      competitorId: id,
      competitorName: competitor.name,
      snapshots: snapshotCount,
      alerts: alertCount
    })

    // Eliminar físicamente el competidor (esto activará CASCADE para snapshots y alertas)
    await competitor.destroy()

    logger.info('Competidor y datos relacionados eliminados exitosamente', {
      competitorId: id,
      competitorName: competitor.name,
      snapshotsEliminados: snapshotCount,
      alertsEliminadas: alertCount
    })

    res.json({
      success: true,
      message: `Competidor "${competitor.name}" eliminado exitosamente`,
      data: {
        competitorId: id,
        snapshotsEliminados: snapshotCount,
        alertsEliminadas: alertCount
      }
    })
  } catch (error) {
    logger.error('Error al eliminar competidor:', error)
    throw error
  }
}))

/**
 * POST /api/competitors/:id/capture
 * Capturar cambios de un competidor
 */
router.post('/:id/capture', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { options = {} } = req.body

  logger.info('Iniciando captura de cambios', {
    userId: req.user.id,
    competitorId: id,
    options
  })

  try {
    // Obtener datos del competidor de la base de datos
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Si se proporciona HTML simulado, usarlo directamente
    if (options.html && options.simulate) {
      // Crear snapshot simulado directamente
      const { Snapshot } = require('../models')
      
      // Obtener última versión para determinar el número
      const lastSnapshot = await Snapshot.findOne({
        where: { competitorId: id },
        order: [['versionNumber', 'DESC']]
      })
      
      const versionNumber = lastSnapshot ? lastSnapshot.versionNumber + 1 : 1
      
      // Calcular cambios reales comparando con la versión anterior
      let changeCount = 0
      let changePercentage = 0
      let severity = 'low'
      let changeSummary = 'Captura inicial'
      
      if (versionNumber > 1 && lastSnapshot) {
        // Simular detección de cambios basada en diferencias de HTML
        const previousHtml = lastSnapshot.fullHtml || ''
        const currentHtml = options.html
        
        // Contar líneas diferentes (simulación simple)
        const prevLines = previousHtml.split('\n').length
        const currLines = currentHtml.split('\n').length
        const lineDiff = Math.abs(prevLines - currLines)
        
        // Calcular métricas de cambio
        changeCount = Math.max(1, Math.floor(lineDiff / 5)) // Mínimo 1 cambio
        const maxLines = Math.max(prevLines, currLines)
        changePercentage = maxLines > 0 ? Math.min(100, (lineDiff / maxLines) * 100) : 0
        
        // Determinar severidad basada en el porcentaje de cambio
        if (changePercentage > 20 || changeCount > 10) {
          severity = 'critical'
        } else if (changePercentage > 10 || changeCount > 5) {
          severity = 'high'
        } else if (changePercentage > 5 || changeCount > 2) {
          severity = 'medium'
        } else {
          severity = 'low'
        }
        
        changeSummary = `${changeCount} cambios detectados (${changePercentage.toFixed(1)}% del contenido)`
      }
      
      // Crear nuevo snapshot
      const newSnapshot = await Snapshot.create({
        competitorId: id,
        versionNumber: versionNumber,
        fullHtml: options.html,
        isFullVersion: true,
        isCurrent: true,
        changeCount: changeCount,
        changePercentage: changePercentage,
        severity: severity,
        changeSummary: changeSummary
      })
      
      // Marcar versiones anteriores como no actuales
      if (lastSnapshot) {
        await Snapshot.update(
          { isCurrent: false },
          { where: { competitorId: id, id: { [require('sequelize').Op.ne]: newSnapshot.id } } }
        )
      }
      
      // Actualizar estadísticas del competidor
      await Competitor.update(
        { 
          lastCheckedAt: new Date(),
          totalVersions: versionNumber,
          lastChangeAt: versionNumber > 1 ? new Date() : null
        },
        { where: { id: id } }
      )
      
      // Crear alerta si hay cambios significativos (solo para versiones > 1)
      logger.info('Verificando condiciones para crear alerta', {
        versionNumber,
        changeCount: newSnapshot.changeCount,
        shouldCreateAlert: versionNumber > 1 && newSnapshot.changeCount > 0
      })
      
      if (versionNumber > 1 && newSnapshot.changeCount > 0) {
        try {
          logger.info('Creando alerta para simulación', {
            userId: req.user.id,
            competitorId: id,
            changeCount: newSnapshot.changeCount,
            severity: newSnapshot.severity
          })
          
            const alertService = require('../services/alertService')
            const alert = await alertService.createChangeAlert({
              userId: req.user.id,
              competitorId: id,
              snapshotId: newSnapshot.id,
              changeCount: newSnapshot.changeCount,
              changePercentage: newSnapshot.changePercentage,
              severity: newSnapshot.severity,
              versionNumber: newSnapshot.versionNumber,
              changeSummary: `Simulación: ${newSnapshot.changeCount} cambios detectados`,
              affectedSections: ['content', 'navigation'],
              previousHtml: lastSnapshot ? lastSnapshot.fullHtml : null,
              currentHtml: options.html
            })
          
          logger.info('Alerta creada exitosamente', {
            alertId: alert.id,
            competitorId: id,
            severity: newSnapshot.severity,
            changeCount: newSnapshot.changeCount
          })
        } catch (alertError) {
          logger.error('Error creando alerta en simulación:', alertError)
          // No fallar la captura por error en alerta
        }
      } else {
        logger.info('No se crea alerta', {
          reason: versionNumber === 1 ? 'Primera versión' : 'Sin cambios detectados',
          versionNumber,
          changeCount: newSnapshot.changeCount
        })
      }
      
      return res.json({
        success: true,
        message: 'Cambios capturados exitosamente (simulado)',
        data: {
          versionNumber: newSnapshot.versionNumber,
          changeCount: newSnapshot.changeCount,
          severity: newSnapshot.severity,
          timestamp: newSnapshot.createdAt
        }
      })
    }

    // Capturar cambios usando el servicio real
    const result = await changeDetector.captureChange(id, competitor.url, options)

    if (!result) {
      return res.json({
        success: true,
        message: 'No se detectaron cambios',
        data: null
      })
    }

    res.json({
      success: true,
      message: 'Cambios capturados exitosamente',
      data: {
        versionNumber: result.version_number,
        changeCount: result.changeCount || 0,
        severity: result.severity || 'low',
        timestamp: result.created_at
      }
    })
  } catch (error) {
    logger.error('Error en captura de cambios:', error)
    throw error
  }
}))

/**
 * GET /api/competitors/:id/history
 * Obtener historial de versiones de un competidor
 */
router.get('/:id/history', validateCompetitor.list, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { limit = 10, offset = 0 } = req.query

  logger.info('Obteniendo historial de competidor', {
    userId: req.user.id,
    competitorId: id,
    limit,
    offset
  })

  try {
    // Verificar que el competidor existe y pertenece al usuario
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Obtener historial de snapshots
    const { count, rows } = await Snapshot.findAndCountAll({
      where: {
        competitorId: id
      },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['versionNumber', 'DESC']],
      attributes: [
        'id',
        'versionNumber',
        'isFullVersion',
        'isCurrent',
        'changeCount',
        'changePercentage',
        'severity',
        'changeType',
        'changeSummary',
        'metadata',
        'created_at',
        'updated_at'
      ]
    })

    const history = {
      data: rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    }

    logger.info('Historial obtenido exitosamente', {
      competitorId: id,
      totalVersions: count,
      returnedVersions: rows.length
    })

    res.json({
      success: true,
      data: history.data,
      pagination: history.pagination
    })
  } catch (error) {
    logger.error('Error obteniendo historial:', error)
    throw error
  }
}))

/**
 * GET /api/competitors/:id/version/:versionNumber/html
 * Obtener HTML de una versión específica
 */
router.get('/:id/version/:versionNumber/html', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id, versionNumber } = req.params

  logger.info('Obteniendo HTML de versión', {
    userId: req.user.id,
    competitorId: id,
    versionNumber
  })

  try {
    // Verificar que el competidor existe y pertenece al usuario
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Buscar el snapshot específico
    const snapshot = await Snapshot.findOne({
      where: {
        competitorId: id,
        versionNumber: parseInt(versionNumber)
      }
    })

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        message: 'Versión no encontrada'
      })
    }

    // Reconstruir HTML completo
    let fullHtml = ''
    
    if (snapshot.isFullVersion) {
      // Es una versión completa, descomprimir directamente
      const changeDetector = require('../services/changeDetector')
      fullHtml = await changeDetector.decompressHtml(snapshot.fullHtml)
    } else {
      // Es una versión diferencial, necesitamos reconstruir desde la versión anterior
      const changeDetector = require('../services/changeDetector')
      
      // Buscar la versión completa anterior más cercana
      const previousFullVersion = await Snapshot.findOne({
        where: {
          competitorId: id,
          isFullVersion: true,
          versionNumber: { [require('sequelize').Op.lte]: parseInt(versionNumber) }
        },
        order: [['versionNumber', 'DESC']]
      })

      if (!previousFullVersion) {
        return res.status(404).json({
          success: false,
          message: 'No se puede reconstruir la versión: falta versión base'
        })
      }

      // Descomprimir la versión base
      let baseHtml = await changeDetector.decompressHtml(previousFullVersion.fullHtml)

      // Aplicar cambios incrementales desde la versión base hasta la solicitada
      const intermediateVersions = await Snapshot.findAll({
        where: {
          competitorId: id,
          versionNumber: { 
            [require('sequelize').Op.gt]: previousFullVersion.versionNumber,
            [require('sequelize').Op.lte]: parseInt(versionNumber)
          },
          isFullVersion: false
        },
        order: [['versionNumber', 'ASC']]
      })

      // Aplicar cada cambio incremental
      for (const version of intermediateVersions) {
        const changes = await changeDetector.decompressHtml(version.fullHtml)
        baseHtml = await changeDetector.applyChanges(baseHtml, changes)
      }

      fullHtml = baseHtml
    }

    logger.info('HTML de versión obtenido exitosamente', {
      competitorId: id,
      versionNumber: parseInt(versionNumber),
      isFullVersion: snapshot.isFullVersion,
      htmlLength: fullHtml.length
    })

    res.json({
      success: true,
      data: {
        versionNumber: parseInt(versionNumber),
        html: fullHtml,
        timestamp: snapshot.createdAt,
        isFullVersion: snapshot.isFullVersion
      }
    })
  } catch (error) {
    logger.error('Error obteniendo HTML de versión:', error)
    throw error
  }
}))

/**
 * POST /api/competitors/:id/enable-monitoring
 * Habilitar monitoreo de un competidor
 */
router.post('/:id/enable-monitoring', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id } = req.params

  logger.info('Habilitando monitoreo', {
    userId: req.user.id,
    competitorId: id
  })

  try {
    // Buscar el competidor
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Habilitar monitoreo
    await competitor.update({ monitoringEnabled: true })

    logger.info('Monitoreo habilitado exitosamente', {
      competitorId: id,
      competitorName: competitor.name
    })

    res.json({
      success: true,
      message: 'Monitoreo habilitado exitosamente',
      data: {
        id: competitor.id,
        name: competitor.name,
        monitoringEnabled: true
      }
    })
  } catch (error) {
    logger.error('Error habilitando monitoreo:', error)
    throw error
  }
}))

/**
 * POST /api/competitors/:id/disable-monitoring
 * Deshabilitar monitoreo de un competidor
 */
router.post('/:id/disable-monitoring', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id } = req.params

  logger.info('Deshabilitando monitoreo', {
    userId: req.user.id,
    competitorId: id
  })

  try {
    // Buscar el competidor
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Deshabilitar monitoreo
    await competitor.update({ monitoringEnabled: false })

    logger.info('Monitoreo deshabilitado exitosamente', {
      competitorId: id,
      competitorName: competitor.name
    })

    res.json({
      success: true,
      message: 'Monitoreo deshabilitado exitosamente',
      data: {
        id: competitor.id,
        name: competitor.name,
        monitoringEnabled: false
      }
    })
  } catch (error) {
    logger.error('Error deshabilitando monitoreo:', error)
    throw error
  }
}))

/**
 * POST /api/competitors/:id/manual-check
 * Ejecutar monitoreo manual de un competidor
 */
router.post('/:id/manual-check', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { simulate = false, enableAI = false } = req.body

  logger.info('Ejecutando monitoreo manual', {
    userId: req.user.id,
    competitorId: id,
    simulate,
    enableAI
  })

  try {
    // Buscar el competidor
    const competitor = await Competitor.findOne({
      where: {
        id,
        userId: req.user.id,
        isActive: true
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Ejecutar captura manual
    const result = await changeDetector.captureChange(competitor.id, competitor.url, {
      simulate,
      isManualCheck: true,
      enableAI
    })

    // Actualizar última verificación
    await competitor.update({
      lastCheckedAt: new Date()
    })

    logger.info('Monitoreo manual completado', {
      userId: req.user.id,
      competitorId: id,
      competitorName: competitor.name,
      changesDetected: result.changesDetected,
      alertCreated: result.alertCreated
    })

    res.json({
      success: true,
      data: {
        competitorId: id,
        competitorName: competitor.name,
        changesDetected: result.changesDetected,
        alertCreated: result.alertCreated,
        snapshotId: result.snapshotId,
        changeCount: result.changeCount,
        severity: result.severity,
        timestamp: new Date().toISOString()
      },
      message: result.changesDetected 
        ? `Se detectaron ${result.changeCount} cambios (${result.severity})`
        : 'No se detectaron cambios'
    })
  } catch (error) {
    logger.error('Error en monitoreo manual:', error)
    res.status(500).json({
      success: false,
      message: `Error ejecutando monitoreo: ${error.message}`
    })
  }
}))

/**
 * POST /api/competitors/:id/start-monitoring
 * Iniciar monitoreo automático de un competidor
 */
router.post('/:id/start-monitoring', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { interval = 3600, options = {} } = req.body // interval en segundos, default 1 hora

  logger.info('Iniciando monitoreo automático', {
    userId: req.user.id,
    competitorId: id,
    interval,
    options
  })

  try {
    // Buscar el competidor
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Validar intervalo (mínimo 5 minutos, máximo 24 horas)
    const minInterval = 300 // 5 minutos
    const maxInterval = 86400 // 24 horas
    const validatedInterval = Math.max(minInterval, Math.min(maxInterval, parseInt(interval)))

    // Actualizar configuración de monitoreo
    await competitor.update({
      monitoringEnabled: true,
      checkInterval: validatedInterval
    })

    // Ejecutar primera captura inmediatamente
    logger.info('Ejecutando captura inicial para monitoreo', {
      userId: req.user.id,
      competitorId: id,
      competitorUrl: competitor.url
    })

    const changeDetector = require('../services/changeDetector')
    const initialCapture = await changeDetector.captureChange(id, competitor.url, {
      ...options,
      isInitialCapture: true
    })

    // Programar próximas capturas (esto se implementaría con un sistema de colas como Bull)
    // Por ahora, solo registramos la configuración
    logger.info('Monitoreo automático configurado', {
      userId: req.user.id,
      competitorId: id,
      competitorName: competitor.name,
      interval: validatedInterval,
      nextCapture: new Date(Date.now() + validatedInterval * 1000).toISOString()
    })

    res.json({
      success: true,
      message: `Monitoreo automático iniciado para ${competitor.name}`,
      data: {
        id: competitor.id,
        name: competitor.name,
        monitoringEnabled: true,
        checkInterval: validatedInterval,
        initialCapture: initialCapture ? {
          versionNumber: initialCapture.versionNumber,
          changeCount: initialCapture.changeCount,
          severity: initialCapture.severity
        } : null,
        nextCapture: new Date(Date.now() + validatedInterval * 1000).toISOString()
      }
    })
  } catch (error) {
    logger.error('Error iniciando monitoreo automático:', error)
    throw error
  }
}))

/**
 * GET /api/competitors/:id/diff/:v1/:v2
 * Comparar dos versiones de un competidor
 */
router.get('/:id/diff/:v1/:v2', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id, v1, v2 } = req.params

  logger.info('Comparando versiones', {
    userId: req.user.id,
    competitorId: id,
    version1: v1,
    version2: v2
  })

  try {
    // Verificar que el competidor existe y pertenece al usuario
    const competitor = await Competitor.findOne({
      where: {
        id: id,
        userId: req.user.id,
        isActive: true
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    // Buscar ambas versiones
    const [version1, version2] = await Promise.all([
      Snapshot.findOne({
        where: {
          competitorId: id,
          versionNumber: parseInt(v1)
        }
      }),
      Snapshot.findOne({
        where: {
          competitorId: id,
          versionNumber: parseInt(v2)
        }
      })
    ])

    if (!version1) {
      return res.status(404).json({
        success: false,
        message: `Versión ${v1} no encontrada`
      })
    }

    if (!version2) {
      return res.status(404).json({
        success: false,
        message: `Versión ${v2} no encontrada`
      })
    }

    // Reconstruir HTML de ambas versiones
    const changeDetector = require('../services/changeDetector')
    
    // Función helper para reconstruir HTML
    const reconstructHtml = async (snapshot) => {
      if (snapshot.isFullVersion) {
        return await changeDetector.decompressHtml(snapshot.fullHtml)
      } else {
        // Buscar versión base y aplicar cambios
        const baseVersion = await Snapshot.findOne({
          where: {
            competitorId: id,
            isFullVersion: true,
            versionNumber: { [require('sequelize').Op.lte]: snapshot.versionNumber }
          },
          order: [['versionNumber', 'DESC']]
        })

        if (!baseVersion) {
          throw new Error('No se puede reconstruir: falta versión base')
        }

        let baseHtml = await changeDetector.decompressHtml(baseVersion.fullHtml)

        const intermediateVersions = await Snapshot.findAll({
          where: {
            competitorId: id,
            versionNumber: { 
              [require('sequelize').Op.gt]: baseVersion.versionNumber,
              [require('sequelize').Op.lte]: snapshot.versionNumber
            },
            isFullVersion: false
          },
          order: [['versionNumber', 'ASC']]
        })

        for (const version of intermediateVersions) {
          const changes = await changeDetector.decompressHtml(version.fullHtml)
          baseHtml = await changeDetector.applyChanges(baseHtml, changes)
        }

        return baseHtml
      }
    }

    const [html1, html2] = await Promise.all([
      reconstructHtml(version1),
      reconstructHtml(version2)
    ])

    // Generar diff
    const diff = changeDetector.generateDiff(html1, html2)

    logger.info('Comparación de versiones completada', {
      competitorId: id,
      version1: v1,
      version2: v2,
      changes: diff.changes.length,
      severity: diff.severity
    })

    res.json({
      success: true,
      data: {
        competitorId: id,
        version1: {
          number: parseInt(v1),
          timestamp: version1.createdAt,
          isFullVersion: version1.isFullVersion
        },
        version2: {
          number: parseInt(v2),
          timestamp: version2.createdAt,
          isFullVersion: version2.isFullVersion
        },
        diff: {
          changes: diff.changes,
          changeCount: diff.changeCount,
          changePercentage: diff.changePercentage,
          severity: diff.severity,
          summary: diff.summary
        }
      }
    })
  } catch (error) {
    logger.error('Error comparando versiones:', error)
    throw error
  }
}))

module.exports = router
