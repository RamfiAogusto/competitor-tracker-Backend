/**
 * Rutas de Server-Sent Events (SSE)
 * Para notificaciones en tiempo real
 */

const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')
const config = require('../config')
const { authenticateToken } = require('../middleware/auth')

// Map para almacenar conexiones SSE activas
// Key: competitorId, Value: array de response objects
const sseConnections = new Map()

/**
 * GET /api/sse/competitor/:id/analysis
 * Establecer conexión SSE para recibir notificaciones de análisis
 */
router.get('/competitor/:id/analysis', async (req, res) => {
  const { id: competitorId } = req.params
  const { token } = req.query
  
  // Validar token manualmente (EventSource no soporta headers personalizados)
  if (!token) {
    res.status(401).json({ success: false, message: 'Token no proporcionado' })
    return
  }
  
  // Verificar token
  const jwt = require('jsonwebtoken')
  const config = require('../config')
  let userId
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    userId = decoded.userId
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token inválido' })
    return
  }

  // Configurar headers SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Para Nginx
  res.setHeader('Access-Control-Allow-Origin', config.cors.origin) // Asegurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  logger.info('Nueva conexión SSE establecida', {
    competitorId,
    userId,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })

  // Enviar mensaje inicial de conexión
  const connectMessage = `data: ${JSON.stringify({ type: 'connected', competitorId })}\n\n`
  res.write(connectMessage)
  logger.debug('Mensaje "connected" enviado', { competitorId, messageLength: connectMessage.length })
  
  // Forzar flush para asegurar que el mensaje se envía inmediatamente
  if (res.flush) {
    res.flush()
  }

  // Almacenar la conexión
  if (!sseConnections.has(competitorId)) {
    sseConnections.set(competitorId, [])
  }
  sseConnections.get(competitorId).push({ res, userId })

  // Limpiar cuando el cliente cierra la conexión
  req.on('close', () => {
    logger.info('Conexión SSE cerrada', {
      competitorId,
      userId
    })

    const connections = sseConnections.get(competitorId)
    if (connections) {
      const index = connections.findIndex(conn => conn.res === res)
      if (index !== -1) {
        connections.splice(index, 1)
      }
      
      // Si no hay más conexiones, eliminar la entrada
      if (connections.length === 0) {
        sseConnections.delete(competitorId)
      }
    }
  })

  // Mantener la conexión viva con heartbeat cada 30 segundos
  const heartbeatInterval = setInterval(() => {
    res.write(`:heartbeat\n\n`)
  }, 30000)

  req.on('close', () => {
    clearInterval(heartbeatInterval)
  })
})

/**
 * Función para enviar notificación de análisis completado
 * Esta función se llamará desde el servicio de análisis
 */
function notifyAnalysisComplete(competitorId, data) {
  const connections = sseConnections.get(competitorId)
  
  if (!connections || connections.length === 0) {
    logger.debug('No hay conexiones SSE activas para notificar', { competitorId })
    return
  }

  logger.info('Enviando notificación de análisis completado', {
    competitorId,
    activeConnections: connections.length
  })

  const message = JSON.stringify({
    type: 'analysis_complete',
    competitorId,
    data: {
      totalVersions: data.totalVersions || 1,
      versionNumber: data.versionNumber,
      timestamp: new Date().toISOString()
    }
  })

  // Enviar a todas las conexiones activas
  connections.forEach(({ res, userId }) => {
    try {
      res.write(`data: ${message}\n\n`)
      if (res.flush) res.flush() // Forzar envío inmediato
      logger.debug('Notificación SSE enviada', { competitorId, userId })
    } catch (error) {
      logger.error('Error enviando notificación SSE', {
        competitorId,
        userId,
        error: error.message
      })
    }
  })
}

/**
 * Función para enviar notificación de error en análisis
 */
function notifyAnalysisError(competitorId, error) {
  const connections = sseConnections.get(competitorId)
  
  if (!connections || connections.length === 0) {
    logger.warn('⚠️ No hay conexiones SSE activas para notificar error', { 
      competitorId,
      totalCompetitorsWithConnections: sseConnections.size,
      activeCompetitorIds: Array.from(sseConnections.keys())
    })
    return
  }

  logger.info('📨 Enviando notificación de error en análisis', {
    competitorId,
    activeConnections: connections.length
  })

  const message = JSON.stringify({
    type: 'analysis_error',
    competitorId,
    error: {
      message: error.message || 'Error en el análisis',
      timestamp: new Date().toISOString()
    }
  })

  connections.forEach(({ res, userId }) => {
    try {
      const messageFormatted = `data: ${message}\n\n`
      res.write(messageFormatted)
      if (res.flush) res.flush() // Forzar envío inmediato
      logger.debug('Notificación de error SSE enviada', { competitorId, userId, messageLength: messageFormatted.length })
    } catch (err) {
      logger.error('Error enviando notificación de error SSE', {
        competitorId,
        userId,
        error: err.message,
        stack: err.stack
      })
    }
  })
}

// Exportar router y funciones de notificación
module.exports = router
module.exports.notifyAnalysisComplete = notifyAnalysisComplete
module.exports.notifyAnalysisError = notifyAnalysisError

