/**
 * Servicio para comunicación con HeadlessX
 * Maneja todas las interacciones con la API de HeadlessX
 */

const axios = require('axios')
const config = require('../config')
const logger = require('../utils/logger')
const { createError } = require('../middleware/errorHandler')

class HeadlessXService {
  constructor () {
    this.baseURL = config.headlessX.url
    this.token = config.headlessX.token
    this.timeout = config.headlessX.timeout

    // Configurar headers
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Competitor-Tracker-Backend/1.0.0'
    }

    // Solo agregar Authorization si hay token
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    // Configurar cliente axios
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers
    })

    // Interceptor para logging de requests
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('HeadlessX Request:', {
          method: config.method,
          url: config.url,
          data: config.data
        })
        return config
      },
      (error) => {
        logger.error('HeadlessX Request Error:', error)
        return Promise.reject(error)
      }
    )

    // Interceptor para logging de responses
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('HeadlessX Response:', {
          status: response.status,
          url: response.config.url,
          dataSize: JSON.stringify(response.data).length
        })
        return response
      },
      (error) => {
        logger.error('HeadlessX Response Error:', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        })
        return Promise.reject(error)
      }
    )
  }

  /**
   * Verificar estado de salud de HeadlessX
   */
  async checkHealth () {
    try {
      const response = await this.client.get('/api/health')
      return {
        status: 'healthy',
        data: response.data
      }
    } catch (error) {
      logger.error('HeadlessX health check failed:', error.message)
      return {
        status: 'unhealthy',
        error: error.message
      }
    }
  }

  /**
   * Obtener estado del servidor HeadlessX
   */
  async getStatus () {
    try {
      const response = await this.client.get('/api/status')
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Error obteniendo estado de HeadlessX')
    }
  }

  /**
   * Renderizar página completa
   */
  async renderPage (url, options = {}) {
    try {
      const payload = {
        url,
        waitFor: options.waitFor || 0,
        viewport: options.viewport || { width: 1920, height: 1080 },
        userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        headers: options.headers || {},
        cookies: options.cookies || [],
        timeout: options.timeout || 30000
      }

      const response = await this.client.post('/api/render', payload)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Error renderizando página')
    }
  }

  /**
   * Extraer HTML puro
   */
  async extractHTML (url, options = {}) {
    try {
      const params = {
        url,
        waitFor: options.waitFor || 3000,
        removeScripts: options.removeScripts !== false ? 'true' : 'false'
      }

      // Agregar token si está configurado (HeadlessX puede requerirlo como query param)
      if (this.token) {
        params.token = this.token
      }

      // Usar GET en lugar de POST (HeadlessX funciona mejor con GET)
      const response = await this.client.get('/api/html', { params })
      
      // HeadlessX devuelve el HTML directamente como string en response.data
      // También incluye metadatos en los headers
      const html = response.data
      const title = response.headers['x-page-title'] || 'Extracted HTML'
      const renderedUrl = response.headers['x-rendered-url'] || url
      
      return {
        html: html,
        title: title,
        url: renderedUrl,
        contentLength: response.headers['x-content-length'],
        wasTimeout: response.headers['x-was-timeout'] === 'true'
      }
    } catch (error) {
      throw this.handleError(error, 'Error extrayendo HTML')
    }
  }

  /**
   * Extraer contenido de texto limpio
   */
  async extractContent (url, options = {}) {
    try {
      const payload = {
        url,
        waitFor: options.waitFor || 0,
        viewport: options.viewport || { width: 1920, height: 1080 },
        selector: options.selector,
        removeScripts: options.removeScripts || true,
        includeImages: options.includeImages || false
      }

      const response = await this.client.post('/api/content', payload)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Error extrayendo contenido')
    }
  }

  /**
   * Tomar captura de pantalla
   */
  async takeScreenshot (url, options = {}) {
    try {
      const params = {
        url,
        waitFor: options.waitFor || 0,
        viewport: options.viewport || { width: 1920, height: 1080 },
        fullPage: options.fullPage || false,
        quality: options.quality || 80,
        format: options.format || 'png'
      }

      const response = await this.client.get('/api/screenshot', { params })
      
      // HeadlessX devuelve la imagen como base64
      return {
        image: response.data.image,
        format: response.data.format,
        width: response.data.width,
        height: response.data.height,
        timestamp: response.data.timestamp
      }
    } catch (error) {
      throw this.handleError(error, 'Error tomando captura de pantalla')
    }
  }

  /**
   * Generar PDF de la página
   */
  async generatePDF (url, options = {}) {
    try {
      const params = {
        url,
        waitFor: options.waitFor || 0,
        viewport: options.viewport || { width: 1920, height: 1080 },
        format: options.format || 'A4',
        printBackground: options.printBackground || true,
        margin: options.margin || { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
      }

      const response = await this.client.get('/api/pdf', { params })
      
      return {
        pdf: response.data.pdf,
        format: response.data.format,
        pages: response.data.pages,
        timestamp: response.data.timestamp
      }
    } catch (error) {
      throw this.handleError(error, 'Error generando PDF')
    }
  }

  /**
   * Procesar múltiples URLs en lote
   */
  async processBatch (requests, options = {}) {
    try {
      const payload = {
        requests,
        options: {
          concurrent: options.concurrent || 5,
          timeout: options.timeout || 60000,
          retries: options.retries || 2
        }
      }

      const response = await this.client.post('/api/batch', payload)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Error procesando lote de URLs')
    }
  }

  /**
   * Comparar dos páginas
   */
  async comparePages (url1, url2, options = {}) {
    try {
      const [page1, page2] = await Promise.all([
        this.extractHTML(url1, options),
        this.extractHTML(url2, options)
      ])

      return {
        url1,
        url2,
        page1: page1.html,
        page2: page2.html,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw this.handleError(error, 'Error comparando páginas')
    }
  }

  /**
   * Monitorear cambios en una URL
   */
  async monitorChanges (url, options = {}) {
    try {
      const currentPage = await this.extractHTML(url, options)
      
      return {
        url,
        html: currentPage.html,
        timestamp: new Date().toISOString(),
        metadata: {
          title: currentPage.title,
          description: currentPage.description,
          viewport: options.viewport || { width: 1920, height: 1080 }
        }
      }
    } catch (error) {
      throw this.handleError(error, 'Error monitoreando cambios')
    }
  }

  /**
   * Extraer datos estructurados de una página
   */
  async extractStructuredData (url, selectors, options = {}) {
    try {
      const page = await this.renderPage(url, options)
      
      // Procesar selectores para extraer datos específicos
      const structuredData = {}
      
      for (const [key, selector] of Object.entries(selectors)) {
        try {
          // HeadlessX puede devolver elementos seleccionados
          const elements = page.elements || []
          const element = elements.find(el => el.selector === selector)
          
          structuredData[key] = element ? element.text || element.html : null
        } catch (selectorError) {
          logger.warn(`Error procesando selector ${key}:`, selectorError.message)
          structuredData[key] = null
        }
      }

      return {
        url,
        data: structuredData,
        timestamp: new Date().toISOString(),
        metadata: {
          title: page.title,
          description: page.description,
          url: page.url
        }
      }
    } catch (error) {
      throw this.handleError(error, 'Error extrayendo datos estructurados')
    }
  }

  /**
   * Manejar errores de HeadlessX
   */
  handleError (error, message) {
    if (error.response) {
      // Error de respuesta HTTP
      const status = error.response.status
      const data = error.response.data

      switch (status) {
        case 400:
          return createError(`${message}: Datos inválidos`, 400)
        case 401:
          return createError(`${message}: No autorizado`, 401)
        case 403:
          return createError(`${message}: Prohibido`, 403)
        case 404:
          return createError(`${message}: Endpoint no encontrado`, 404)
        case 408:
          return createError(`${message}: Timeout`, 408)
        case 429:
          return createError(`${message}: Límite de rate excedido`, 429)
        case 500:
          return createError(`${message}: Error interno de HeadlessX`, 502)
        case 502:
          return createError(`${message}: Bad Gateway`, 502)
        case 503:
          return createError(`${message}: Servicio no disponible`, 503)
        default:
          return createError(`${message}: Error ${status}`, 502)
      }
    } else if (error.code === 'ECONNREFUSED') {
      return createError(`${message}: HeadlessX no está disponible`, 503)
    } else if (error.code === 'ETIMEDOUT') {
      return createError(`${message}: Timeout de conexión`, 408)
    } else {
      return createError(`${message}: ${error.message}`, 500)
    }
  }

  /**
   * Obtener estadísticas de uso
   */
  async getUsageStats () {
    try {
      const status = await this.getStatus()
      return {
        activeBrowsers: status.activeBrowsers || 0,
        maxBrowsers: status.maxBrowsers || 0,
        queueLength: status.queueLength || 0,
        uptime: status.uptime || 0,
        memoryUsage: status.memoryUsage || 0,
        cpuUsage: status.cpuUsage || 0
      }
    } catch (error) {
      logger.error('Error obteniendo estadísticas de HeadlessX:', error.message)
      return null
    }
  }
}

// Crear instancia singleton
const headlessXService = new HeadlessXService()

module.exports = headlessXService
