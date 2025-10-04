/**
 * Rutas para gestión de competidores
 * CRUD completo para competidores
 */

const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../middleware/errorHandler')
const { validateCompetitor } = require('../middleware/validation')
const changeDetector = require('../services/changeDetector')
const logger = require('../utils/logger')
const { Competitor, Snapshot } = require('../models')

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
    const allowedSortFields = ['name', 'url', 'createdAt', 'updatedAt', 'lastCheckedAt', 'totalVersions']
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    // Ejecutar consulta con paginación
    const { count, rows } = await Competitor.findAndCountAll({
      where: whereConditions,
      limit: limitNum,
      offset: offset,
      order: [[sortField, sortDirection]],
      attributes: {
        exclude: ['userId'] // No exponer userId en la respuesta
      }
    })

    const totalPages = Math.ceil(count / limitNum)

    res.json({
      success: true,
      data: rows,
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
      attributes: {
        exclude: ['userId'] // No exponer userId en la respuesta
      }
    })

    if (!competitor) {
      return res.status(404).json({
        success: false,
        message: 'Competidor no encontrado'
      })
    }

    res.json({
      success: true,
      data: competitor
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
  const { name, url, description, monitoringEnabled = true, checkInterval = 3600 } = req.body

  logger.info('Creando competidor', {
    userId: req.user.id,
    name,
    url
  })

  try {
    // Verificar que la URL no esté duplicada para este usuario
    const existingCompetitor = await Competitor.findOne({
      where: {
        userId: req.user.id,
        url: url,
        isActive: true
      }
    })

    if (existingCompetitor) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un competidor con esta URL'
      })
    }

    // Crear el competidor
    const newCompetitor = await Competitor.create({
      userId: req.user.id,
      name,
      url,
      description,
      monitoringEnabled,
      checkInterval
    })

    // Remover userId de la respuesta
    const competitorData = newCompetitor.toJSON()
    delete competitorData.userId

    res.status(201).json({
      success: true,
      message: 'Competidor creado exitosamente',
      data: competitorData
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

    // Si se está actualizando la URL, verificar que no esté duplicada
    if (updateData.url && updateData.url !== competitor.url) {
      const existingCompetitor = await Competitor.findOne({
        where: {
          userId: req.user.id,
          url: updateData.url,
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
      attributes: {
        exclude: ['userId']
      }
    })

    res.json({
      success: true,
      message: 'Competidor actualizado exitosamente',
      data: updatedCompetitor
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
 * Eliminar un competidor
 */
router.delete('/:id', validateCompetitor.getById, asyncHandler(async (req, res) => {
  const { id } = req.params

  logger.info('Eliminando competidor', {
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

    // Soft delete - marcar como inactivo
    await competitor.update({ isActive: false })

    res.json({
      success: true,
      message: 'Competidor eliminado exitosamente'
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
    // TODO: Obtener datos del competidor de la base de datos
    const competitor = {
      id,
      url: 'https://techcorp.com',
      name: 'TechCorp'
    }

    // Capturar cambios usando el servicio
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

  // TODO: Implementar consulta a base de datos
  const history = {
    data: [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        versionNumber: 15,
        changeCount: 3,
        changePercentage: 2.5,
        severity: 'low',
        changeSummary: '2 líneas añadidas, 1 línea eliminada',
        createdAt: new Date().toISOString()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        versionNumber: 14,
        changeCount: 8,
        changePercentage: 5.2,
        severity: 'medium',
        changeSummary: '5 líneas añadidas, 3 líneas eliminadas',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ],
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: 15
    }
  }

  res.json({
    success: true,
    data: history.data,
    pagination: history.pagination
  })
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

  // TODO: Implementar obtención de HTML desde base de datos
  const html = '<html><head><title>Versión ' + versionNumber + '</title></head><body>HTML de la versión ' + versionNumber + '</body></html>'

  res.json({
    success: true,
    data: {
      versionNumber: parseInt(versionNumber),
      html,
      timestamp: new Date().toISOString()
    }
  })
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

  // TODO: Implementar habilitación de monitoreo

  res.json({
    success: true,
    message: 'Monitoreo habilitado exitosamente'
  })
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

  // TODO: Implementar deshabilitación de monitoreo

  res.json({
    success: true,
    message: 'Monitoreo deshabilitado exitosamente'
  })
}))

module.exports = router
