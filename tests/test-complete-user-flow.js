/**
 * Test del flujo completo de usuario
 * Simula el uso real: login, agregar competidor, análisis y detección de cambios
 */

const axios = require('axios')
const { User, Competitor, Snapshot } = require('../src/models')
const { testConnection, syncModels } = require('../src/database/config')
const changeDetector = require('../src/services/changeDetector')

class CompleteUserFlowTest {
  constructor() {
    this.baseURL = 'http://localhost:3002/api'
    this.user = null
    this.authToken = null
    this.competitor = null
    this.snapshots = []
  }

  async run() {
    console.log('👤 Test del flujo completo de usuario')
    console.log('=' .repeat(60))

    try {
      await this.setup()
      await this.testUserRegistration()
      await this.testUserLogin()
      await this.testAddCompetitor()
      await this.testMultipleAnalyses()
      await this.testViewHistory()
      await this.testVersionComparison()
      await this.testMonitoringControl()
      await this.cleanup()

      console.log('\n✅ Flujo completo de usuario completado exitosamente!')
    } catch (error) {
      console.error('\n❌ Error en flujo completo:', error.message)
      await this.cleanup()
      process.exit(1)
    }
  }

  async setup() {
    console.log('🔧 Configurando entorno...')
    await testConnection()
    await syncModels()
    console.log(`🌐 Servidor: ${this.baseURL}`)
  }

  async testUserRegistration() {
    console.log('\n📝 Paso 1: Registro de usuario')
    
    const userData = {
      email: 'usuario-completo@example.com',
      password: 'MiPassword123!',
      name: 'Usuario Completo'
    }

    const response = await axios.post(`${this.baseURL}/users/register`, userData)
    
    if (response.status !== 201) {
      throw new Error(`Error en registro: ${response.status}`)
    }

    const { user, tokens } = response.data.data
    this.user = user
    this.authToken = tokens.accessToken

    console.log(`✅ Usuario registrado: ${user.email}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Token generado: ${!!tokens.accessToken}`)

    // Esperar sincronización de BD
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  async testUserLogin() {
    console.log('\n🔑 Paso 2: Login de usuario')
    
    const loginData = {
      email: 'usuario-completo@example.com',
      password: 'MiPassword123!'
    }

    const response = await axios.post(`${this.baseURL}/users/login`, loginData)
    
    if (response.status !== 200) {
      throw new Error(`Error en login: ${response.status}`)
    }

    const { user, tokens } = response.data.data
    this.authToken = tokens.accessToken

    console.log(`✅ Login exitoso: ${user.email}`)
    console.log(`   Nuevo token: ${!!tokens.accessToken}`)
  }

  async testAddCompetitor() {
    console.log('\n🏢 Paso 3: Agregar competidor')
    
    const competitorData = {
      name: 'Mi Competidor Principal',
      url: 'https://mi-competidor.com',
      description: 'Competidor para monitorear cambios'
    }

    const response = await axios.post(`${this.baseURL}/competitors`, competitorData, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (response.status !== 201) {
      throw new Error(`Error agregando competidor: ${response.status}`)
    }

    this.competitor = response.data.data

    console.log(`✅ Competidor agregado: ${this.competitor.name}`)
    console.log(`   ID: ${this.competitor.id}`)
    console.log(`   URL: ${this.competitor.url}`)
    console.log(`   Monitoreo: ${this.competitor.monitoringEnabled ? 'Habilitado' : 'Deshabilitado'}`)
  }

  async testMultipleAnalyses() {
    console.log('\n🔍 Paso 4: Análisis múltiples (simulados)')
    
    // Simular diferentes versiones de HTML
    const htmlVersions = [
      '<html><head><title>Página Original</title></head><body><h1>Bienvenido</h1><p>Contenido inicial de la página</p></body></html>',
      '<html><head><title>Página Actualizada</title></head><body><h1>Bienvenido</h1><p>Contenido modificado de la página</p><div>Nueva sección agregada</div></body></html>',
      '<html><head><title>Página Final</title></head><body><h1>Bienvenido</h1><p>Contenido final de la página</p><div>Nueva sección agregada</div><footer>Pie de página nuevo</footer></body></html>'
    ]

    // Análisis 1: Versión inicial (completa)
    console.log('   📊 Análisis 1: Versión inicial')
    const compressed1 = await changeDetector.compressHTML(htmlVersions[0])
    const snapshot1 = await Snapshot.create({
      competitorId: this.competitor.id,
      versionNumber: 1,
      fullHtml: compressed1,
      isFullVersion: true,
      isCurrent: true,
      changeCount: 0,
      changePercentage: 0,
      severity: 'low',
      changeSummary: 'Versión inicial completa'
    })
    this.snapshots.push(snapshot1)
    console.log(`     ✅ Versión 1 guardada (completa): ${snapshot1.id}`)

    // Análisis 2: Primera detección de cambios
    console.log('   📊 Análisis 2: Detección de cambios')
    const diff2 = changeDetector.generateDiff(htmlVersions[0], htmlVersions[1])
    const compressed2 = await changeDetector.compressHTML(JSON.stringify(diff2.changes))
    
    // Marcar versión anterior como no actual
    await snapshot1.update({ isCurrent: false })
    
    const snapshot2 = await Snapshot.create({
      competitorId: this.competitor.id,
      versionNumber: 2,
      fullHtml: compressed2,
      isFullVersion: false,
      isCurrent: true,
      changeCount: diff2.changeCount,
      changePercentage: diff2.changePercentage,
      severity: diff2.severity,
      changeSummary: diff2.summary
    })
    this.snapshots.push(snapshot2)
    console.log(`     ✅ Versión 2 guardada (diferencial): ${snapshot2.id}`)
    console.log(`     📈 Cambios detectados: ${diff2.changeCount}, Severidad: ${diff2.severity}`)

    // Análisis 3: Segunda detección de cambios
    console.log('   📊 Análisis 3: Más cambios detectados')
    const diff3 = changeDetector.generateDiff(htmlVersions[1], htmlVersions[2])
    const compressed3 = await changeDetector.compressHTML(JSON.stringify(diff3.changes))
    
    // Marcar versión anterior como no actual
    await snapshot2.update({ isCurrent: false })
    
    const snapshot3 = await Snapshot.create({
      competitorId: this.competitor.id,
      versionNumber: 3,
      fullHtml: compressed3,
      isFullVersion: false,
      isCurrent: true,
      changeCount: diff3.changeCount,
      changePercentage: diff3.changePercentage,
      severity: diff3.severity,
      changeSummary: diff3.summary
    })
    this.snapshots.push(snapshot3)
    console.log(`     ✅ Versión 3 guardada (diferencial): ${snapshot3.id}`)
    console.log(`     📈 Cambios detectados: ${diff3.changeCount}, Severidad: ${diff3.severity}`)

    // Actualizar estadísticas del competidor
    await Competitor.update(
      { 
        totalVersions: 3,
        lastChangeAt: new Date()
      },
      { where: { id: this.competitor.id } }
    )

    console.log(`   ✅ Total de versiones guardadas: ${this.snapshots.length}`)
  }

  async testViewHistory() {
    console.log('\n📋 Paso 5: Ver historial de versiones')
    
    const response = await axios.get(`${this.baseURL}/competitors/${this.competitor.id}/history`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      },
      params: {
        limit: 10,
        offset: 0
      }
    })

    if (response.status !== 200) {
      throw new Error(`Error obteniendo historial: ${response.status}`)
    }

    const { data, pagination } = response.data

    console.log(`✅ Historial obtenido: ${data.length} versiones`)
    console.log(`   Total en BD: ${pagination.total}`)
    
    data.forEach((version, index) => {
      console.log(`   📄 Versión ${version.versionNumber}: ${version.changeCount} cambios, ${version.severity} severity`)
    })
  }

