/**
 * Configuración de Passport para autenticación con Google OAuth
 */

const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const { User } = require('../models')
const { generateTokens } = require('../middleware/auth')
const config = require('./index')
const logger = require('../utils/logger')

// Configurar estrategia de Google OAuth
passport.use(new GoogleStrategy({
  clientID: config.google.clientId,
  clientSecret: config.google.clientSecret,
  callbackURL: config.google.callbackUrl
}, async (accessToken, refreshToken, profile, done) => {
  try {
    logger.info('Google OAuth callback recibido', {
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName
    })

    // Buscar usuario existente por googleId o email
    let user = await User.findOne({
      where: {
        googleId: profile.id
      }
    })

    if (!user) {
      // Buscar por email si no existe por googleId
      user = await User.findOne({
        where: {
          email: profile.emails[0].value
        }
      })

      if (user) {
        // Usuario existe pero no tiene googleId, actualizarlo
        await user.update({
          googleId: profile.id,
          avatar: profile.photos[0]?.value
        })
        logger.info('Usuario existente actualizado con Google ID', { userId: user.id })
      } else {
        // Crear nuevo usuario
        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          avatar: profile.photos[0]?.value,
          emailVerified: true, // Google ya verificó el email
          role: 'user'
        })
        logger.info('Nuevo usuario creado con Google OAuth', { userId: user.id })
      }
    }

    // Generar tokens JWT
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    })

    // Retornar usuario con tokens
    const userData = user.toJSON()
    
    return done(null, {
      user: userData,
      tokens
    })

  } catch (error) {
    logger.error('Error en Google OAuth callback:', error)
    return done(error, null)
  }
}))

// Serialización del usuario (no necesaria para OAuth, pero requerida por Passport)
passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id)
    done(null, user)
  } catch (error) {
    done(error, null)
  }
})

module.exports = passport
