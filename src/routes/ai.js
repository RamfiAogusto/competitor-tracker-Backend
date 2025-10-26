const express = require('express')
const router = express.Router()
const aiService = require('../services/aiService')
const { authenticateToken } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const logger = require('../utils/logger')

/**
 * @route   GET /api/ai/test
 * @desc    Test de conexión con Google AI
 * @access  Private
 */
router.get('/test', authenticateToken, asyncHandler(async (req, res) => {
  logger.info('Test de Google AI solicitado', { userId: req.user.id })
  
  const result = await aiService.testConnection()
  
  res.json({
    success: true,
    data: result
  })
}))

/**
 * @route   POST /api/ai/analyze-change
 * @desc    Analiza un cambio detectado con IA
 * @access  Private
 */
router.post('/analyze-change', authenticateToken, asyncHandler(async (req, res) => {
  const { changeData } = req.body
  
  if (!changeData) {
    return res.status(400).json({
      success: false,
      error: { message: 'changeData es requerido' }
    })
  }
  
  logger.info('Análisis de cambio con IA solicitado', { 
    userId: req.user.id,
    competitorName: changeData.competitorName 
  })
  
  const analysis = await aiService.analyzeChanges(changeData)
  
  res.json({
    success: true,
    data: analysis
  })
}))

/**
 * @route   POST /api/ai/summarize-changes
 * @desc    Genera un resumen de múltiples cambios
 * @access  Private
 */
router.post('/summarize-changes', authenticateToken, asyncHandler(async (req, res) => {
  const { changes } = req.body
  
  if (!changes || !Array.isArray(changes)) {
    return res.status(400).json({
      success: false,
      error: { message: 'changes debe ser un array' }
    })
  }
  
  logger.info('Resumen de cambios con IA solicitado', { 
    userId: req.user.id,
    changesCount: changes.length 
  })
  
  const summary = await aiService.summarizeMultipleChanges(changes)
  
  res.json({
    success: true,
    data: { summary }
  })
}))

/**
 * @route   POST /api/ai/categorize-change
 * @desc    Categoriza automáticamente un cambio
 * @access  Private
 */
router.post('/categorize-change', authenticateToken, asyncHandler(async (req, res) => {
  const { changeData } = req.body
  
  if (!changeData) {
    return res.status(400).json({
      success: false,
      error: { message: 'changeData es requerido' }
    })
  }
  
  logger.info('Categorización de cambio con IA solicitada', { userId: req.user.id })
  
  const category = await aiService.categorizeChange(changeData)
  
  res.json({
    success: true,
    data: { category }
  })
}))

/**
 * @route   POST /api/ai/competitor-insights
 * @desc    Genera insights sobre un competidor
 * @access  Private
 */
router.post('/competitor-insights', authenticateToken, asyncHandler(async (req, res) => {
  const { competitorData } = req.body
  
  if (!competitorData) {
    return res.status(400).json({
      success: false,
      error: { message: 'competitorData es requerido' }
    })
  }
  
  logger.info('Insights de competidor con IA solicitados', { 
    userId: req.user.id,
    competitorName: competitorData.name 
  })
  
  const insights = await aiService.generateCompetitorInsights(competitorData)
  
  res.json({
    success: true,
    data: insights
  })
}))

module.exports = router

