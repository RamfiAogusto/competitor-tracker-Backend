/**
 * Test completo para CRUD de competidores
 * Verifica todas las operaciones CRUD implementadas directamente con la base de datos
 */

const { Competitor, User, Snapshot } = require('../src/models')
const { testConnection, syncModels } = require('../src/database/config')

class CompetitorsCRUDTest {
  constructor() {
    this.testUser = null
    this.testCompetitor = null
  }

  async run() {
    console.log('🧪 Iniciando test completo de CRUD de competidores')
    console.log('=' .repeat(60))

    try {
      await this.setup()
      await this.testCreateCompetitor()
      await this.testGetCompetitor()
      await this.testListCompetitors()
      await this.testUpdateCompetitor()
      await this.testDeleteCompetitor()
      await this.testErrorCases()
      await this.cleanup()

      console.log('\n✅ Todos los tests de CRUD pasaron exitosamente!')
    } catch (error) {
      console.error('\n❌ Error en test:', error.message)
      await this.cleanup()
      process.exit(1)
    }
  }

  async setup() {
    console.log('🔧 Configurando entorno de test...')
    
    // Verificar conexión a base de datos
    await testConnection()
    await syncModels()

    // Crear usuario de prueba
    this.testUser = await User.create({
      email: 'test-crud@example.com',
      password: 'TestPassword123!',
      name: 'Test User CRUD',
      role: 'user'
    })

    console.log(`✅ Usuario de prueba creado: ${this.testUser.id}`)
  }

  async testCreateCompetitor() {
    console.log('\n📝 Test 1: Crear competidor')
    
    const competitorData = {
      userId: this.testUser.id,
      name: 'Test Competitor CRUD',
      url: 'https://test-crud-competitor.com',
      description: 'Competidor para testing CRUD',
      monitoringEnabled: true,
      checkInterval: 1800
    }

    try {
      // Crear competidor directamente en base de datos
      this.testCompetitor = await Competitor.create(competitorData)
      
      console.log(`✅ Competidor creado: ${this.testCompetitor.id}`)
      console.log(`   Nombre: ${this.testCompetitor.name}`)
      console.log(`   URL: ${this.testCompetitor.url}`)

      // Verificar que se creó correctamente
      if (!this.testCompetitor.id) {
        throw new Error('ID no generado para el competidor')
      }
      if (this.testCompetitor.name !== competitorData.name) {
        throw new Error('Nombre no coincide')
      }
      if (this.testCompetitor.url !== competitorData.url) {
        throw new Error('URL no coincide')
      }
      if (this.testCompetitor.userId !== this.testUser.id) {
        throw new Error('UserId no coincide')
      }
      console.log('✅ Datos del competidor verificados')

      // Verificar en base de datos
      const dbCompetitor = await Competitor.findByPk(this.testCompetitor.id)
      if (!dbCompetitor) {
        throw new Error('Competidor no encontrado en base de datos')
      }
      console.log('✅ Competidor verificado en base de datos')

    } catch (error) {
      console.error('❌ Error en test de creación:', error.message)
      throw error
    }
  }

  async testGetCompetitor() {
    console.log('\n🔍 Test 2: Obtener competidor por ID')
    
    try {
      // Obtener competidor directamente de base de datos
      const competitor = await Competitor.findOne({
        where: {
          id: this.testCompetitor.id,
          userId: this.testUser.id,
          isActive: true
        }
      })

      if (!competitor) {
        throw new Error('Competidor no encontrado')
      }

      console.log(`✅ Competidor obtenido: ${competitor.name}`)
      
      // Verificar datos
      if (competitor.id !== this.testCompetitor.id) {
        throw new Error('ID del competidor no coincide')
      }
      if (competitor.name !== this.testCompetitor.name) {
        throw new Error('Nombre del competidor no coincide')
      }
      console.log('✅ Datos del competidor verificados')

    } catch (error) {
      console.error('❌ Error en test de obtención:', error.message)
      throw error
    }
  }

  async testListCompetitors() {
    console.log('\n📋 Test 3: Listar competidores')
    
    try {
      // Test con paginación - simular la lógica del endpoint
      const page = 1
      const limit = 10
      const offset = (page - 1) * limit

      const { count, rows } = await Competitor.findAndCountAll({
        where: {
          userId: this.testUser.id,
          isActive: true
        },
        limit: limit,
        offset: offset,
        order: [['created_at', 'DESC']]
      })

      console.log(`✅ Competidores listados: ${rows.length} encontrados`)
      console.log(`   Total: ${count}`)

      // Verificar que nuestro competidor esté en la lista
      const foundCompetitor = rows.find(c => c.id === this.testCompetitor.id)
      if (!foundCompetitor) {
        throw new Error('Competidor de prueba no encontrado en la lista')
      }
      console.log('✅ Competidor de prueba encontrado en lista')

      // Test con búsqueda
      const searchResults = await Competitor.findAll({
        where: {
          userId: this.testUser.id,
          isActive: true,
          name: {
            [require('sequelize').Op.iLike]: '%Test%'
          }
        }
      })
      console.log(`✅ Búsqueda realizada: ${searchResults.length} resultados para "Test"`)

    } catch (error) {
      console.error('❌ Error en test de listado:', error.message)
      throw error
    }
  }

