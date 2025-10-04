/**
 * Test de funcionalidades avanzadas de Competitors
 * Verifica historial, HTML de versiones, monitoreo y comparación
 */

const axios = require('axios')
const { User, Competitor, Snapshot } = require('../src/models')
const { testConnection, syncModels } = require('../src/database/config')
const changeDetector = require('../src/services/changeDetector')

class CompetitorsAdvancedTest {
  constructor() {
    this.baseURL = 'http://localhost:3002/api'
    this.testUser = null
    this.authToken = null
    this.testCompetitor = null
    this.testSnapshots = []
  }

  async run() {
    console.log('🏢 Test de funcionalidades avanzadas de Competitors')
    console.log('=' .repeat(60))

    try {
      await this.setup()
      await this.createTestData()
      await this.testHistoryEndpoint()
      await this.testVersionHtmlEndpoint()
      await this.testMonitoringEndpoints()
      await this.testDiffEndpoint()
      await this.testErrorCases()
      await this.cleanup()

      console.log('\n✅ Todos los tests avanzados de Competitors completados exitosamente!')
    } catch (error) {
      console.error('\n❌ Error en test avanzado de Competitors:', error.message)
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

  async createTestData() {
    console.log('\n📊 Creando datos de prueba...')

    // Crear usuario de prueba
    this.testUser = await User.create({
      email: 'test-advanced@example.com',
      password: 'TestPassword123!',
      name: 'Test Advanced',
      role: 'user'
    })

    // Generar token JWT
    const { generateTokens } = require('../src/middleware/auth')
    const tokens = generateTokens({
      id: this.testUser.id,
      email: this.testUser.email,
      role: this.testUser.role
    })
    this.authToken = tokens.accessToken

    // Crear competidor de prueba
    this.testCompetitor = await Competitor.create({
      userId: this.testUser.id,
      name: 'Test Competitor Advanced',
      url: 'https://test-advanced.com',
      description: 'Competidor para pruebas avanzadas',
      monitoringEnabled: true
    })

    // Crear snapshots de prueba con diferentes versiones
    const htmlVersions = [
      '<html><head><title>Versión 1</title></head><body><h1>Página Original</h1><p>Contenido inicial</p></body></html>',
      '<html><head><title>Versión 2</title></head><body><h1>Página Actualizada</h1><p>Contenido modificado</p><div>Nuevo contenido</div></body></html>',
      '<html><head><title>Versión 3</title></head><body><h1>Página Final</h1><p>Contenido final</p><div>Nuevo contenido</div><footer>Pie de página</footer></body></html>'
    ]

    // Versión 1: Completa
    const compressed1 = await changeDetector.compressHTML(htmlVersions[0])
    const snapshot1 = await Snapshot.create({
      competitorId: this.testCompetitor.id,
      versionNumber: 1,
      fullHtml: compressed1,
      isFullVersion: true,
      isCurrent: false,
      changeCount: 0,
      changePercentage: 0,
      severity: 'low',
      changeSummary: 'Versión inicial completa'
    })

    // Versión 2: Diferencial
    const diff2 = changeDetector.generateDiff(htmlVersions[0], htmlVersions[1])
    const compressed2 = await changeDetector.compressHTML(JSON.stringify(diff2.changes))
    const snapshot2 = await Snapshot.create({
      competitorId: this.testCompetitor.id,
      versionNumber: 2,
      fullHtml: compressed2,
      isFullVersion: false,
      isCurrent: false,
      changeCount: diff2.changeCount,
      changePercentage: diff2.changePercentage,
      severity: diff2.severity,
      changeSummary: diff2.summary
    })

    // Versión 3: Diferencial (actual)
    const diff3 = changeDetector.generateDiff(htmlVersions[1], htmlVersions[2])
    const compressed3 = await changeDetector.compressHTML(JSON.stringify(diff3.changes))
    const snapshot3 = await Snapshot.create({
      competitorId: this.testCompetitor.id,
      versionNumber: 3,
      fullHtml: compressed3,
      isFullVersion: false,
      isCurrent: true,
      changeCount: diff3.changeCount,
      changePercentage: diff3.changePercentage,
      severity: diff3.severity,
      changeSummary: diff3.summary
    })

    this.testSnapshots = [snapshot1, snapshot2, snapshot3]

    console.log(`✅ Datos creados: Usuario ${this.testUser.id}, Competidor ${this.testCompetitor.id}`)
    console.log(`✅ Snapshots creados: ${this.testSnapshots.length} versiones`)
  }

  async testHistoryEndpoint() {
    console.log('\n📋 Test 1: Historial de versiones')
    
    try {
      const response = await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/history`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        },
        params: {
          limit: 10,
          offset: 0
        }
      })

      if (response.status !== 200) {
        throw new Error(`Error: ${response.status}`)
      }

      const { data, pagination } = response.data

      console.log(`✅ Historial obtenido: ${data.length} versiones`)
      console.log(`   Total en BD: ${pagination.total}`)
      console.log(`   Versiones: ${data.map(v => v.versionNumber).join(', ')}`)

      // Verificar que las versiones están ordenadas correctamente
      const versions = data.map(v => v.versionNumber)
      const sortedVersions = [...versions].sort((a, b) => b - a)
      
      if (JSON.stringify(versions) !== JSON.stringify(sortedVersions)) {
        throw new Error('Las versiones no están ordenadas correctamente')
      }
      console.log('✅ Orden de versiones correcto (descendente)')

    } catch (error) {
      console.error('❌ Error en historial:', error.message)
      throw error
    }
  }

  async testVersionHtmlEndpoint() {
    console.log('\n📄 Test 2: HTML de versión específica')
    
    try {
      // Test versión completa (v1)
      const response1 = await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/version/1/html`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })

      if (response1.status !== 200) {
        throw new Error(`Error v1: ${response1.status}`)
      }

      const version1 = response1.data.data
      console.log(`✅ Versión 1 obtenida: ${version1.html.length} caracteres`)
      console.log(`   Es versión completa: ${version1.isFullVersion}`)

      // Test versión diferencial (v2)
      const response2 = await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/version/2/html`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })

      if (response2.status !== 200) {
        throw new Error(`Error v2: ${response2.status}`)
      }

      const version2 = response2.data.data
      console.log(`✅ Versión 2 obtenida: ${version2.html.length} caracteres`)
      console.log(`   Es versión completa: ${version2.isFullVersion}`)

      // Test versión diferencial (v3)
      const response3 = await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/version/3/html`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })

