/**
 * Rutas de autenticación con Google OAuth
 */

const express = require('express')
const passport = require('../config/passport')
const config = require('../config')
const logger = require('../utils/logger')
const { asyncHandler } = require('../middleware/errorHandler')

const router = express.Router()

/**
 * GET /api/auth/google
 * Iniciar autenticación con Google
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}))

/**
 * GET /api/auth/google/callback
 * Callback de Google OAuth
 */
router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  asyncHandler(async (req, res) => {
    try {
      const { user, tokens } = req.user

      logger.info('Google OAuth exitoso', {
        userId: user.id,
        email: user.email
      })

      // Configurar cookies HttpOnly
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 días
        path: '/'
      })

      res.cookie('token', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
        path: '/'
      })

      // Redirigir al frontend con el token en la URL (para que el frontend lo guarde)
      const redirectUrl = `${config.frontendUrl}/auth/callback?token=${tokens.accessToken}&success=true`
      res.redirect(redirectUrl)

    } catch (error) {
      logger.error('Error en callback de Google OAuth:', error)
      const redirectUrl = `${config.frontendUrl}/auth?error=oauth_error`
      res.redirect(redirectUrl)
    }
  })
)

/**
 * GET /api/auth/google/failure
 * Manejo de errores de Google OAuth
 */
router.get('/google/failure', (req, res) => {
  logger.error('Google OAuth falló')
  const redirectUrl = `${config.frontendUrl}/auth?error=oauth_failed`
  res.redirect(redirectUrl)
})

module.exports = router
