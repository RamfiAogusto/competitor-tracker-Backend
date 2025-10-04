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
    const allowedSortFields = ['name', 'url', 'created_at', 'updated_at', 'last_checked_at', 'total_versions']
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at'
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
        'changeSummary',
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
