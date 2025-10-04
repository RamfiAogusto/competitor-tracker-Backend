/**
 * Script completo para simular el proceso de scraping con análisis de cambios reales
 */

const fs = require('fs').promises
const path = require('path')
const diff = require('diff')
const { testConnection, syncModels } = require('./src/database/config')
const { User, Competitor, Snapshot } = require('./src/models')

class CompleteScrapingSimulator {
  constructor() {
    this.testUserId = null
    this.testCompetitorId = null
    this.htmlVersions = []
    this.snapshots = []
  }

  async initialize() {
    console.log('🔌 Inicializando simulador completo de scraping...')
    
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
    
    console.log('🚀 Simulador de scraping listo!')
  }

  async createTestUser() {
    console.log('👤 Creando usuario de prueba...')
    
    const [user, created] = await User.findOrCreate({
      where: { email: 'scraping@competitortracker.com' },
      defaults: {
        name: 'Usuario Scraping Test',
        password: 'test123456',
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
        name: 'Competidor Scraping Simulator'
      },
      defaults: {
        userId: this.testUserId,
        name: 'Competidor Scraping Simulator',
        url: 'https://competidor-scraping-simulator.com',
        description: 'Sitio web de prueba para simular scraping completo',
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

  async simulateScrapingProcess() {
    console.log('\n🔄 Simulando proceso completo de scraping...')
    
    for (let i = 0; i < this.htmlVersions.length; i++) {
      const htmlVersion = this.htmlVersions[i]
      const versionNumber = i + 1
      
      console.log(`\n📊 Simulando scraping - Versión ${htmlVersion.version}...`)
      console.log(`⏰ Timestamp: ${htmlVersion.timestamp.toISOString()}`)
      
      // Simular delay de scraping
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (versionNumber === 1) {
        // Primera versión - captura inicial
        await this.captureInitialSnapshot(htmlVersion, versionNumber)
      } else {
        // Versiones posteriores - detectar cambios
        await this.captureChangeSnapshot(htmlVersion, versionNumber)
      }
    }
  }

  async captureInitialSnapshot(htmlVersion, versionNumber) {
    console.log('🎯 Capturando versión inicial...')
    
    // Marcar versión anterior como no actual
    if (versionNumber > 1) {
      await Snapshot.update(
        { isCurrent: false },
        { where: { competitorId: this.testCompetitorId } }
      )
    }
    
    const snapshot = await Snapshot.create({
      competitorId: this.testCompetitorId,
      versionNumber: versionNumber,
      fullHtml: htmlVersion.html,
      isFullVersion: true, // Primera versión siempre es completa
      isCurrent: true,
      changeCount: 0,
      changePercentage: 0,
      severity: 'low',
      changeSummary: 'Versión inicial capturada'
    })

    this.snapshots.push(snapshot)
    
    console.log(`✅ Versión inicial guardada:`)
    console.log(`   - ID: ${snapshot.id}`)
    console.log(`   - Versión: ${snapshot.versionNumber}`)
    console.log(`   - Tamaño HTML: ${htmlVersion.html.length} caracteres`)
    console.log(`   - Es versión completa: ${snapshot.isFullVersion}`)
  }

  async captureChangeSnapshot(htmlVersion, versionNumber) {
    console.log('🔍 Detectando cambios...')
    
    // Obtener versión anterior
    const previousSnapshot = this.snapshots[versionNumber - 2]
    
    // Obtener HTML de la versión anterior (si no es completa, usar HTML original)
    let previousHtml = previousSnapshot.fullHtml
    if (!previousHtml) {
      // Si la versión anterior es diferencial, usar el HTML original
      previousHtml = this.htmlVersions[previousSnapshot.versionNumber - 1]?.html
    }
    
    if (!previousHtml) {
      console.error('❌ No se pudo obtener HTML de la versión anterior')
      return
    }
    
    // Calcular diferencias
    const changes = this.calculateChanges(previousHtml, htmlVersion.html)
    
    // Marcar versión anterior como no actual
    await Snapshot.update(
      { isCurrent: false },
      { where: { competitorId: this.testCompetitorId } }
    )
    
    // Determinar si debe ser versión completa o diferencial
    const shouldBeFullVersion = this.shouldCreateFullVersion(versionNumber, changes)
    
    const snapshot = await Snapshot.create({
      competitorId: this.testCompetitorId,
      versionNumber: versionNumber,
      fullHtml: shouldBeFullVersion ? htmlVersion.html : null, // Solo guardar HTML si es versión completa
      isFullVersion: shouldBeFullVersion,
      isCurrent: true,
      changeCount: changes.count,
      changePercentage: changes.percentage,
      severity: changes.severity,
      changeSummary: changes.summary
    })

    this.snapshots.push(snapshot)
    
    console.log(`✅ Cambios detectados:`)
    console.log(`   - ID: ${snapshot.id}`)
    console.log(`   - Versión: ${snapshot.versionNumber}`)
    console.log(`   - Cambios detectados: ${changes.count}`)
    console.log(`   - Porcentaje de cambio: ${changes.percentage.toFixed(2)}%`)
    console.log(`   - Severidad: ${changes.severity}`)
    console.log(`   - Es versión completa: ${snapshot.isFullVersion}`)
    console.log(`   - Resumen: ${changes.summary}`)
  }

  calculateChanges(oldHtml, newHtml) {
    // Calcular diferencias usando la librería diff
    const differences = diff.diffChars(oldHtml, newHtml)
    
    let additions = 0
    let deletions = 0
    let changes = 0
    
    differences.forEach(part => {
      if (part.added) {
        additions += part.count
        changes++
      } else if (part.removed) {
        deletions += part.count
        changes++
      }
    })
    
    // Calcular porcentaje de cambio
    const totalChanges = additions + deletions
    const percentage = (totalChanges / oldHtml.length) * 100
    
    // Determinar severidad
    let severity = 'low'
    if (percentage > 20) severity = 'critical'
    else if (percentage > 10) severity = 'high'
    else if (percentage > 5) severity = 'medium'
    
    // Generar resumen de cambios
    const summary = this.generateChangeSummary(differences, additions, deletions)
    
    return {
      count: changes,
      additions,
      deletions,
      percentage,
      severity,
      summary,
      differences
    }
  }

  generateChangeSummary(differences, additions, deletions) {
    const summaryParts = []
    
    if (additions > 0) {
      summaryParts.push(`${additions} caracteres agregados`)
    }
    if (deletions > 0) {
      summaryParts.push(`${deletions} caracteres eliminados`)
    }
    
    // Analizar tipos de cambios
    const changes = {
      text: 0,
      attributes: 0,
      structure: 0
    }
    
    differences.forEach(part => {
      if (part.added || part.removed) {
        if (part.value.includes('<') || part.value.includes('>')) {
          changes.structure++
        } else if (part.value.includes('=') || part.value.includes('"')) {
          changes.attributes++
        } else {
          changes.text++
        }
      }
    })
    
    if (changes.structure > 0) summaryParts.push(`${changes.structure} cambios estructurales`)
    if (changes.attributes > 0) summaryParts.push(`${changes.attributes} cambios de atributos`)
    if (changes.text > 0) summaryParts.push(`${changes.text} cambios de texto`)
    
    return summaryParts.join(', ')
  }

  shouldCreateFullVersion(versionNumber, changes) {
    // Crear versión completa cada 5 versiones o si el cambio es crítico
    return versionNumber % 5 === 0 || changes.severity === 'critical'
  }

  async testVersionReconstruction() {
    console.log('\n📚 Probando reconstrucción de versiones...')
    
    const snapshots = await Snapshot.findAll({
      where: { competitorId: this.testCompetitorId },
      order: [['versionNumber', 'ASC']]
    })

    console.log(`📋 Reconstruyendo ${snapshots.length} versiones:`)
    
    for (const snapshot of snapshots) {
      console.log(`\n📄 Reconstruyendo versión ${snapshot.versionNumber}:`)
      
      if (snapshot.isFullVersion) {
        // Versión completa - HTML ya está disponible
        console.log(`   ✅ Versión completa disponible`)
        console.log(`   - HTML: ${snapshot.fullHtml.length} caracteres`)
        
        // Verificar contra HTML original
        const originalHtml = this.htmlVersions[snapshot.versionNumber - 1]
        if (originalHtml && snapshot.fullHtml === originalHtml.html) {
          console.log(`   ✅ HTML coincide exactamente con el original`)
        } else {
          console.log(`   ⚠️ HTML difiere del original`)
        }
      } else {
        // Versión diferencial - necesitaríamos reconstruir desde la versión completa anterior
        console.log(`   🔄 Versión diferencial - requiere reconstrucción`)
        console.log(`   - Cambios: ${snapshot.changeCount}`)
        console.log(`   - Porcentaje: ${snapshot.changePercentage}%`)
        
        // En un sistema real, aquí reconstruiríamos el HTML aplicando las diferencias
        console.log(`   - Resumen: ${snapshot.changeSummary}`)
      }
    }
  }

  async generateDetailedReport() {
    console.log('\n📊 Generando reporte detallado del scraping...')
    
    const competitor = await Competitor.findByPk(this.testCompetitorId, {
      include: [{ model: Snapshot, as: 'snapshots' }]
    })

    console.log('\n' + '='.repeat(80))
    console.log('📋 REPORTE DETALLADO DEL SIMULADOR DE SCRAPING')
    console.log('='.repeat(80))
    console.log(`🏢 Competidor: ${competitor.name}`)
    console.log(`🌐 URL: ${competitor.url}`)
    console.log(`📄 Total de versiones: ${competitor.snapshots.length}`)
    console.log(`🔄 Última verificación: ${competitor.lastCheckedAt || 'Nunca'}`)
    
    // Análisis de almacenamiento
    const fullVersions = competitor.snapshots.filter(s => s.isFullVersion).length
    const diffVersions = competitor.snapshots.filter(s => !s.isFullVersion).length
    
    let totalStorage = 0
    competitor.snapshots.forEach(snapshot => {
      if (snapshot.isFullVersion && snapshot.fullHtml) {
        totalStorage += snapshot.fullHtml.length
      } else {
        // Estimar tamaño de diferencias (aproximadamente 20% del tamaño original)
        totalStorage += this.htmlVersions[snapshot.versionNumber - 1]?.html.length * 0.2 || 0
      }
    })
    
    const theoreticalMaxStorage = this.htmlVersions[this.htmlVersions.length - 1]?.html.length * competitor.snapshots.length || 0
    
    console.log(`\n💾 Análisis de almacenamiento:`)
    console.log(`   - Versiones completas: ${fullVersions}`)
    console.log(`   - Versiones diferenciales: ${diffVersions}`)
    console.log(`   - Almacenamiento actual: ~${Math.round(totalStorage)} caracteres`)
    console.log(`   - Almacenamiento máximo teórico: ${theoreticalMaxStorage} caracteres`)
    console.log(`   - Eficiencia: ${Math.round((1 - totalStorage / theoreticalMaxStorage) * 100)}%`)
    
    // Análisis de cambios
    const severityCount = {
      low: competitor.snapshots.filter(s => s.severity === 'low').length,
      medium: competitor.snapshots.filter(s => s.severity === 'medium').length,
      high: competitor.snapshots.filter(s => s.severity === 'high').length,
      critical: competitor.snapshots.filter(s => s.severity === 'critical').length
    }
    
    console.log(`\n📈 Análisis de cambios:`)
    console.log(`   - Cambios bajos: ${severityCount.low}`)
    console.log(`   - Cambios medios: ${severityCount.medium}`)
    console.log(`   - Cambios altos: ${severityCount.high}`)
    console.log(`   - Cambios críticos: ${severityCount.critical}`)
    
    // Timeline de cambios
    console.log(`\n📅 Timeline de cambios:`)
    competitor.snapshots.forEach(snapshot => {
      const originalVersion = this.htmlVersions[snapshot.versionNumber - 1]
      console.log(`   V${snapshot.versionNumber}: ${snapshot.changeCount} cambios (${snapshot.changePercentage}%) - ${snapshot.severity} - ${originalVersion?.version || 'N/A'}`)
    })
    
    console.log('\n' + '='.repeat(80))
  }

  async run() {
    try {
      await this.initialize()
      await this.simulateScrapingProcess()
      await this.testVersionReconstruction()
      await this.generateDetailedReport()
      
      console.log('\n✅ ¡Simulación completa de scraping terminada exitosamente!')
      
    } catch (error) {
      console.error('\n❌ Error durante la simulación:', error.message)
      console.error(error.stack)
    } finally {
      process.exit(0)
    }
  }
}

// Ejecutar la simulación
const simulator = new CompleteScrapingSimulator()
simulator.run()
