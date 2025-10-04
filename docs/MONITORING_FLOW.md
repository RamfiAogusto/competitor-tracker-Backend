# Flujo de Monitoreo de Competidores

## Estado Actual del Sistema

### 1. Frontend (competitor-tracker)
```
Usuario → Agregar Competidor → Habilitar Monitoreo → Captura Manual
```

**Componentes:**
- `competitors/page.tsx`: Interfaz para gestionar competidores
- `competitors-api.ts`: Cliente API para comunicación con backend
- Switch de monitoreo: `monitoringEnabled` (true/false)
- Botón de captura manual: `captureChanges()`

### 2. Backend (competitor-tracker-Backend)
```
API Endpoints → ChangeDetector → HeadlessXService → Database
```

**Endpoints disponibles:**
- `POST /api/competitors` - Crear competidor
- `POST /api/competitors/:id/enable-monitoring` - Habilitar monitoreo
- `POST /api/competitors/:id/disable-monitoring` - Deshabilitar monitoreo
- `POST /api/competitors/:id/capture` - Captura manual

**Servicios:**
- `changeDetector.js`: Lógica principal de detección de cambios
- `headlessXService.js`: Comunicación con HeadlessX API
- `alertService.js`: Generación de alertas
- `smartMessageGenerator.js`: Mensajes inteligentes

## Flujo Actual (Simulado)

### 1. Crear Competidor
```javascript
// Frontend
await competitorsApi.createCompetitor({
  name: "Competidor",
  url: "https://example.com",
  monitoringEnabled: true,
  priority: "high"
})
```

### 2. Captura Manual (Simulada)
```javascript
// Frontend
await competitorsApi.captureChanges(competitorId, {
  html: "<html>...</html>", // HTML simulado
  simulate: true
})
```

### 3. Proceso Backend
```javascript
// changeDetector.js
async captureChange(competitorId, url, options) {
  if (options.html && options.simulate) {
    // Usar HTML simulado
    return await this.processSimulatedChange(competitorId, options.html)
  } else {
    // Usar HeadlessX real
    const currentHtml = await headlessXService.extractHTML(url)
    return await this.processRealChange(competitorId, currentHtml)
  }
}
```

## Flujo Propuesto (Real con HeadlessX)

### 1. Monitoreo Automático
```javascript
// Nuevo endpoint
POST /api/competitors/:id/start-monitoring
{
  "interval": 3600, // segundos
  "options": {
    "screenshot": true,
    "fullPage": true,
    "waitFor": "networkidle"
  }
}
```

### 2. Proceso Automático
```javascript
// changeDetector.js
async startMonitoring(competitorId, interval, options) {
  // 1. Validar competidor y URL
  // 2. Configurar intervalo de monitoreo
  // 3. Ejecutar primera captura
  // 4. Programar capturas futuras
  // 5. Generar alertas automáticamente
}
```

### 3. Integración con HeadlessX
```javascript
// headlessXService.js
async extractHTML(url, options) {
  const response = await this.client.post('/extract', {
    url: url,
    options: {
      waitFor: options.waitFor || 'networkidle',
      timeout: options.timeout || 30000,
      screenshot: options.screenshot || false,
      fullPage: options.fullPage || true
    }
  })
  return response.data
}
```

## Mejoras Necesarias

### 1. Frontend
- [ ] Botón "Iniciar Monitoreo" con configuración
- [ ] Estado de monitoreo en tiempo real
- [ ] Configuración de intervalos
- [ ] Notificaciones de estado

### 2. Backend
- [ ] Endpoint para iniciar monitoreo automático
- [ ] Sistema de colas para monitoreo programado
- [ ] Manejo de errores de HeadlessX
- [ ] Reintentos automáticos
- [ ] Límites de rate limiting

### 3. Base de Datos
- [ ] Tabla de jobs de monitoreo
- [ ] Estados de monitoreo
- [ ] Historial de ejecuciones
- [ ] Métricas de rendimiento

## Próximos Pasos

1. **Implementar endpoint de monitoreo automático**
2. **Integrar con HeadlessX real**
3. **Crear sistema de colas**
4. **Mejorar interfaz de usuario**
5. **Agregar métricas y monitoreo**
