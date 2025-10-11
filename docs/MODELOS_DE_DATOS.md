# 📊 Modelos de Datos - CompetitorWatch Backend

> Documentación completa de los modelos de datos utilizados en el sistema

---

## 🏢 Modelo: Competitor

### Tabla: `competitors`

```javascript
{
  id: UUID (PK),
  userId: UUID (FK → users.id),
  name: STRING(2-100),
  url: TEXT (URL válida),
  description: TEXT(0-500),
  monitoringEnabled: BOOLEAN (default: true),
  checkInterval: INTEGER (segundos, min: 300, max: 86400, default: 3600),
  priority: ENUM('low', 'medium', 'high'),
  lastCheckedAt: DATE,
  totalVersions: INTEGER (default: 0),
  lastChangeAt: DATE,
  isActive: BOOLEAN (default: true),
  created_at: DATE (auto),
  updated_at: DATE (auto)
}
```

### Campos Adicionales en Response (calculados)
```javascript
{
  severity: ENUM('low', 'medium', 'high', 'critical'),  // Del último snapshot
  changeCount: INTEGER  // Del último snapshot
}
```

### Índices
- `user_id`
- `monitoring_enabled`
- `last_checked_at`

---

## 📸 Modelo: Snapshot

### Tabla: `snapshots`

```javascript
{
  id: UUID (PK),
  competitorId: UUID (FK → competitors.id),
  versionNumber: INTEGER (NOT NULL),
  fullHtml: TEXT,
  isFullVersion: BOOLEAN (default: false),
  isCurrent: BOOLEAN (default: false),
  changeCount: INTEGER (default: 0),
  changePercentage: DECIMAL(5, 2),
  severity: ENUM('low', 'medium', 'high', 'critical') (default: 'low'),
  changeSummary: TEXT,
  created_at: DATE (auto),
  updated_at: DATE (auto)
}
```

### Índices
- UNIQUE: `competitor_id`, `version_number`
- `competitor_id`, `is_current`
- `competitor_id`, `version_number`
- `created_at`

---

## 📡 Endpoints del API

### GET /api/competitors

**Response:**
```typescript
{
  success: boolean
  data: Competitor[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
```

**Campos del Competitor en response:**
```typescript
{
  id: string
  name: string
  url: string
  description?: string
  monitoringEnabled: boolean
  checkInterval: number  // en segundos
  priority: 'low' | 'medium' | 'high'
  lastCheckedAt?: string  // ISO date
  totalVersions: number
  lastChangeAt?: string  // ISO date
  isActive: boolean
  created_at: string  // ISO date
  updated_at: string  // ISO date
  severity: 'low' | 'medium' | 'high' | 'critical'  // calculado del último snapshot
  changeCount: number  // calculado del último snapshot
}
```

---

### GET /api/competitors/:id

**Response:**
```typescript
{
  success: boolean
  data: Competitor  // mismo formato que arriba
}
```

**NOTA**: Este endpoint NO incluye el campo `severity` ni `changeCount` porque no hace el JOIN con snapshots. Para obtener esa información, usa `/api/competitors` (lista) o consulta el último snapshot.

---

### GET /api/competitors/:id/history

**Query params:**
- `limit` (default: 10)
- `offset` (default: 0)

**Response:**
```typescript
{
  success: boolean
  data: Snapshot[]
  pagination: {
    limit: number
    offset: number
    total: number
  }
}
```

**Campos del Snapshot en response:**
```typescript
{
  id: string
  versionNumber: number
  isFullVersion: boolean
  isCurrent: boolean
  changeCount: number
  changePercentage: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  changeSummary: string
  created_at: string  // ISO date
  updated_at: string  // ISO date
}
```

---

### GET /api/competitors/:id/monitoring-status

**Response:**
```typescript
{
  success: boolean
  data: {
    id: string
    name: string
    url: string
    monitoringEnabled: boolean
    checkInterval: number
    lastCheckedAt?: string
    nextCapture: string  // ISO date (calculado)
    totalVersions: number
    lastChangeAt?: string
    status: 'active' | 'paused'
  }
}
```

---

### POST /api/competitors

**Body:**
```typescript
{
  name: string  // required, 2-100 chars
  url: string  // required, URL válida
  description?: string  // optional, max 500 chars
  monitoringEnabled?: boolean  // default: true
  checkInterval?: number  // default: 3600 (segundos)
  priority?: 'low' | 'medium' | 'high'  // default: 'medium'
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  data: Competitor
}
```

---

### PUT /api/competitors/:id

**Body:** (todos opcionales)
```typescript
{
  name?: string
  url?: string
  description?: string
  monitoringEnabled?: boolean
  checkInterval?: number
  priority?: 'low' | 'medium' | 'high'
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  data: Competitor  // con severity y changeCount
}
```

---

### DELETE /api/competitors/:id

