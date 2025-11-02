/**
 * Tests del SectionExtractor con datos REALES de la base de datos
 * Estos tests usan HTML real capturado de competidores reales
 */

const sectionExtractor = require('../src/services/sectionExtractor')
const { Snapshot, Competitor } = require('../src/models')
const { sequelize } = require('../src/database/config')

describe('SectionExtractor - Tests con Datos Reales de la Base de Datos', () => {
  let realSnapshots = []
  let realCompetitors = []

  beforeAll(async () => {
    try {
      // Conectar a la base de datos
      await sequelize.authenticate()
      console.log('✅ Conectado a la base de datos')

      // Obtener TODOS los competidores reales (sin filtro específico)
      realCompetitors = await Competitor.findAll({
        limit: 10,
        order: [['created_at', 'DESC']]
      })

      console.log(`📊 Encontrados ${realCompetitors.length} competidores en total`)
      
      if (realCompetitors.length > 0) {
        console.log(`\n🎯 Competidores disponibles:`)
        realCompetitors.forEach((c, idx) => {
          console.log(`   ${idx + 1}. ${c.name} - ${c.url}`)
        })
      }

      if (realCompetitors.length === 0) {
        console.warn('⚠️ No se encontraron competidores reales en la base de datos')
        return
      }

      // Obtener snapshots reales de esos competidores
      const competitorIds = realCompetitors.map(c => c.id)
      
      realSnapshots = await Snapshot.findAll({
        where: {
          competitor_id: competitorIds,
          fullHtml: {
            [require('sequelize').Op.ne]: null
          }
        },
        order: [['created_at', 'DESC']],
        limit: 10
      })

      console.log(`📸 Encontrados ${realSnapshots.length} snapshots con HTML real`)

      if (realSnapshots.length > 0) {
        realSnapshots.forEach((snapshot, idx) => {
          const fullHtmlLength = snapshot.fullHtml?.length || 0
          console.log(`  ${idx + 1}. Snapshot ${snapshot.id} - ${(fullHtmlLength / 1024).toFixed(2)} KB - v${snapshot.version_number} - ${snapshot.changeType || 'N/A'}`)
        })
      }

    } catch (error) {
      console.error('❌ Error en setup:', error.message)
    }
  })

  afterAll(async () => {
    try {
      await sequelize.close()
      console.log('✅ Conexión a base de datos cerrada')
    } catch (error) {
      console.error('Error cerrando conexión:', error.message)
    }
  })

  describe('1. Extracción de Secciones en HTML Real', () => {
    test('Debe extraer secciones de snapshots reales', async () => {
      if (realSnapshots.length < 2) {
        console.warn('⚠️ No hay suficientes snapshots para comparar')
        return
      }

      const snapshot1 = realSnapshots[0]
      const snapshot2 = realSnapshots[1]

      expect(snapshot1.fullHtml).toBeTruthy()
      expect(snapshot2.fullHtml).toBeTruthy()

      // Simular cambios detectados (en un caso real vendrían del changeDetector)
      const mockChanges = [
        { value: 'Portfolio', added: false, removed: false },
        { value: 'Contact', added: false, removed: false }
      ]

      const result = sectionExtractor.extractChangedSection(
        snapshot1.fullHtml,
        snapshot2.fullHtml,
        mockChanges
      )

      expect(result).toHaveProperty('sections')
      expect(result).toHaveProperty('totalChanges')
      expect(result).toHaveProperty('summary')

      console.log(`\n📊 Resultado de extracción:`)
      console.log(`   - Secciones detectadas: ${result.sections.length}`)
      console.log(`   - Total de cambios: ${result.totalChanges}`)
      console.log(`   - Resumen: ${result.summary}`)

      if (result.sections.length > 0) {
        console.log(`\n🎯 Secciones encontradas:`)
        result.sections.forEach((section, idx) => {
          console.log(`   ${idx + 1}. ${section.sectionType} (${section.selector}) - Confianza: ${(section.confidence * 100).toFixed(0)}%`)
        })
      }
    })

    test('Debe identificar tipos de sección en HTML real', async () => {
      if (realSnapshots.length === 0) {
        console.warn('⚠️ No hay snapshots disponibles')
        return
      }

      const snapshot = realSnapshots[0]
      const cheerio = require('cheerio')
      const $ = cheerio.load(snapshot.fullHtml)

      // Buscar secciones comunes en el HTML real
      const commonSelectors = [
        'header', 'nav', 'main', 'section', 'article', 'footer',
        '#hero', '#pricing', '#features', '#about',
        '.hero', '.pricing', '.features', '.about'
      ]

      const foundSections = []

      commonSelectors.forEach(selector => {
        const element = $(selector).first()
        if (element.length > 0) {
          const type = sectionExtractor.identifySectionType(selector, element)
          const confidence = sectionExtractor.calculateConfidenceScore(selector, type, element)
          foundSections.push({ selector, type, confidence })
        }
      })

      console.log(`\n🔍 Secciones encontradas en HTML real:`)
      foundSections.forEach((section, idx) => {
        console.log(`   ${idx + 1}. ${section.selector} → ${section.type} (${(section.confidence * 100).toFixed(0)}%)`)
      })

      expect(foundSections.length).toBeGreaterThan(0)
    })
  })

  describe('2. Detección de Cambios Reales entre Versiones', () => {
    test('Debe detectar cambios entre versiones consecutivas del mismo competidor', async () => {
      if (realCompetitors.length === 0) {
        console.warn('⚠️ No hay competidores disponibles')
        return
      }

      const competitor = realCompetitors[0]

      // Obtener 2 versiones consecutivas del mismo competidor
      const versions = await Snapshot.findAll({
        where: {
          competitor_id: competitor.id,
          fullHtml: {
            [require('sequelize').Op.ne]: null
          }
        },
        order: [['version_number', 'DESC']],
        limit: 2
      })

      if (versions.length < 2) {
        console.warn(`⚠️ El competidor ${competitor.name} no tiene suficientes versiones`)
        return
      }

      const [newerVersion, olderVersion] = versions

      console.log(`\n📊 Comparando versiones del competidor: ${competitor.name}`)
      console.log(`   - Versión antigua: #${olderVersion.version_number} (${(olderVersion.fullHtml.length / 1024).toFixed(2)} KB)`)
      console.log(`   - Versión nueva: #${newerVersion.version_number} (${(newerVersion.fullHtml.length / 1024).toFixed(2)} KB)`)

      // Extraer cambios reales si existen en metadata
      let realChanges = []
      
      if (newerVersion.metadata?.extractedSections) {
        console.log(`\n✅ Metadata de secciones encontrada:`)
        console.log(`   - ${newerVersion.metadata.extractedSections.summary}`)
        
        if (newerVersion.metadata.extractedSections.sectionTypes) {
          console.log(`   - Tipos: ${newerVersion.metadata.extractedSections.sectionTypes.join(', ')}`)
        }
      }

      // Simular detección de cambios básicos
      const diff = require('diff')
      const textDiff = diff.diffWords(
        olderVersion.fullHtml.substring(0, 5000), // Primeros 5KB para performance
        newerVersion.fullHtml.substring(0, 5000)
      )

      textDiff.forEach(part => {
        if (part.added || part.removed) {
          realChanges.push({
            value: part.value.substring(0, 100),
            added: part.added,
            removed: part.removed
          })
        }
      })

      console.log(`\n🔍 Cambios detectados: ${realChanges.length}`)

      if (realChanges.length > 0) {
        const result = sectionExtractor.extractChangedSection(
          olderVersion.fullHtml,
          newerVersion.fullHtml,
          realChanges.slice(0, 10) // Limitar a 10 cambios para performance
        )

        console.log(`\n📊 Secciones afectadas por cambios reales:`)
        console.log(`   - ${result.summary}`)
        
        result.sections.forEach((section, idx) => {
          console.log(`   ${idx + 1}. ${section.sectionType} (${section.selector})`)
          console.log(`      - Confianza: ${(section.confidence * 100).toFixed(0)}%`)
          console.log(`      - Cambios: ${section.changes.length}`)
        })

        expect(result).toHaveProperty('sections')
        expect(result.totalChanges).toBe(realChanges.slice(0, 10).length)
      }
    })
  })

  describe('3. Análisis de Estructura de HTML Real', () => {
    test('Debe analizar la estructura completa de un snapshot real', async () => {
      if (realSnapshots.length === 0) {
        console.warn('⚠️ No hay snapshots disponibles')
        return
      }

      const snapshot = realSnapshots[0]
      const cheerio = require('cheerio')
      const $ = cheerio.load(snapshot.fullHtml)

      // Análisis de estructura
      const structure = {
        headers: $('header').length,
        navs: $('nav').length,
        mains: $('main').length,
        sections: $('section').length,
        articles: $('article').length,
        footers: $('footer').length,
        divs: $('div').length,
        forms: $('form').length,
        buttons: $('button').length,
        links: $('a').length,
        images: $('img').length
      }

      console.log(`\n📊 Estructura del HTML real (Snapshot ${snapshot.id}):`)
      Object.entries(structure).forEach(([element, count]) => {
        if (count > 0) {
          console.log(`   - ${element}: ${count}`)
        }
      })

      // Buscar IDs y clases relevantes
      const relevantIds = []
      const relevantClasses = new Set()

      $('[id]').each((i, elem) => {
        const id = $(elem).attr('id')
        if (id && (
          id.includes('hero') || 
          id.includes('pricing') || 
          id.includes('feature') ||
          id.includes('about') ||
          id.includes('contact')
        )) {
          relevantIds.push(id)
        }
      })

      $('[class]').each((i, elem) => {
        const classes = $(elem).attr('class')?.split(' ') || []
        classes.forEach(cls => {
          if (cls && (
            cls.includes('hero') || 
            cls.includes('pricing') || 
            cls.includes('feature') ||
            cls.includes('section')
          )) {
            relevantClasses.add(cls)
          }
        })
      })

      if (relevantIds.length > 0) {
        console.log(`\n🎯 IDs relevantes encontrados:`)
        relevantIds.forEach(id => console.log(`   - #${id}`))
      }

      if (relevantClasses.size > 0) {
        console.log(`\n🎯 Clases relevantes encontradas:`)
        Array.from(relevantClasses).slice(0, 10).forEach(cls => console.log(`   - .${cls}`))
      }

      expect(structure.divs).toBeGreaterThan(0)
    })
  })

  describe('4. Preparación de Datos Reales para IA', () => {
    test('Debe preparar datos reales optimizados para IA', async () => {
      if (realSnapshots.length < 2) {
        console.warn('⚠️ No hay suficientes snapshots')
        return
      }

      const snapshot1 = realSnapshots[0]
      const snapshot2 = realSnapshots[1]

      // Simular cambios
      const mockChanges = [
        { value: 'Test change 1', added: true },
        { value: 'Test change 2', removed: true }
      ]

      const extracted = sectionExtractor.extractChangedSection(
        snapshot1.fullHtml,
        snapshot2.fullHtml,
        mockChanges
      )

      const aiPayload = sectionExtractor.prepareForAI(extracted)

      console.log(`\n🤖 Payload preparado para IA:`)
      console.log(`   - Secciones: ${aiPayload.data.sections.length}`)
      console.log(`   - Tokens estimados: ${aiPayload.estimatedTokens}`)
      console.log(`   - Tamaño: ${(aiPayload.size / 1024).toFixed(2)} KB`)

      expect(aiPayload).toHaveProperty('data')
      expect(aiPayload).toHaveProperty('estimatedTokens')
      expect(aiPayload).toHaveProperty('size')
      expect(aiPayload.estimatedTokens).toBeGreaterThan(0)
      expect(aiPayload.estimatedTokens).toBeLessThan(10000) // Debe ser optimizado
    })
  })

  describe('5. Validación de Metadata Existente', () => {
    test('Debe validar metadata de secciones en snapshots existentes', async () => {
      const snapshotsWithMetadata = await Snapshot.findAll({
        where: {
          metadata: {
            [require('sequelize').Op.ne]: null
          }
        },
        limit: 5
      })

      console.log(`\n📊 Snapshots con metadata: ${snapshotsWithMetadata.length}`)

      snapshotsWithMetadata.forEach((snapshot, idx) => {
        console.log(`\n${idx + 1}. Snapshot ${snapshot.id}:`)
        
        if (snapshot.metadata?.extractedSections) {
          console.log(`   ✅ Tiene extractedSections`)
          console.log(`      - ${snapshot.metadata.extractedSections.summary}`)
          console.log(`      - Secciones: ${snapshot.metadata.extractedSections.sectionsCount || 0}`)
        } else {
          console.log(`   ❌ No tiene extractedSections`)
        }

        if (snapshot.metadata?.aiAnalysis) {
          console.log(`   ✅ Tiene aiAnalysis`)
          console.log(`      - Urgencia: ${snapshot.metadata.aiAnalysis.urgencia}`)
          console.log(`      - Recomendaciones: ${snapshot.metadata.aiAnalysis.recomendaciones?.length || 0}`)
        } else {
          console.log(`   ❌ No tiene aiAnalysis`)
        }
      })

      // Validar estructura de metadata
      snapshotsWithMetadata.forEach(snapshot => {
        if (snapshot.metadata?.extractedSections) {
          expect(snapshot.metadata.extractedSections).toHaveProperty('summary')
          expect(typeof snapshot.metadata.extractedSections.summary).toBe('string')
        }
      })
    })
  })

  describe('6. Performance con HTML Real', () => {
    test('Debe procesar HTML real en tiempo razonable', async () => {
      if (realSnapshots.length < 2) {
        console.warn('⚠️ No hay suficientes snapshots')
        return
      }

      const snapshot1 = realSnapshots[0]
      const snapshot2 = realSnapshots[1]

      const mockChanges = [
        { value: 'test1', added: true },
        { value: 'test2', removed: true },
        { value: 'test3', added: true }
      ]

      const startTime = Date.now()

      const result = sectionExtractor.extractChangedSection(
        snapshot1.fullHtml,
        snapshot2.fullHtml,
        mockChanges
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      console.log(`\n⏱️ Performance:`)
      console.log(`   - Tiempo de procesamiento: ${duration}ms`)
      console.log(`   - HTML procesado: ${((snapshot1.fullHtml.length + snapshot2.fullHtml.length) / 1024).toFixed(2)} KB`)
      console.log(`   - Secciones detectadas: ${result.sections.length}`)

      // Debe procesar en menos de 5 segundos
      expect(duration).toBeLessThan(5000)
    })
  })
})

