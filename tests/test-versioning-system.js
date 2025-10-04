/**
 * Script para probar el sistema de versionado completo
 * Simula el proceso de scraping y análisis de cambios
 */

const fs = require('fs').promises
const path = require('path')
const { testConnection, syncModels } = require('./src/database/config')
const { User, Competitor, Snapshot } = require('./src/models')
const ChangeDetector = require('./src/services/changeDetector')

class VersioningTester {
  constructor() {
    this.changeDetector = new ChangeDetector()
    this.testUserId = null
    this.testCompetitorId = null
    this.htmlVersions = []
  }

  async initialize() {
    console.log('🔌 Inicializando sistema de prueba...')
    
    // Probar conexión a base de datos
    const connected = await testConnection()
    if (!connected) {
      throw new Error('No se pudo conectar a la base de datos')
    }

    // Sincronizar modelos
    await syncModels()
    console.log('✅ Base de datos inicializada')

    // Crear usuario de prueba
    await this.createTestUser()
    
    // Crear competidor de prueba
    await this.createTestCompetitor()
    
    // Cargar versiones HTML
    await this.loadHtmlVersions()
    
    console.log('🚀 Sistema de prueba listo!')
  }

  async createTestUser() {
    console.log('👤 Creando usuario de prueba...')
    
    const [user, created] = await User.findOrCreate({
      where: { email: 'test@competitortracker.com' },
      defaults: {
        name: 'Usuario de Prueba',
        password: 'test123',
        role: 'admin'
      }
    })

    this.testUserId = user.id
    console.log(`✅ Usuario ${created ? 'creado' : 'encontrado'}: ${user.name}`)
  }

  async createTestCompetitor() {
    console.log('🏢 Creando competidor de prueba...')
    
    const [competitor, created] = await Competitor.findOrCreate({
      where: { 
        userId: this.testUserId,
        name: 'Competidor de Prueba'
      },
      defaults: {
        userId: this.testUserId,
        name: 'Competidor de Prueba',
        url: 'https://competidor-de-prueba.com',
        description: 'Sitio web de prueba para el sistema de versionado',
        monitoringEnabled: true,
        checkInterval: 3600
      }
    })

    this.testCompetitorId = competitor.id
    console.log(`✅ Competidor ${created ? 'creado' : 'encontrado'}: ${competitor.name}`)
  }

  async loadHtmlVersions() {
    console.log('📄 Cargando versiones HTML de prueba...')
    
    const versions = ['v1', 'v2', 'v3']
    
    for (const version of versions) {
      const filePath = path.join(__dirname, 'test-data', `test-page-${version}.html`)
      try {
        const html = await fs.readFile(filePath, 'utf8')
        this.htmlVersions.push({
          version,
          html,
          timestamp: new Date()
        })
        console.log(`✅ Cargada versión ${version} (${html.length} caracteres)`)
      } catch (error) {
        console.error(`❌ Error cargando ${version}:`, error.message)
      }
    }
  }

  async testVersioningProcess() {
    console.log('\n🔄 Iniciando prueba del sistema de versionado...')
    
    for (let i = 0; i < this.htmlVersions.length; i++) {
      const version = this.htmlVersions[i]
      console.log(`\n📊 Procesando versión ${version.version}...`)
      
      if (i === 0) {
        // Primera versión - captura inicial
        await this.captureInitialVersion(version)
      } else {
        // Versiones posteriores - detectar cambios
        await this.detectChanges(version, i)
      }
    }
  }

  async captureInitialVersion(version) {
    console.log('🎯 Capturando versión inicial...')
    
    const result = await this.changeDetector.captureInitialVersion(
      this.testCompetitorId,
      version.html
    )

    console.log(`✅ Versión inicial guardada:`)
    console.log(`   - ID: ${result.snapshot.id}`)
    console.log(`   - Versión: ${result.snapshot.versionNumber}`)
    console.log(`   - Es versión completa: ${result.snapshot.isFullVersion}`)
    console.log(`   - Tamaño HTML: ${version.html.length} caracteres`)
  }

  async detectChanges(version, index) {
    console.log('🔍 Detectando cambios...')
    
    const result = await this.changeDetector.captureChange(
      this.testCompetitorId,
      version.html
    )

    console.log(`✅ Cambios detectados:`)
    console.log(`   - ID: ${result.snapshot.id}`)
    console.log(`   - Versión: ${result.snapshot.versionNumber}`)
    console.log(`   - Cambios detectados: ${result.snapshot.changeCount}`)
    console.log(`   - Porcentaje de cambio: ${result.snapshot.changePercentage}%`)
    console.log(`   - Severidad: ${result.snapshot.severity}`)
    
    if (result.diff) {
      console.log(`   - Resumen: ${result.snapshot.changeSummary}`)
    }
  }