**Response:**
```typescript
{
  success: boolean
  message: string
  data: {
    competitorId: string
    snapshotsEliminados: number
    alertsEliminadas: number
  }
}
```

**NOTA**: Elimina el competidor y todos sus snapshots y alertas relacionados (CASCADE).

---

### POST /api/competitors/:id/enable-monitoring

**Response:**
```typescript
{
  success: boolean
  message: string
  data: {
    id: string
    name: string
    monitoringEnabled: true
  }
}
```

---

### POST /api/competitors/:id/disable-monitoring

**Response:**
```typescript
{
  success: boolean
  message: string
  data: {
    id: string
    name: string
    monitoringEnabled: false
  }
}
```

---

### POST /api/competitors/:id/manual-check

**Body:**
```typescript
{
  simulate?: boolean  // default: false
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  data: {
    competitorId: string
    competitorName: string
    changesDetected: boolean
    alertCreated: boolean
    snapshotId?: string
    changeCount: number
    severity: 'low' | 'medium' | 'high' | 'critical'
    timestamp: string  // ISO date
  }
}
```

---

### POST /api/competitors/:id/start-monitoring

**Body:**
```typescript
{
  interval?: number  // segundos, default: 3600, min: 300, max: 86400
  options?: object  // opciones adicionales
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  data: {
    id: string
    name: string
    monitoringEnabled: boolean
    checkInterval: number
    initialCapture?: {
      versionNumber: number
      changeCount: number
      severity: string
    }
    nextCapture: string  // ISO date
  }
}
```

---

### GET /api/competitors/:id/version/:versionNumber/html

**Response:**
```typescript
{
  success: boolean
  data: {
    versionNumber: number
    html: string  // HTML completo (descomprimido)
    timestamp: string  // ISO date
    isFullVersion: boolean
  }
}
```

---

### GET /api/competitors/:id/diff/:v1/:v2

Compara dos versiones específicas.

**Response:**
```typescript
{
  success: boolean
  data: {
    competitorId: string
    version1: {
      number: number
      timestamp: string
      isFullVersion: boolean
    }
    version2: {
      number: number
      timestamp: string
      isFullVersion: boolean
    }
    diff: {
      changes: Array<{
        added?: boolean
        removed?: boolean
        value: string
        count: number
      }>
      changeCount: number
      changePercentage: number
      severity: string
      summary: string
    }
  }
}
```

---

## 🔗 Relaciones

### Competitor
- **hasMany** Snapshot (as: 'snapshots')
- **hasMany** Alert (as: 'alerts')
- **hasOne** Snapshot (as: 'lastSnapshot', where: { isCurrent: true })
- **belongsTo** User

### Snapshot
- **belongsTo** Competitor

---

## 📝 Notas Importantes

### Check Interval
- Se guarda en **segundos** en la BD
- **Mínimo**: 300 segundos (5 minutos)
- **Máximo**: 86400 segundos (24 horas)
- **Default**: 3600 segundos (1 hora)

### Severity Calculation
- `severity` y `changeCount` se calculan del último snapshot (where `isCurrent: true`)
- Si no hay snapshots, defaults a: `severity: 'low'`, `changeCount: 0`

### URL Normalization
- El backend automáticamente agrega `https://` si no tiene protocolo
- Se valida que sea una URL válida
- Se verifica que no haya duplicados por usuario

### Soft Delete
- Los competidores usan `isActive: boolean`
- `DELETE` hace hard delete (elimina físicamente)
- Se eliminan en cascade todos los snapshots y alertas relacionados

---

## 🎯 Campos Faltantes en el Frontend

### En el Tipo Competitor del Frontend

**Campos que FALTAN en TypeScript:**
```typescript
// FALTA:
created_at: string  // Timestamp de creación
updated_at: string  // Timestamp de última actualización

// EXISTEN pero mal nombrados:
createdAt → created_at
updatedAt → updated_at
```

### En el Tipo ChangeHistory del Frontend

**Debe coincidir con Snapshot:**
```typescript
// CORRECTO:
export interface ChangeHistory {
  id: string
  competitorId: string  // Campo: competitor_id
  versionNumber: number  // Campo: version_number
  isFullVersion: boolean  // Campo: is_full_version
  isCurrent: boolean  // Campo: is_current
  changeCount: number  // Campo: change_count
  changePercentage: number  // Campo: change_percentage
  severity: 'low' | 'medium' | 'high' | 'critical'
  changeSummary: string  // Campo: change_summary
  created_at: string  // Timestamp
  updated_at: string  // Timestamp
  
  // Campos adicionales para el frontend:
  timestamp: string  // Alias de created_at para compatibilidad
  changeType?: 'content' | 'design' | 'pricing' | 'feature' | 'other'  // Opcional
  summary: string  // Alias de changeSummary
  details?: string  // Opcional
}
```

---

**Fecha de creación**: 11 de Octubre, 2025  
**Última actualización**: 11 de Octubre, 2025