      if (response3.status !== 200) {
        throw new Error(`Error v3: ${response3.status}`)
      }

      const version3 = response3.data.data
      console.log(`✅ Versión 3 obtenida: ${version3.html.length} caracteres`)
      console.log(`   Es versión completa: ${version3.isFullVersion}`)

      // Verificar que las versiones son diferentes
      if (version1.html === version2.html) {
        throw new Error('Versión 1 y 2 no deberían ser iguales')
      }
      if (version2.html === version3.html) {
        throw new Error('Versión 2 y 3 no deberían ser iguales')
      }
      console.log('✅ Versiones son diferentes entre sí')

    } catch (error) {
      console.error('❌ Error en HTML de versión:', error.message)
      throw error
    }
  }

  async testMonitoringEndpoints() {
    console.log('\n🔍 Test 3: Habilitar/deshabilitar monitoreo')
    
    try {
      // Test deshabilitar monitoreo
      const disableResponse = await axios.post(`${this.baseURL}/competitors/${this.testCompetitor.id}/disable-monitoring`, {}, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })

      if (disableResponse.status !== 200) {
        throw new Error(`Error deshabilitando: ${disableResponse.status}`)
      }

      console.log('✅ Monitoreo deshabilitado exitosamente')

      // Verificar en BD
      await this.testCompetitor.reload()
      if (this.testCompetitor.monitoringEnabled !== false) {
        throw new Error('Monitoreo no se deshabilitó en BD')
      }
      console.log('✅ Monitoreo deshabilitado verificado en BD')

      // Test habilitar monitoreo
      const enableResponse = await axios.post(`${this.baseURL}/competitors/${this.testCompetitor.id}/enable-monitoring`, {}, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })

      if (enableResponse.status !== 200) {
        throw new Error(`Error habilitando: ${enableResponse.status}`)
      }

      console.log('✅ Monitoreo habilitado exitosamente')

      // Verificar en BD
      await this.testCompetitor.reload()
      if (this.testCompetitor.monitoringEnabled !== true) {
        throw new Error('Monitoreo no se habilitó en BD')
      }
      console.log('✅ Monitoreo habilitado verificado en BD')

    } catch (error) {
      console.error('❌ Error en monitoreo:', error.message)
      throw error
    }
  }

  async testDiffEndpoint() {
    console.log('\n🔍 Test 4: Comparación de versiones')
    
    try {
      // Test comparar v1 vs v2
      const response1 = await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/diff/1/2`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })

      if (response1.status !== 200) {
        throw new Error(`Error comparando v1 vs v2: ${response1.status}`)
      }

      const diff1 = response1.data.data.diff
      console.log(`✅ Comparación v1 vs v2: ${diff1.changeCount} cambios`)
      console.log(`   Severidad: ${diff1.severity}`)
      console.log(`   Porcentaje: ${diff1.changePercentage.toFixed(2)}%`)

      // Test comparar v2 vs v3
      const response2 = await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/diff/2/3`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })

      if (response2.status !== 200) {
        throw new Error(`Error comparando v2 vs v3: ${response2.status}`)
      }

      const diff2 = response2.data.data.diff
      console.log(`✅ Comparación v2 vs v3: ${diff2.changeCount} cambios`)
      console.log(`   Severidad: ${diff2.severity}`)
      console.log(`   Porcentaje: ${diff2.changePercentage.toFixed(2)}%`)

      // Test comparar v1 vs v3 (cambios acumulados)
      const response3 = await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/diff/1/3`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      })

      if (response3.status !== 200) {
        throw new Error(`Error comparando v1 vs v3: ${response3.status}`)
      }

      const diff3 = response3.data.data.diff
      console.log(`✅ Comparación v1 vs v3: ${diff3.changeCount} cambios`)
      console.log(`   Severidad: ${diff3.severity}`)
      console.log(`   Porcentaje: ${diff3.changePercentage.toFixed(2)}%`)

      // Verificar que v1 vs v3 tiene más cambios que v1 vs v2
      if (diff3.changeCount < diff1.changeCount) {
        throw new Error('v1 vs v3 debería tener más cambios que v1 vs v2')
      }
      console.log('✅ Lógica de cambios acumulados correcta')

    } catch (error) {
      console.error('❌ Error en comparación:', error.message)
      throw error
    }
  }

  async testErrorCases() {
    console.log('\n🚫 Test 5: Casos de error')
    
    try {
      // Test: Competidor inexistente
      try {
        await axios.get(`${this.baseURL}/competitors/00000000-0000-0000-0000-000000000000/history`, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        })
        throw new Error('Debería haber devuelto 404')
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log('✅ Error 404 manejado correctamente para competidor inexistente')
        } else {
          throw error
        }
      }

      // Test: Versión inexistente
      try {
        await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/version/999/html`, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        })
        throw new Error('Debería haber devuelto 404')
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log('✅ Error 404 manejado correctamente para versión inexistente')
        } else {
          throw error
        }
      }

      // Test: Comparación con versión inexistente
      try {
        await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/diff/1/999`, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        })
        throw new Error('Debería haber devuelto 404')
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log('✅ Error 404 manejado correctamente para comparación con versión inexistente')
        } else {
          throw error
        }
      }

      // Test: Acceso sin token
      try {
        await axios.get(`${this.baseURL}/competitors/${this.testCompetitor.id}/history`)
        throw new Error('Debería haber devuelto 401')
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log('✅ Error 401 manejado correctamente para acceso sin token')
        } else {
          throw error
        }
      }

    } catch (error) {
      console.error('❌ Error en casos de error:', error.message)
      throw error
    }
  }

  async cleanup() {
    console.log('\n🧹 Limpiando datos de test...')
    
    try {
      // Eliminar snapshots
      for (const snapshot of this.testSnapshots) {
        await Snapshot.destroy({
          where: { id: snapshot.id },
          force: true
        })
      }

      // Eliminar competidor
      if (this.testCompetitor) {
        await Competitor.destroy({
          where: { id: this.testCompetitor.id },
          force: true
        })
      }

      // Eliminar usuario
      if (this.testUser) {
        await User.destroy({
          where: { id: this.testUser.id },
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
  const test = new CompetitorsAdvancedTest()
  test.run().catch(console.error)
}

module.exports = CompetitorsAdvancedTest
