'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Agregando columna metadata a la tabla snapshots...');
    await queryInterface.addColumn('snapshots', 'metadata', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    console.log('✅ Columna metadata agregada exitosamente');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('Eliminando columna metadata de la tabla snapshots...');
    await queryInterface.removeColumn('snapshots', 'metadata');
    console.log('✅ Columna metadata eliminada exitosamente');
  }
};

