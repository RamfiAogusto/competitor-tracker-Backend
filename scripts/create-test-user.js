/**
 * Script para crear usuario de prueba
 * Necesario para las pruebas de integración
 */

require('dotenv').config();
const { sequelize } = require('../src/database/config');
const User = require('../src/models/User');

const TEST_USER = {
  email: 'ramfiaogusto@gmail.com',
  password: '12345678', // El hook beforeCreate lo hasheará
  name: 'Test User',
  role: 'admin',
  isActive: true,
  emailVerified: true
};

async function createTestUser() {
  console.log('🔄 Conectando a la base de datos...');
  
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión establecida.');

    // Sincronizar modelos (con cuidado de no borrar todo si no es necesario, pero para test user aseguramos que la tabla exista)
    // await sequelize.sync(); 

    const existingUser = await User.findOne({ where: { email: TEST_USER.email } });

    if (existingUser) {
      console.log('ℹ️ El usuario de prueba ya existe:', existingUser.email);
       // Opcional: Actualizar contraseña si es necesario para asegurar que el test pase
       existingUser.password = TEST_USER.password;
       await existingUser.save();
       console.log('✅ Contraseña actualizada para asegurar acceso.');
    } else {
      console.log('🆕 Creando usuario de prueba...');
      await User.create(TEST_USER);
      console.log('✅ Usuario creado exitosamente:', TEST_USER.email);
    }

  } catch (error) {
    console.error('❌ Error creando usuario:', error);
  } finally {
    await sequelize.close();
    console.log('🔌 Conexión cerrada.');
  }
}

createTestUser();