  async testVersionComparison() {
    console.log('\n🔍 Paso 6: Comparar versiones')
    
    // Comparar versión 1 vs 3 (cambios acumulados)
    const response = await axios.get(`${this.baseURL}/competitors/${this.competitor.id}/diff/1/3`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (response.status !== 200) {
      throw new Error(`Error comparando versiones: ${response.status}`)
    }

    const diff = response.data.data.diff

    console.log(`✅ Comparación v1 vs v3 completada`)
    console.log(`   📊 Cambios totales: ${diff.changeCount}`)
    console.log(`   📈 Porcentaje: ${diff.changePercentage.toFixed(2)}%`)
    console.log(`   🚨 Severidad: ${diff.severity}`)
    console.log(`   📝 Resumen: ${diff.summary}`)

    // Obtener HTML de versión específica
    const htmlResponse = await axios.get(`${this.baseURL}/competitors/${this.competitor.id}/version/3/html`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (htmlResponse.status !== 200) {
      throw new Error(`Error obteniendo HTML: ${htmlResponse.status}`)
    }

    const versionData = htmlResponse.data.data
    console.log(`✅ HTML de versión 3 obtenido: ${versionData.html.length} caracteres`)
    console.log(`   📅 Timestamp: ${versionData.timestamp}`)
    console.log(`   🔧 Es versión completa: ${versionData.isFullVersion}`)
  }

  async testMonitoringControl() {
    console.log('\n⚙️ Paso 7: Control de monitoreo')
    
    // Deshabilitar monitoreo
    const disableResponse = await axios.post(`${this.baseURL}/competitors/${this.competitor.id}/disable-monitoring`, {}, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (disableResponse.status !== 200) {
      throw new Error(`Error deshabilitando monitoreo: ${disableResponse.status}`)
    }

    console.log('✅ Monitoreo deshabilitado')

    // Verificar estado
    const getResponse = await axios.get(`${this.baseURL}/competitors/${this.competitor.id}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (getResponse.status !== 200) {
      throw new Error(`Error obteniendo competidor: ${getResponse.status}`)
    }

    const competitor = getResponse.data.data
    console.log(`✅ Estado verificado: Monitoreo ${competitor.monitoringEnabled ? 'Habilitado' : 'Deshabilitado'}`)

    // Habilitar monitoreo nuevamente
    const enableResponse = await axios.post(`${this.baseURL}/competitors/${this.competitor.id}/enable-monitoring`, {}, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (enableResponse.status !== 200) {
      throw new Error(`Error habilitando monitoreo: ${enableResponse.status}`)
    }

    console.log('✅ Monitoreo habilitado nuevamente')
  }

  async cleanup() {
    console.log('\n🧹 Limpiando datos de test...')
    
    try {
      // Eliminar snapshots
      for (const snapshot of this.snapshots) {
        await Snapshot.destroy({
          where: { id: snapshot.id },
          force: true
        })
      }

      // Eliminar competidor
      if (this.competitor) {
        await Competitor.destroy({
          where: { id: this.competitor.id },
          force: true
        })
      }

      // Eliminar usuario
      if (this.user) {
        await User.destroy({
          where: { id: this.user.id },
          force: true
        })
      }

      console.log('✅ Limpieza completada')
    } catch (error) {
      console.error('⚠️ Error durante limpieza:', error.message)
    }
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  const test = new CompleteUserFlowTest()
  test.run().catch(console.error)
}

module.exports = CompleteUserFlowTest
