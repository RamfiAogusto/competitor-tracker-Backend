/**
 * Test simple de eliminación física
 */

const { Sequelize } = require('sequelize');
const config = require('./src/config');

async function testSimpleDelete() {
  console.log('🧪 Probando eliminación física simple...');
  
  const sequelize = new Sequelize({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    username: config.database.username,
    password: config.database.password,
    dialect: 'postgres',
    logging: false
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');

    // Buscar un competidor inactivo para eliminar
    const inactiveCompetitor = await sequelize.query(`
      SELECT c.id, c.name, c.is_active, 
             COUNT(s.id) as snapshot_count,
             COUNT(a.id) as alert_count
      FROM competitors c
      LEFT JOIN snapshots s ON c.id = s.competitor_id
      LEFT JOIN alerts a ON c.id = a.competitor_id
      WHERE c.is_active = false
      GROUP BY c.id, c.name, c.is_active
      ORDER BY c.created_at DESC
      LIMIT 1;
    `, { type: Sequelize.QueryTypes.SELECT });

    if (inactiveCompetitor.length === 0) {
      console.log('❌ No hay competidores inactivos para eliminar');
      return;
    }

    const competitor = inactiveCompetitor[0];
    console.log(`🎯 Competidor seleccionado: ${competitor.name} (${competitor.id})`);
    console.log(`📊 Datos relacionados: ${competitor.snapshot_count} snapshots, ${competitor.alert_count} alertas`);

    // Eliminar físicamente
    console.log('🗑️ Eliminando físicamente...');
    const deleteResult = await sequelize.query(`
      DELETE FROM competitors WHERE id = :competitorId
    `, {
      replacements: { competitorId: competitor.id },
      type: Sequelize.QueryTypes.DELETE
    });

    console.log(`✅ Competidor eliminado: ${deleteResult} fila(s)`);

    // Verificar que los datos relacionados fueron eliminados
    console.log('🔍 Verificando eliminación en cascada...');
    
    const remainingSnapshots = await sequelize.query(`
      SELECT COUNT(*) as count FROM snapshots WHERE competitor_id = :competitorId
    `, {
      replacements: { competitorId: competitor.id },
      type: Sequelize.QueryTypes.SELECT
    });

    const remainingAlerts = await sequelize.query(`
      SELECT COUNT(*) as count FROM alerts WHERE competitor_id = :competitorId
    `, {
      replacements: { competitorId: competitor.id },
      type: Sequelize.QueryTypes.SELECT
    });

    console.log(`📊 Snapshots restantes: ${remainingSnapshots[0].count}`);
    console.log(`🚨 Alertas restantes: ${remainingAlerts[0].count}`);

    if (remainingSnapshots[0].count === 0 && remainingAlerts[0].count === 0) {
      console.log('🎉 ¡Eliminación en cascada funcionó correctamente!');
    } else {
      console.log('❌ La eliminación en cascada no funcionó como esperado');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

testSimpleDelete().catch(console.error);
