# Competitor Tracker Backend

Backend API para el sistema de monitoreo de competidores y detección de cambios en tiempo real.

## 🚀 Características

- **Monitoreo automatizado** de sitios web de competidores
- **Detección inteligente de cambios** con sistema de versionado incremental
- **API RESTful** completa con autenticación JWT
- **Integración con HeadlessX** para scraping avanzado
- **Sistema de alertas** configurable
- **Dashboard de métricas** en tiempo real
- **Arquitectura escalable** con separación de responsabilidades

## 🏗️ Arquitectura

```
Frontend (Next.js) → Backend (Express.js) → HeadlessX (Scraping Service)
                                  ↓
                            PostgreSQL Database
```

## 📁 Estructura del Proyecto

```
src/
├── config/           # Configuración de la aplicación
├── controllers/      # Controladores de rutas
├── services/         # Lógica de negocio y servicios externos
├── models/          # Modelos de base de datos (Sequelize)
├── routes/          # Definición de rutas API
├── middleware/      # Middlewares personalizados
├── utils/           # Utilidades y helpers
├── database/        # Configuración y migraciones de BD
├── app.js           # Configuración principal de Express
└── server.js        # Punto de entrada del servidor
```

## 🛠️ Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **PostgreSQL** - Base de datos principal
- **Sequelize** - ORM para base de datos
- **JWT** - Autenticación
- **Winston** - Logging estructurado
- **Jest** - Testing
- **ESLint** - Linting de código

## 📦 Instalación

### Prerrequisitos

- Node.js >= 16.0.0
- npm >= 8.0.0
- PostgreSQL >= 12
- HeadlessX desplegado

### Pasos de instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd competitor-tracker-Backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
# Editar .env con tus configuraciones
```

4. **Configurar base de datos**
```bash
# Crear base de datos
createdb competitor_tracker

# Ejecutar migraciones (cuando estén disponibles)
npm run db:migrate
```

5. **Iniciar en modo desarrollo**
```bash
npm run dev
```

## ⚙️ Configuración

### Variables de Entorno

Copia `env.example` a `.env` y configura las siguientes variables:

```env
# Servidor
NODE_ENV=development
PORT=3001

# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=competitor_tracker
DB_USER=postgres
DB_PASSWORD=your_password

# HeadlessX
HEADLESSX_URL=http://localhost:3000
HEADLESSX_TOKEN=your_token

# JWT
JWT_SECRET=your_super_secret_key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚀 Uso

### Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar con nodemon
npm start            # Iniciar en producción

# Testing
npm test             # Ejecutar tests
npm run test:watch   # Tests en modo watch
npm run test:coverage # Tests con coverage

# Calidad de código
npm run lint         # Verificar código
npm run lint:fix     # Corregir automáticamente

# Base de datos
npm run db:migrate   # Ejecutar migraciones
npm run db:seed      # Poblar datos de prueba
```

### API Endpoints

#### Autenticación
- `POST /api/users/register` - Registro de usuario
- `POST /api/users/login` - Inicio de sesión
- `POST /api/users/refresh` - Renovar token

#### Competidores
- `GET /api/competitors` - Listar competidores
- `POST /api/competitors` - Crear competidor
- `GET /api/competitors/:id` - Obtener competidor
- `PUT /api/competitors/:id` - Actualizar competidor
- `DELETE /api/competitors/:id` - Eliminar competidor

#### Capturas
- `POST /api/competitors/:id/capture` - Capturar cambios
- `GET /api/competitors/:id/history` - Historial de versiones
- `GET /api/competitors/:id/version/:version/html` - HTML de versión

#### Alertas
- `GET /api/alerts` - Listar alertas
- `PUT /api/alerts/:id` - Actualizar alerta
- `DELETE /api/alerts/:id` - Eliminar alerta

#### Dashboard
- `GET /api/dashboard/stats` - Estadísticas generales
- `GET /api/dashboard/recent-changes` - Cambios recientes

### Ejemplo de Uso

```javascript
// Crear competidor
const response = await fetch('/api/competitors', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    name: 'TechCorp',
    url: 'https://techcorp.com',
    description: 'Competidor principal'
  })
})

// Capturar cambios
const captureResponse = await fetch('/api/competitors/competitor-id/capture', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
})
```

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch

# Tests específicos
npm test -- --grep "competitor"
```

## 📊 Sistema de Versionado

El sistema implementa un **sistema de versionado inteligente** que:

- Guarda solo diferencias entre versiones
- Mantiene versiones completas periódicamente
- Optimiza automáticamente el almacenamiento
- Permite reconstruir cualquier versión histórica

Ver [SISTEMA_VERSIONADO_COMPETITOR_TRACKER.md](./SISTEMA_VERSIONADO_COMPETITOR_TRACKER.md) para detalles completos.

## 🔒 Seguridad

- **Autenticación JWT** con tokens de acceso y refresh
- **Rate limiting** por IP y usuario
- **Validación de entrada** con express-validator
- **Headers de seguridad** con Helmet
- **CORS** configurado
- **Logging de auditoría** para acciones críticas

## 📈 Monitoreo

- **Health checks** en `/health`
- **Status de servicios** en `/api/status`
- **Logs estructurados** con Winston
- **Métricas de rendimiento** integradas

## 🚀 Despliegue

### Docker

```bash
# Construir imagen
docker build -t competitor-tracker-backend .

# Ejecutar contenedor
docker run -p 3001:3001 --env-file .env competitor-tracker-backend
```

### PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start src/app.js --name competitor-tracker-backend

# Configurar para reinicio automático
pm2 startup
pm2 save
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 📞 Soporte

- **Documentación**: Ver archivos en `/docs`
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Email**: support@competitortracker.com

## 🗺️ Roadmap

- [ ] Implementación completa de base de datos
- [ ] Sistema de notificaciones por email
- [ ] API de webhooks
- [ ] Dashboard de analytics avanzado
- [ ] Integración con más servicios de scraping
- [ ] Sistema de machine learning para detección de cambios
- [ ] API GraphQL
- [ ] Cache con Redis
