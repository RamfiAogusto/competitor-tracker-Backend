/**
 * Índice de modelos
 * Define las relaciones entre modelos y exporta todas las instancias
 */

const User = require('./User')
const Competitor = require('./Competitor')
const Snapshot = require('./Snapshot')
const SnapshotDiff = require('./SnapshotDiff')
const Alert = require('./Alert')

// Definir relaciones

// Un usuario puede tener muchos competidores
User.hasMany(Competitor, {
  foreignKey: 'userId',
  as: 'competitors',
  onDelete: 'CASCADE'
})

// Un competidor pertenece a un usuario
Competitor.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
})

// Un competidor puede tener muchos snapshots
Competitor.hasMany(Snapshot, {
  foreignKey: 'competitorId',
  as: 'snapshots',
  onDelete: 'CASCADE'
})

// Un competidor puede tener un snapshot actual
Competitor.hasMany(Snapshot, {
  foreignKey: 'competitorId',
  as: 'lastSnapshot',
  onDelete: 'CASCADE'
})

// Un snapshot pertenece a un competidor
Snapshot.belongsTo(Competitor, {
  foreignKey: 'competitorId',
  as: 'competitor'
})

// Un usuario puede tener muchas alertas
User.hasMany(Alert, {
  foreignKey: 'userId',
  as: 'alerts',
  onDelete: 'CASCADE'
})

// Una alerta pertenece a un usuario
Alert.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
})

// Un competidor puede tener muchas alertas
Competitor.hasMany(Alert, {
  foreignKey: 'competitorId',
  as: 'alerts',
  onDelete: 'CASCADE'
})

// Una alerta pertenece a un competidor
Alert.belongsTo(Competitor, {
  foreignKey: 'competitorId',
  as: 'competitor'
})

// Un snapshot puede tener muchas alertas
Snapshot.hasMany(Alert, {
  foreignKey: 'snapshotId',
  as: 'alerts',
  onDelete: 'SET NULL'
})

// Una alerta puede estar relacionada con un snapshot
Alert.belongsTo(Snapshot, {
  foreignKey: 'snapshotId',
  as: 'snapshot'
})

// Un snapshot puede tener muchos diffs como "desde"
Snapshot.hasMany(SnapshotDiff, {
  foreignKey: 'fromSnapshotId',
  as: 'diffsFrom',
  onDelete: 'CASCADE'
})

// Un snapshot puede tener muchos diffs como "hacia"
Snapshot.hasMany(SnapshotDiff, {
  foreignKey: 'toSnapshotId',
  as: 'diffsTo',
  onDelete: 'CASCADE'
})

// Un diff pertenece a un snapshot (desde)
SnapshotDiff.belongsTo(Snapshot, {
  foreignKey: 'fromSnapshotId',
  as: 'fromSnapshot'
})

// Un diff pertenece a un snapshot (hacia)
SnapshotDiff.belongsTo(Snapshot, {
  foreignKey: 'toSnapshotId',
  as: 'toSnapshot'
})

module.exports = {
  User,
  Competitor,
  Snapshot,
  SnapshotDiff,
  Alert
}
