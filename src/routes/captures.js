/**
 * Rutas para gestión de capturas y versionado
 * Endpoints específicos para el sistema de versionado
 */

const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../middleware/errorHandler')
const { validateCapture } = require('../middleware/validation')
const changeDetector = require('../services/changeDetector')
const headlessXService = require('../services/headlessXService')
const logger = require('../utils/logger')

/**
 * POST /api/captures
 * Capturar cambios de múltiples competidores
 */
router.post('/', asyncHandler(async (req, res) => {
  const { competitorIds, options = {} } = req.body

  if (!competitorIds || !Array.isArray(competitorIds) || competitorIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Lista de competidores requerida'
    })
  }

  logger.info('Captura masiva iniciada', {
    userId: req.user.id,
    competitorCount: competitorIds.length,
    options
  })

  const results = []

  // Procesar cada competidor
  for (const competitorId of competitorIds) {
    try {
      // TODO: Obtener datos del competidor desde BD
      const competitor = {
        id: competitorId,
        url: 'https://example.com',
        name: 'Competitor'
      }

      const result = await changeDetector.captureChange(competitorId, competitor.url, options)
      
      results.push({
        competitorId,
        success: true,
        hasChanges: !!result,
        versionNumber: result?.version_number || null,
        changeCount: result?.changeCount || 0,
        severity: result?.severity || null
      })
    } catch (error) {
      logger.error('Error en captura masiva:', {
        competitorId,
        error: error.message
      })
      
      results.push({
        competitorId,
        success: false,
        error: error.message
      })
    }
  }

  const successCount = results.filter(r => r.success).length
  const changeCount = results.filter(r => r.hasChanges).length

  res.json({
    success: true,
    message: `Captura completada: ${successCount}/${competitorIds.length} exitosas, ${changeCount} con cambios`,
    data: {
      total: competitorIds.length,
      successful: successCount,
      withChanges: changeCount,
      results
    }
  })
}))

/**
 * GET /api/captures/competitor/:competitorId/history
 * Obtener historial completo de un competidor
 */
router.get('/competitor/:competitorId/history', validateCapture.getHistory, asyncHandler(async (req, res) => {
  const { competitorId } = req.params
  const { limit = 20, offset = 0 } = req.query

  logger.info('Obteniendo historial de capturas', {
    userId: req.user.id,
    competitorId,
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
        isFullVersion: false,
        createdAt: new Date().toISOString(),
        metadata: {
          changeType: 'content',
          affectedSections: ['main-content'],
          userAgent: 'Mozilla/5.0...'
        }
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
 * GET /api/captures/competitor/:competitorId/version/:versionNumber
 * Obtener datos de una versión específica
 */
router.get('/competitor/:competitorId/version/:versionNumber', validateCapture.getVersion, asyncHandler(async (req, res) => {
  const { competitorId, versionNumber } = req.params

  logger.info('Obteniendo versión específica', {
    userId: req.user.id,
    competitorId,
    versionNumber
  })

  // TODO: Implementar obtención de versión desde BD
  const version = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    versionNumber: parseInt(versionNumber),
    competitorId,
    changeCount: 3,
    changePercentage: 2.5,
    severity: 'low',
    changeSummary: '2 líneas añadidas, 1 línea eliminada',
    isFullVersion: false,
    createdAt: new Date().toISOString(),
    metadata: {
      changeType: 'content',
      affectedSections: ['main-content']
    }
  }

  res.json({
    success: true,
    data: version
  })
}))

/**
 * GET /api/captures/competitor/:competitorId/version/:versionNumber/html
 * Obtener HTML de una versión específica
 */
router.get('/competitor/:competitorId/version/:versionNumber/html', validateCapture.getVersion, asyncHandler(async (req, res) => {
  const { competitorId, versionNumber } = req.params

  logger.info('Obteniendo HTML de versión', {
    userId: req.user.id,
    competitorId,
    versionNumber
  })

  // TODO: Implementar reconstrucción de HTML
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
 * GET /api/captures/competitor/:competitorId/version/:versionNumber/diff
 * Obtener diferencias entre dos versiones
 */
router.get('/competitor/:competitorId/version/:versionNumber/diff', validateCapture.getVersion, asyncHandler(async (req, res) => {
  const { competitorId, versionNumber } = req.params
  const { compareWith } = req.query

  logger.info('Obteniendo diferencias entre versiones', {
    userId: req.user.id,
    competitorId,
    versionNumber,
    compareWith
  })

  // TODO: Implementar comparación de versiones
  const diff = {
    fromVersion: parseInt(compareWith) || parseInt(versionNumber) - 1,
    toVersion: parseInt(versionNumber),
    changes: [
      {
        type: 'added',
        line: 15,
        content: '+Nueva línea de contenido'
      },
      {
        type: 'removed',
        line: 23,
        content: '-Línea eliminada'
      }
    ],
    summary: {
      added: 1,
      removed: 1,
      modified: 0
    }
  }

  res.json({
    success: true,
    data: diff
  })
}))

/**
 * POST /api/captures/competitor/:competitorId/screenshot
 * Tomar captura de pantalla de un competidor
 */
router.post('/competitor/:competitorId/screenshot', validateCapture.getHistory, asyncHandler(async (req, res) => {
  const { competitorId } = req.params
  const { options = {} } = req.body

  logger.info('Tomando captura de pantalla', {
    userId: req.user.id,
    competitorId,
    options
  })

  try {
    // TODO: Obtener URL del competidor
    const competitor = {
      id: competitorId,
      url: 'https://example.com'
    }

    const screenshot = await headlessXService.takeScreenshot(competitor.url, options)

    res.json({
      success: true,
      message: 'Captura de pantalla tomada exitosamente',
      data: {
        competitorId,
        screenshot: screenshot.image,
        format: screenshot.format,
        dimensions: {
          width: screenshot.width,
          height: screenshot.height
        },
        timestamp: screenshot.timestamp
      }
    })
  } catch (error) {
    logger.error('Error tomando captura de pantalla:', error)
    throw error
  }
}))

/**
 * POST /api/captures/competitor/:competitorId/pdf
 * Generar PDF de un competidor
 */
router.post('/competitor/:competitorId/pdf', validateCapture.getHistory, asyncHandler(async (req, res) => {
  const { competitorId } = req.params
  const { options = {} } = req.body

  logger.info('Generando PDF', {
    userId: req.user.id,
    competitorId,
    options
  })

  try {
    // TODO: Obtener URL del competidor
    const competitor = {
      id: competitorId,
      url: 'https://example.com'
    }

    const pdf = await headlessXService.generatePDF(competitor.url, options)

    res.json({
      success: true,
      message: 'PDF generado exitosamente',
      data: {
        competitorId,
        pdf: pdf.pdf,
        format: pdf.format,
        pages: pdf.pages,
        timestamp: pdf.timestamp
      }
    })
  } catch (error) {
    logger.error('Error generando PDF:', error)
    throw error
  }
}))

/**
 * GET /api/captures/stats
 * Obtener estadísticas de capturas
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { period = '7d' } = req.query

  logger.info('Obteniendo estadísticas de capturas', {
    userId: req.user.id,
    period
  })

  // TODO: Implementar consulta de estadísticas desde BD
  const stats = {
    period,
    total: {
      captures: 150,
      competitors: 25,
      changes: 45
    },
    today: {
      captures: 12,
      changes: 3
    },
    trends: {
      capturesPerDay: [10, 12, 8, 15, 18, 12, 14],
      changesPerDay: [2, 4, 1, 6, 3, 2, 3]
    }
  }

  res.json({
    success: true,
    data: stats
  })
}))

module.exports = router
