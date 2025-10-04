# Sistema de Prioridades de Competidores

## Estado Actual

### ✅ Implementado
- Campo `priority` en la base de datos (ENUM: 'low', 'medium', 'high')
- Validación en el middleware
- API endpoints que manejan prioridad
- Frontend muestra prioridad en lugar de severidad
- Estadísticas que cuentan por prioridad

### ❌ Funcionalidad Actual
- **Solo visualización**: La prioridad se muestra en la UI pero no afecta el comportamiento
- **Sin impacto**: No hay diferencias en frecuencia de monitoreo, notificaciones, etc.

## Comportamientos Futuros a Implementar

### 1. Frecuencia de Monitoreo
```javascript
// Comportamiento esperado basado en prioridad:
const checkIntervals = {
  'high': 900,    // 15 minutos
  'medium': 3600, // 1 hora (actual)
  'low': 14400    // 4 horas
}
```

### 2. Sistema de Notificaciones
```javascript
// Notificaciones según prioridad y severidad:
const notificationRules = {
  'high': {
    notify: ['low', 'medium', 'high', 'critical'],
    immediate: true
  },
  'medium': {
    notify: ['high', 'critical'],
    immediate: false
  },
  'low': {
    notify: ['critical'],
    immediate: false
  }
}
```

### 3. Orden de Procesamiento
```javascript
// Cola de monitoreo priorizada:
const processingOrder = [
  'high',   // Procesar primero
  'medium', // Después
  'low'     // Al final
]
```

### 4. Retención de Datos
```javascript
// Versiones históricas según prioridad:
const retentionPolicies = {
  'high': {
    maxVersions: 100,
    retentionDays: 365
  },
  'medium': {
    maxVersions: 50,
    retentionDays: 180
  },
  'low': {
    maxVersions: 20,
    retentionDays: 90
  }
}
```

## Componentes Necesarios

### 1. Scheduler/Cron Automático
- **Archivo**: `src/services/scheduler.js`
- **Función**: Ejecutar monitoreo automático según `checkInterval`
- **Tecnología**: `node-cron` o similar

### 2. Lógica de Frecuencia
- **Archivo**: `src/services/monitoringService.js`
- **Función**: Asignar `checkInterval` automáticamente según prioridad
- **Integración**: Modificar endpoint de creación/actualización

### 3. Sistema de Notificaciones
- **Archivo**: `src/services/notificationService.js`
- **Función**: Enviar notificaciones según reglas de prioridad
- **Canales**: Email, WebSocket, Push notifications

### 4. Cola de Procesamiento
- **Archivo**: `src/services/queueService.js`
- **Función**: Procesar competidores en orden de prioridad
- **Tecnología**: `bull` o `agenda`

## Archivos Relevantes Actuales

### Backend
- `src/models/Competitor.js` - Campo priority definido
- `src/routes/competitors.js` - Endpoints con prioridad
- `src/middleware/validation.js` - Validación de prioridad
- `src/database/config.js` - Configuración de enum

### Frontend
- `competitor-tracker/lib/competitors-api.ts` - Interfaz TypeScript
- `competitor-tracker/app/dashboard/competitors/page.tsx` - UI que muestra prioridad

## Próximos Pasos

### Fase 1: Scheduler Básico
1. Implementar `src/services/scheduler.js`
2. Crear endpoint manual para testing
3. Integrar con HeadlessX service

### Fase 2: Lógica de Prioridad
1. Modificar `checkInterval` según prioridad
2. Implementar cola de procesamiento
3. Agregar logs de monitoreo

### Fase 3: Notificaciones
1. Crear `notificationService.js`
2. Integrar con sistema de alertas
3. Configurar canales de notificación

### Fase 4: Optimización
1. Implementar retención de datos
2. Agregar métricas de rendimiento
3. Optimizar consultas de base de datos

## Consideraciones Técnicas

### Base de Datos
- El campo `priority` ya está sincronizado
- Enum `enum_competitors_priority` creado
- Índices pueden necesitar optimización

### Performance
- Monitoreo frecuente puede sobrecargar HeadlessX
- Implementar rate limiting por prioridad
- Considerar cache para resultados

### Escalabilidad
- Queue system para manejar múltiples competidores
- Worker processes para paralelización
- Monitoring de recursos del sistema

## Notas de Implementación

- **Compatibilidad**: Mantener competidores existentes con prioridad 'medium'
- **Testing**: Crear tests para cada nivel de prioridad
- **Documentación**: Actualizar API docs con nuevos comportamientos
- **UI/UX**: Considerar indicadores visuales de frecuencia de monitoreo

---

**Fecha de creación**: $(Get-Date -Format "yyyy-MM-dd")  
**Estado**: Documentación para implementación futura  
**Prioridad**: Media - No bloquea funcionalidad actual
