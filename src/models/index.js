/**
 * Índice de modelos
 * Define las relaciones entre modelos y exporta todas las instancias
 */

const User = require('./User')
const Competitor = require('./Competitor')
const Snapshot = require('./Snapshot')

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

module.exports = {
  User,
  Competitor,
  Snapshot
}