  async testVersionRetrieval() {
    console.log('\n📚 Probando recuperación de versiones...')
    
    // Obtener todas las versiones
    const snapshots = await Snapshot.findAll({
      where: { competitorId: this.testCompetitorId },
      order: [['versionNumber', 'ASC']]
    })

    console.log(`📋 Se encontraron ${snapshots.length} versiones:`)
    
    for (const snapshot of snapshots) {
      console.log(`\n📄 Versión ${snapshot.versionNumber}:`)
      console.log(`   - ID: ${snapshot.id}`)
      console.log(`   - Es completa: ${snapshot.isFullVersion}`)
      console.log(`   - Es actual: ${snapshot.isCurrent}`)
      console.log(`   - Cambios: ${snapshot.changeCount}`)
      console.log(`   - Severidad: ${snapshot.severity}`)
      
      // Intentar reconstruir HTML
      try {
        const html = await this.changeDetector.getHTMLFromSnapshot(snapshot.id)
        console.log(`   - HTML reconstruido: ${html.length} caracteres`)
        
        // Mostrar una muestra del HTML
        const preview = html.substring(0, 100).replace(/\s+/g, ' ')
        console.log(`   - Vista previa: ${preview}...`)
      } catch (error) {
        console.log(`   - ❌ Error reconstruyendo HTML: ${error.message}`)
      }
    }
  }

  async testChangeAnalysis() {
    console.log('\n🔬 Análisis detallado de cambios...')
    
    // Obtener diferencias entre versiones
    const snapshots = await Snapshot.findAll({
      where: { competitorId: this.testCompetitorId },
      order: [['versionNumber', 'ASC']]
    })

    for (let i = 1; i < snapshots.length; i++) {
      const fromSnapshot = snapshots[i - 1]
      const toSnapshot = snapshots[i]
      
      console.log(`\n📊 Comparando versión ${fromSnapshot.versionNumber} → ${toSnapshot.versionNumber}:`)
      console.log(`   - Cambios: ${toSnapshot.changeCount}`)
      console.log(`   - Porcentaje: ${toSnapshot.changePercentage}%`)
      console.log(`   - Severidad: ${toSnapshot.severity}`)
      
      if (toSnapshot.changeSummary) {
        console.log(`   - Resumen: ${toSnapshot.changeSummary}`)
      }
    }
  }

  async generateReport() {
    console.log('\n📊 Generando reporte final...')
    
    const competitor = await Competitor.findByPk(this.testCompetitorId, {
      include: [{ model: Snapshot, as: 'snapshots' }]
    })

    console.log('\n' + '='.repeat(60))
    console.log('📋 REPORTE FINAL DEL SISTEMA DE VERSIONADO')
    console.log('='.repeat(60))
    console.log(`🏢 Competidor: ${competitor.name}`)
    console.log(`🌐 URL: ${competitor.url}`)
    console.log(`📄 Total de versiones: ${competitor.snapshots.length}`)
    console.log(`🔄 Última verificación: ${competitor.lastCheckedAt || 'Nunca'}`)
    
    // Estadísticas de versiones
    const fullVersions = competitor.snapshots.filter(s => s.isFullVersion).length
    const diffVersions = competitor.snapshots.filter(s => !s.isFullVersion).length
    
    console.log(`\n📊 Estadísticas de almacenamiento:`)
    console.log(`   - Versiones completas: ${fullVersions}`)
    console.log(`   - Versiones diferenciales: ${diffVersions}`)
    console.log(`   - Eficiencia: ${((diffVersions / competitor.snapshots.length) * 100).toFixed(1)}%`)
    
    // Cambios más significativos
    const significantChanges = competitor.snapshots
      .filter(s => s.severity === 'high' || s.severity === 'critical')
      .length
    
    console.log(`\n🚨 Cambios significativos: ${significantChanges}`)
    
    console.log('\n' + '='.repeat(60))
  }

  async run() {
    try {
      await this.initialize()
      await this.testVersioningProcess()
      await this.testVersionRetrieval()
      await this.testChangeAnalysis()
      await this.generateReport()
      
      console.log('\n✅ ¡Prueba del sistema de versionado completada exitosamente!')
      
    } catch (error) {
      console.error('\n❌ Error durante la prueba:', error.message)
      console.error(error.stack)
    } finally {
      process.exit(0)
    }
  }
}

// Ejecutar la prueba
const tester = new VersioningTester()
tester.run()
