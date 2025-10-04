/**
 * Script simple para probar el servidor Express
 */

const express = require('express')
const cors = require('cors')

const app = express()
const PORT = 3002

// Middleware
app.use(cors())
app.use(express.json())

// Rutas
app.get('/', (req, res) => {
  res.json({ 
    message: 'Competitor Tracker API funcionando!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    database: 'Connected',
    timestamp: new Date().toISOString()
  })
})

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
})
