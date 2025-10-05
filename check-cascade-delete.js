/**
 * Verificar eliminación en cascada directamente en la base de datos
 */

const { Sequelize } = require('sequelize');
const config = require('./src/config');

async function checkCascadeDelete() {
  console.log('🔍 Verificando eliminación en cascada en la base de datos...');
  
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

    // 1. Verificar restricciones de clave foránea
    console.log('\n🔍 Verificando restricciones de clave foránea...');
    
    const constraints = await sequelize.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      LEFT JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND (tc.table_name = 'snapshots' OR tc.table_name = 'alerts')
      ORDER BY tc.table_name, tc.constraint_name;
    `, { type: Sequelize.QueryTypes.SELECT });

    console.log('📋 Restricciones encontradas:');
    constraints.forEach(constraint => {
      console.log(`  ${constraint.table_name}.${constraint.column_name} -> ${constraint.foreign_table_name}.${constraint.foreign_column_name} (${constraint.delete_rule || 'NO ACTION'})`);
    });

    // 2. Buscar competidores eliminados pero con datos huérfanos
    console.log('\n🔍 Buscando datos huérfanos...');
    
    const orphanedSnapshots = await sequelize.query(`
      SELECT s.id, s.competitor_id, s.version_number, s.created_at
      FROM snapshots s
      LEFT JOIN competitors c ON s.competitor_id = c.id
      WHERE c.id IS NULL
      LIMIT 10;
    `, { type: Sequelize.QueryTypes.SELECT });

    console.log(`📊 Snapshots huérfanos encontrados: ${orphanedSnapshots.length}`);
    orphanedSnapshots.forEach(snapshot => {
      console.log(`  Snapshot ${snapshot.id} (competitor_id: ${snapshot.competitor_id}, versión: ${snapshot.version_number})`);
    });

    const orphanedAlerts = await sequelize.query(`
      SELECT a.id, a.competitor_id, a.type, a.severity, a.created_at
      FROM alerts a
      LEFT JOIN competitors c ON a.competitor_id = c.id
      WHERE c.id IS NULL
      LIMIT 10;
    `, { type: Sequelize.QueryTypes.SELECT });

    console.log(`🚨 Alertas huérfanas encontradas: ${orphanedAlerts.length}`);
    orphanedAlerts.forEach(alert => {
      console.log(`  Alerta ${alert.id} (competitor_id: ${alert.competitor_id}, tipo: ${alert.type})`);
    });

    // 3. Verificar si hay competidores marcados como inactivos
    console.log('\n🔍 Verificando competidores inactivos...');
    
    const inactiveCompetitors = await sequelize.query(`
      SELECT c.id, c.name, c.is_active, 
             COUNT(s.id) as snapshot_count,
             COUNT(a.id) as alert_count
      FROM competitors c
      LEFT JOIN snapshots s ON c.id = s.competitor_id
      LEFT JOIN alerts a ON c.id = a.competitor_id
      WHERE c.is_active = false
      GROUP BY c.id, c.name, c.is_active
      ORDER BY c.created_at DESC
      LIMIT 5;
    `, { type: Sequelize.QueryTypes.SELECT });

    console.log(`📊 Competidores inactivos encontrados: ${inactiveCompetitors.length}`);
    inactiveCompetitors.forEach(competitor => {
      console.log(`  ${competitor.name} (${competitor.id}): ${competitor.snapshot_count} snapshots, ${competitor.alert_count} alertas`);
    });

    // 4. Limpiar datos huérfanos si existen
    if (orphanedSnapshots.length > 0 || orphanedAlerts.length > 0) {
      console.log('\n🧹 Limpiando datos huérfanos...');
      
      const deletedSnapshots = await sequelize.query(`
        DELETE FROM snapshots 
        WHERE id IN (
          SELECT s.id 
          FROM snapshots s
          LEFT JOIN competitors c ON s.competitor_id = c.id
          WHERE c.id IS NULL
        )
      `);
      
      const deletedAlerts = await sequelize.query(`
        DELETE FROM alerts 
        WHERE id IN (
          SELECT a.id 
          FROM alerts a
          LEFT JOIN competitors c ON a.competitor_id = c.id
          WHERE c.id IS NULL
        )
      `);
      
      console.log(`✅ Snapshots huérfanos eliminados: ${deletedSnapshots[1]}`);
      console.log(`✅ Alertas huérfanas eliminadas: ${deletedAlerts[1]}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

checkCascadeDelete().catch(console.error);