  async testUpdateCompetitor() {
    console.log('\n✏️ Test 4: Actualizar competidor')
    
    const updateData = {
      name: 'Test Competitor CRUD - Actualizado',
      description: 'Descripción actualizada para testing',
      checkInterval: 3600
    }

    try {
      // Buscar el competidor
      const competitor = await Competitor.findOne({
        where: {
          id: this.testCompetitor.id,
          userId: this.testUser.id,
          isActive: true
        }
      })

      if (!competitor) {
        throw new Error('Competidor no encontrado')
      }

      // Actualizar el competidor
      await competitor.update(updateData)

      console.log(`✅ Competidor actualizado: ${competitor.name}`)

      // Verificar cambios
      if (competitor.name !== updateData.name) {
        throw new Error('Nombre no se actualizó correctamente')
      }
      if (competitor.description !== updateData.description) {
        throw new Error('Descripción no se actualizó correctamente')
      }
      if (competitor.checkInterval !== updateData.checkInterval) {
        throw new Error('Intervalo de verificación no se actualizó correctamente')
      }
      console.log('✅ Todos los campos se actualizaron correctamente')

      // Verificar en base de datos
      const dbCompetitor = await Competitor.findByPk(this.testCompetitor.id)
      if (dbCompetitor.name !== updateData.name) {
        throw new Error('Actualización no persistida en base de datos')
      }
      console.log('✅ Actualización verificada en base de datos')

    } catch (error) {
      console.error('❌ Error en test de actualización:', error.message)
      throw error
    }
  }

  async testDeleteCompetitor() {
    console.log('\n🗑️ Test 5: Eliminar competidor (soft delete)')
    
    try {
      // Buscar el competidor
      const competitor = await Competitor.findOne({
        where: {
          id: this.testCompetitor.id,
          userId: this.testUser.id,
          isActive: true
        }
      })

      if (!competitor) {
        throw new Error('Competidor no encontrado')
      }

      // Realizar soft delete
      await competitor.update({ isActive: false })

      console.log('✅ Competidor eliminado exitosamente')

      // Verificar que no aparezca en listados activos
      const activeCompetitors = await Competitor.findAll({
        where: {
          userId: this.testUser.id,
          isActive: true
        }
      })
      
      const foundCompetitor = activeCompetitors.find(c => c.id === this.testCompetitor.id)
      if (foundCompetitor) {
        throw new Error('Competidor eliminado aún aparece en la lista')
      }
      console.log('✅ Competidor no aparece en listados después de eliminar')

      // Verificar soft delete en base de datos
      const dbCompetitor = await Competitor.findByPk(this.testCompetitor.id)
      if (dbCompetitor && dbCompetitor.isActive) {
        throw new Error('Soft delete no funcionó correctamente')
      }
      console.log('✅ Soft delete verificado en base de datos')

    } catch (error) {
      console.error('❌ Error en test de eliminación:', error.message)
      throw error
    }
  }

  async testErrorCases() {
    console.log('\n🚫 Test 6: Casos de error')
    
    try {
      // Test: Competidor no encontrado
      const notFoundCompetitor = await Competitor.findOne({
        where: {
          id: '00000000-0000-0000-0000-000000000000',
          userId: this.testUser.id,
          isActive: true
        }
      })
      
      if (notFoundCompetitor) {
        throw new Error('No debería haber encontrado un competidor inexistente')
      }
      console.log('✅ Competidor no encontrado manejado correctamente')

      // Test: URL duplicada
      try {
        await Competitor.create({
          userId: this.testUser.id,
          name: 'Competidor Duplicado',
          url: 'https://test-crud-competitor.com', // Misma URL que el competidor de prueba
          description: 'Intentando duplicar URL'
        })
        throw new Error('Debería haber fallado por URL duplicada')
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError' || error.message.includes('duplicate')) {
          console.log('✅ Error de URL duplicada manejado correctamente')
        } else {
          throw error
        }
      }

      // Test: Datos inválidos
      try {
        await Competitor.create({
          userId: this.testUser.id,
          name: '', // Nombre vacío
          url: 'url-invalida', // URL inválida
          checkInterval: 50 // Intervalo muy corto
        })
        throw new Error('Debería haber fallado por datos inválidos')
      } catch (error) {
        if (error.name === 'SequelizeValidationError') {
          console.log('✅ Error de validación manejado correctamente')
          console.log(`   Errores: ${error.errors.length} campos inválidos`)
        } else {
          throw error
        }
      }

    } catch (error) {
      console.error('❌ Error en test de casos de error:', error.message)
      throw error
    }
  }


  async cleanup() {
    console.log('\n🧹 Limpiando datos de test...')
    
    try {
      // Eliminar competidores de prueba
      if (this.testCompetitor) {
        await Competitor.destroy({
          where: { id: this.testCompetitor.id },
          force: true // Eliminación permanente para cleanup
        })
        console.log('✅ Competidor de prueba eliminado')
      }

      // Eliminar usuario de prueba
      if (this.testUser) {
        await User.destroy({
          where: { id: this.testUser.id },
          force: true
        })
        console.log('✅ Usuario de prueba eliminado')
      }

      console.log('✅ Limpieza completada')
    } catch (error) {
      console.error('⚠️ Error durante limpieza:', error.message)
    }
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  const test = new CompetitorsCRUDTest()
  test.run().catch(console.error)
}

module.exports = CompetitorsCRUDTest
