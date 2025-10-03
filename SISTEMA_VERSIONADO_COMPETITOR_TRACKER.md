# Sistema de Versionado Inteligente - Competitor Tracker

## Índice
1. [Introducción](#introducción)
2. [Problema a Resolver](#problema-a-resolver)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Estructura de Base de Datos](#estructura-de-base-de-datos)
5. [Proceso de Guardado](#proceso-de-guardado)
6. [Sistema de Reconstrucción](#sistema-de-reconstrucción)
7. [Proceso de Borrado y Limpieza](#proceso-de-borrado-y-limpieza)
8. [Optimización Dinámica](#optimización-dinámica)
9. [Implementación Técnica](#implementación-técnica)
10. [Configuración Recomendada](#configuración-recomendada)
11. [Ejemplos Prácticos](#ejemplos-prácticos)
12. [Ventajas del Sistema](#ventajas-del-sistema)

## Introducción

El **Sistema de Versionado Inteligente** es una solución innovadora para el almacenamiento eficiente de historiales de cambios en sitios web de competidores. Este sistema combina **diferencias incrementales** con **optimización dinámica** para maximizar el ahorro de almacenamiento mientras mantiene la capacidad de reconstruir cualquier versión histórica.

## Problema a Resolver

### Desafíos Identificados:
- **Almacenamiento masivo**: Guardar HTML completo de cada versión consume demasiado espacio
- **Escalabilidad**: Con múltiples competidores y cuentas, el crecimiento es exponencial
- **Retención de historial**: Necesidad de mantener un historial limitado pero completo
- **Reconstrucción garantizada**: Capacidad de recuperar cualquier versión histórica

### Ejemplo del Problema:
```
❌ Sistema Tradicional:
- 30 versiones × 100KB cada una = 3MB por competidor
- 100 competidores × 3MB = 300MB
- 1000 cuentas × 300MB = 300GB
```

## Arquitectura del Sistema

### Concepto Central: Diferencias Incrementales + Versiones Completas Periódicas

```
Versión 1 (COMPLETA) → V2 (diff) → V3 (diff) → ... → V10 (COMPLETA) → V11 (diff) → ... → V20 (COMPLETA)
     ↓                    ↓           ↓                    ↓                    ↓                    ↓
[HTML completo]      [Solo diff] [Solo diff]         [HTML completo]     [Solo diff]         [HTML completo]
```

### Principios Clave:
1. **Versiones Completas**: Se guardan cada N versiones (ej: cada 10)
2. **Versiones Intermedias**: Solo se guardan las diferencias respecto a la anterior
3. **Reconstrucción**: Cualquier versión se puede reconstruir aplicando diferencias
4. **Optimización**: La distribución de versiones completas se optimiza dinámicamente

## Estructura de Base de Datos

### Tablas Principales:

```sql
-- Tabla principal de competidores
CREATE TABLE competitors (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  monitoring_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de snapshots (versiones)
CREATE TABLE snapshots (
  id UUID PRIMARY KEY,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  full_html TEXT, -- Solo cuando is_full_version = true
  is_full_version BOOLEAN DEFAULT FALSE,
  is_current BOOLEAN DEFAULT FALSE, -- Solo una versión actual por competidor
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(competitor_id, version_number)
);

-- Tabla de diferencias entre versiones
CREATE TABLE snapshot_diffs (
  id UUID PRIMARY KEY,
  from_snapshot_id UUID REFERENCES snapshots(id) ON DELETE CASCADE,
  to_snapshot_id UUID REFERENCES snapshots(id) ON DELETE CASCADE,
  diff_data JSONB NOT NULL, -- Contiene las diferencias específicas
  change_summary TEXT,
  change_count INTEGER DEFAULT 0,
  change_percentage DECIMAL(5,2), -- % de cambio respecto al total
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de metadatos de cambios
CREATE TABLE change_metadata (
  id UUID PRIMARY KEY,
  snapshot_id UUID REFERENCES snapshots(id) ON DELETE CASCADE,
  change_type VARCHAR(50), -- 'content', 'layout', 'pricing', 'navigation'
  affected_sections JSONB, -- Selectores CSS de las secciones afectadas
  severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX idx_snapshots_competitor_current ON snapshots(competitor_id, is_current);
CREATE INDEX idx_snapshots_competitor_version ON snapshots(competitor_id, version_number);
CREATE INDEX idx_diffs_from_snapshot ON snapshot_diffs(from_snapshot_id);
CREATE INDEX idx_diffs_to_snapshot ON snapshot_diffs(to_snapshot_id);
```

## Proceso de Guardado

### 1. Captura Inicial (Versión Completa)

```javascript
async function captureInitialVersion(competitorId, url, html) {
  const compressedHtml = await this.compressHTML(html);

  const snapshot = await db.snapshots.create({
    competitor_id: competitorId,
    version_number: 1,
    full_html: compressedHtml,
    is_full_version: true,
    is_current: true
  });

  await this.createChangeMetadata(snapshot.id, 'initial', [], 'low');
  return snapshot;
}
```

### 2. Capturas Subsecuentes (Diferencias)

```javascript
async function captureChange(competitorId, url) {
  // 1. Obtener HTML actual
  const currentHtml = await this.getPageHTML(url);
  
  // 2. Obtener última versión
  const lastSnapshot = await this.getCurrentSnapshot(competitorId);
  
  // 3. Comparar versiones
  const comparison = await this.compareVersions(lastSnapshot, currentHtml);
  
  if (!this.isSignificantChange(comparison)) {
    return null; // No hay cambios significativos
  }

  // 4. Crear nueva versión
  const newVersion = await this.createNewVersion(competitorId, comparison);
  
  // 5. Guardar diferencias
  await this.saveDifferences(lastSnapshot.id, newVersion.id, comparison);
  
  return newVersion;
}
```

### 3. Determinación de Versión Completa

```javascript
async function createNewVersion(competitorId, comparison) {
  const lastSnapshot = await this.getCurrentSnapshot(competitorId);
  const newVersionNumber = lastSnapshot.version_number + 1;
  
  // Determinar si debe ser versión completa
  const shouldBeFullVersion = (newVersionNumber % this.config.fullVersionInterval) === 0;
  
  const snapshot = await db.snapshots.create({
    competitor_id: competitorId,
    version_number: newVersionNumber,
    full_html: shouldBeFullVersion ? await this.compressHTML(comparison.currentHtml) : null,
    is_full_version: shouldBeFullVersion,
    is_current: true
  });

  return snapshot;
}
```

## Sistema de Reconstrucción

### Cómo Funciona la Reconstrucción

La reconstrucción se basa en **cadenas de referencias** donde cada versión conoce exactamente de qué versión anterior proviene.

#### Caso 1: Versión Completa (Directo)
```javascript
// Si quiero la Versión 10 - es directo
const version10 = await db.snapshots.findByPk(version10Id);
const html = version10.full_html; // Ya está guardado completo
```

#### Caso 2: Versión Intermedia (Reconstrucción)
```javascript
// Si quiero la Versión 7 - necesito reconstruir
async function reconstructVersion(version7Id) {
  // 1. Encontrar la versión completa más cercana hacia atrás
  const version7 = await db.snapshots.findByPk(version7Id);
  const lastFullVersion = await findLastFullVersionBefore(version7.competitor_id, version7.version_number);
  
  // 2. Obtener todas las diferencias desde esa versión completa hasta la versión 7
  const diffs = await getAllDiffsBetween(lastFullVersion.id, version7Id);
  
  // 3. Empezar con el HTML completo de la versión completa
  let reconstructedHtml = lastFullVersion.full_html;
  
  // 4. Aplicar cada diferencia en orden
  for (const diff of diffs) {
    reconstructedHtml = applyDiff(reconstructedHtml, diff.diff_data);
  }
  
  return reconstructedHtml;
}
```

### Ejemplo Práctico de Reconstrucción

**Para reconstruir la Versión 5:**

1. **Punto de partida:** Versión 1 (HTML completo)
2. **Aplicar cambios:** 
   - V1 → V2: Agregar diferencias
   - V2 → V3: Agregar diferencias  
   - V3 → V4: Agregar diferencias
   - V4 → V5: Agregar diferencias
3. **Resultado:** HTML completo de la Versión 5

```javascript
// Código que haría esto:
const version1HTML = "HTML completo de la versión 1";
const changes1to2 = "cambios de v1 a v2";
const changes2to3 = "cambios de v2 a v3"; 
const changes3to4 = "cambios de v3 a v4";
const changes4to5 = "cambios de v4 a v5";

// Reconstruir versión 5:
let version5HTML = version1HTML;
version5HTML += changes1to2;  // V1 + cambios = V2
version5HTML += changes2to3;  // V2 + cambios = V3
version5HTML += changes3to4;  // V3 + cambios = V4
version5HTML += changes4to5;  // V4 + cambios = V5

// ¡Listo! Tenemos el HTML completo de la versión 5
```

## Proceso de Borrado y Limpieza

### Estrategia de Limpieza Inteligente

**Regla de oro:** Nunca borres una versión completa sin asegurarte de que la siguiente versión que dependía de ella ahora sea completa también.

#### Proceso Paso a Paso:

1. **Identificar versión a borrar** (la más antigua)
2. **Si es versión completa:** Reconstruir la siguiente versión como completa
3. **Borrar la versión original**
4. **Verificar si necesita optimización**

```javascript
async function cleanupWithReconstruction() {
  // 1. ANTES de borrar la versión 1, reconstruir la versión 2 completa
  const version1 = await getSnapshot(version1Id); // HTML completo
  const version2 = await getSnapshot(version2Id); // Solo diferencias
  
  // 2. Reconstruir la versión 2 completa
  const version2CompleteHTML = version1.full_html + version2.differences;
  
  // 3. Actualizar la versión 2 para que sea completa
  await version2.update({
    full_html: version2CompleteHTML,
    is_full_version: true
  });
  
  // 4. AHORA sí puedo borrar la versión 1 con seguridad
  await deleteSnapshot(version1Id);
  
  // 5. La versión 2 ahora es el nuevo punto de anclaje
}
```

### Ejemplo Visual del Proceso:

#### ANTES de la limpieza:
```
V1(COMPLETA) → V2(diff) → V3(diff) → ... → V30(diff)
     ↓              ↓           ↓              ↓
[HTML completo] [Solo diff] [Solo diff]   [Solo diff]
```

#### DESPUÉS de la limpieza:
```
V2(COMPLETA) → V3(diff) → ... → V30(diff)
     ↓              ↓              ↓
[HTML completo] [Solo diff]   [Solo diff]
```

## Optimización Dinámica

### ¿Cuándo se Activa la Optimización?

La optimización se activa cuando el sistema detecta que la distribución de versiones completas no es óptima.

### Ejemplo de Optimización:

#### Estado después de borrar V1-V9:
```
V10(COMPLETA) → V11(diff) → V12(diff) → ... → V20(COMPLETA) → V21(diff) → ... → V30(diff)

Intervalos actuales: [10 versiones entre V10 y V20, 10 versiones entre V20 y V30]
Promedio: 10 versiones
```

#### El sistema detecta que está bien distribuido, continúa normal

#### Cuando se borre V10:
```
V11(COMPLETA) → V12(diff) → ... → V20(COMPLETA) → V21(diff) → ... → V30(diff)

Intervalos actuales: [9 versiones entre V11 y V20, 10 versiones entre V20 y V30]
Promedio: 9.5 versiones
```

#### El sistema detecta desequilibrio y optimiza:
```
V12(COMPLETA) → V13(diff) → ... → V20(diff) → V21(diff) → ... → V28(COMPLETA) → V29(diff) → V30(diff)

Nueva distribución optimizada: [8 versiones, 8 versiones]
```

### Implementación de la Optimización:

```javascript
class OptimalDistributionCalculator {
  calculateOptimalDistribution(totalVersions, maxVersions = 30) {
    // Calcular cuántas versiones completas necesitamos
    const optimalFullVersionCount = Math.ceil(Math.sqrt(totalVersions));
    
    // Calcular intervalo óptimo
    const interval = Math.ceil(totalVersions / optimalFullVersionCount);
    
    // Generar posiciones de versiones completas
    const fullVersionPositions = [];
    for (let i = 1; i <= totalVersions; i += interval) {
      fullVersionPositions.push(i);
    }
    
    // Asegurar que la última versión sea completa
    if (fullVersionPositions[fullVersionPositions.length - 1] !== totalVersions) {
      fullVersionPositions[fullVersionPositions.length - 1] = totalVersions;
    }
    
    return {
      interval,
      fullVersionCount: fullVersionPositions.length,
      positions: fullVersionPositions
    };
  }
}
```

## Implementación Técnica

### Clase Principal: ChangeDetector

```javascript
const diff = require('diff');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class ChangeDetector {
  constructor() {
    this.config = {
      maxVersionsPerCompetitor: 30,
      fullVersionInterval: 10, // Cada 10 versiones, guardar una completa
      changeThreshold: 0.05, // 5% de cambio mínimo
      compressionEnabled: true,
      significantChangeThreshold: 100 // Mínimo 100 caracteres de cambio
    };
  }

  // Método principal para capturar cambios
  async captureChange(competitorId, url) {
    try {
      // 1. Obtener HTML actual
      const currentHtml = await this.getPageHTML(url);
      
      // 2. Obtener última versión
      const lastSnapshot = await this.getCurrentSnapshot(competitorId);
      
      if (!lastSnapshot) {
        // Primera captura - guardar versión completa
        return await this.captureInitialVersion(competitorId, url, currentHtml);
      }

      // 3. Comparar con la versión anterior
      const comparison = await this.compareVersions(lastSnapshot, currentHtml);
      
      if (!this.isSignificantChange(comparison)) {
        console.log(`No hay cambios significativos para ${url}`);
        return null;
      }

      // 4. Crear nueva versión
      const newVersion = await this.createNewVersion(competitorId, comparison);
      
      // 5. Guardar diferencias
      await this.saveDifferences(lastSnapshot.id, newVersion.id, comparison);
      
      // 6. Limpiar versiones antiguas si es necesario
      await this.cleanupOldVersions(competitorId);
      
      return newVersion;
      
    } catch (error) {
      console.error('Error capturando cambio:', error);
      throw error;
    }
  }

  // Comparar versiones y generar diferencias
  async compareVersions(lastSnapshot, currentHtml) {
    // Obtener HTML anterior (descomprimir si es necesario)
    const previousHtml = await this.getHTMLFromSnapshot(lastSnapshot);
    
    // Generar diferencias usando la librería 'diff'
    const changes = diff.diffLines(previousHtml, currentHtml);
    
    // Filtrar cambios significativos
    const significantChanges = changes.filter(change => {
      if (change.added || change.removed) {
        const changeLength = change.value.trim().length;
        return changeLength >= this.config.significantChangeThreshold;
      }
      return false;
    });

    // Calcular métricas
    const totalLines = currentHtml.split('\n').length;
    const changedLines = significantChanges.reduce((acc, change) => {
      return acc + (change.added ? change.count : 0) + (change.removed ? change.count : 0);
    }, 0);

    const changePercentage = (changedLines / totalLines) * 100;

    return {
      changes: significantChanges,
      changeCount: significantChanges.length,
      changePercentage: changePercentage,
      totalLines: totalLines,
      changedLines: changedLines,
      severity: this.calculateSeverity(changePercentage, significantChanges)
    };
  }

  // Limpiar versiones antiguas manteniendo integridad
  async cleanupOldVersions(competitorId) {
    const snapshots = await db.snapshots.findAll({
      where: { competitor_id: competitorId },
      order: [['version_number', 'DESC']]
    });

    if (snapshots.length <= this.config.maxVersionsPerCompetitor) {
      return; // No hay nada que limpiar
    }

    const toDelete = snapshots.slice(this.config.maxVersionsPerCompetitor);
    
    for (const snapshot of toDelete) {
      if (snapshot.is_full_version) {
        // Es una versión completa - reconstruir desde diferencias antes de borrar
        await this.reconstructFullVersion(snapshot);
      }
      
      // Borrar snapshot y sus diferencias
      await this.deleteSnapshot(snapshot.id);
    }
  }

  // Reconstruir versión completa desde diferencias
  async reconstructFullVersion(snapshot) {
    // Obtener la siguiente versión completa más reciente
    const nextFullVersion = await this.getNextFullVersion(snapshot.competitor_id, snapshot.version_number);
    
    if (!nextFullVersion) {
      throw new Error('No se puede reconstruir: no hay versión completa posterior');
    }

    // Obtener todas las diferencias entre esta versión y la siguiente completa
    const diffs = await this.getAllDiffsBetweenVersions(snapshot.id, nextFullVersion.id);
    
    // Reconstruir HTML aplicando diferencias en orden inverso
    let reconstructedHtml = await this.getHTMLFromSnapshot(nextFullVersion);
    
    for (let i = diffs.length - 1; i >= 0; i--) {
      reconstructedHtml = this.applyDiffInverse(reconstructedHtml, diffs[i].diff_data);
    }

    // Actualizar la versión completa
    await snapshot.update({
      full_html: await this.compressHTML(reconstructedHtml),
      is_full_version: true
    });
  }

  // Compresión/Descompresión
  async compressHTML(html) {
    const buffer = await gzip(html);
    return buffer.toString('base64');
  }

  async decompressHTML(compressedHtml) {
    const buffer = Buffer.from(compressedHtml, 'base64');
    return await gunzip(buffer);
  }
}

module.exports = new ChangeDetector();
```

### Servicio de API para el Backend

```javascript
// routes/competitors.js
const express = require('express');
const router = express.Router();
const changeDetector = require('../services/changeDetector');

// Endpoint para capturar cambios
router.post('/:competitorId/capture', async (req, res) => {
  try {
    const { competitorId } = req.params;
    const competitor = await db.competitors.findByPk(competitorId);
    
    if (!competitor) {
      return res.status(404).json({ error: 'Competidor no encontrado' });
    }

    const newVersion = await changeDetector.captureChange(competitorId, competitor.url);
    
    if (!newVersion) {
      return res.json({ message: 'No hay cambios detectados', version: null });
    }

    res.json({
      message: 'Cambios detectados y guardados',
      version: {
        id: newVersion.id,
        versionNumber: newVersion.version_number,
        createdAt: newVersion.created_at
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener historial
router.get('/:competitorId/history', async (req, res) => {
  try {
    const { competitorId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    const history = await db.snapshots.findAndCountAll({
      where: { competitor_id: competitorId },
      include: [
        {
          model: db.snapshot_diffs,
          as: 'diffs'
        },
        {
          model: db.change_metadata,
          as: 'metadata'
        }
      ],
      order: [['version_number', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(history);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener HTML de una versión específica
router.get('/:competitorId/version/:versionNumber/html', async (req, res) => {
  try {
    const { competitorId, versionNumber } = req.params;
    
    const snapshot = await db.snapshots.findOne({
      where: { 
        competitor_id: competitorId, 
        version_number: versionNumber 
      }
    });

    if (!snapshot) {
      return res.status(404).json({ error: 'Versión no encontrada' });
    }

    const html = await changeDetector.getHTMLFromSnapshot(snapshot);
    
    res.json({ html, version: versionNumber });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

## Configuración Recomendada

### Variables de Entorno:

```javascript
const PRODUCTION_CONFIG = {
  maxVersionsPerCompetitor: 30,
  fullVersionInterval: 10,
  changeThreshold: 0.03, // 3% para producción
  significantChangeThreshold: 50,
  compressionEnabled: true,
  cleanupSchedule: '0 2 * * *', // Limpieza diaria a las 2 AM
  backupEnabled: true,
  
  // Reglas de optimización
  minIntervalBetweenFullVersions: 8,
  maxIntervalBetweenFullVersions: 15,
  enableDynamicOptimization: true,
  optimizationTrigger: 'after_cleanup'
};
```

### Configuración de Base de Datos:

```sql
-- Configuración de PostgreSQL para optimización
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';

-- Configuración específica para JSONB
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE INDEX idx_snapshot_diffs_data ON snapshot_diffs USING gin (diff_data);
```

## Ejemplos Prácticos

### Ejemplo 1: Ahorro de Almacenamiento

```
❌ Sistema tradicional:
- 30 versiones × 100KB cada una = 3MB por competidor

✅ Sistema de diferencias:
- 3 versiones completas × 100KB = 300KB
- 27 diferencias × 5KB cada una = 135KB
- Total = 435KB por competidor

🎉 Ahorro: 85% menos almacenamiento
```

### Ejemplo 2: Proceso de Limpieza

#### Estado inicial (30 versiones):
```
V1(COMPLETA) → V2(diff) → V3(diff) → ... → V10(COMPLETA) → V11(diff) → ... → V20(COMPLETA) → V21(diff) → ... → V30(diff)
```

#### Después de borrar V1 y reconstruir V2:
```
V2(COMPLETA) → V3(diff) → ... → V10(COMPLETA) → V11(diff) → ... → V20(COMPLETA) → V21(diff) → ... → V30(diff)
```

#### Optimización automática:
```
V2(COMPLETA) → V3(diff) → ... → V11(diff) → V12(COMPLETA) → V13(diff) → ... → V21(diff) → V22(COMPLETA) → V23(diff) → ... → V30(diff)
```

### Ejemplo 3: Reconstrucción de Versión

```javascript
// Reconstruir versión 15 desde versión 10 (completa)
async function reconstructVersion15() {
  const version10 = await getSnapshot(version10Id); // HTML completo
  const diffs = await getDiffsBetween(version10Id, version15Id);
  
  let html = version10.full_html;
  for (const diff of diffs) {
    html = applyDiff(html, diff.diff_data);
  }
  
  return html; // HTML completo de la versión 15
}
```

## Ventajas del Sistema

### 1. Eficiencia de Almacenamiento
- **85-90% menos espacio** que el almacenamiento tradicional
- **Compresión adicional** para mayor ahorro
- **Escalabilidad** para miles de competidores

### 2. Reconstrucción Garantizada
- **Cualquier versión** se puede reconstruir
- **Integridad de datos** mantenida
- **Sin pérdida de información**

### 3. Optimización Automática
- **Distribución inteligente** de versiones completas
- **Limpieza automática** sin intervención manual
- **Adaptabilidad** al crecimiento del sistema

### 4. Rendimiento
- **Consultas rápidas** con índices optimizados
- **Reconstrucción eficiente** con cadenas de diferencias
- **Paralelización** de procesos de limpieza

### 5. Flexibilidad
- **Configuración adaptable** según necesidades
- **Frecuencia personalizable** de versiones completas
- **Umbrales ajustables** para cambios significativos

## Conclusión

El **Sistema de Versionado Inteligente** representa una solución robusta y eficiente para el manejo de historiales de cambios en aplicaciones de monitoreo de competidores. Combina lo mejor de ambos mundos: **ahorro masivo de almacenamiento** con **capacidad completa de reconstrucción**.

### Beneficios Clave:
- ✅ **85-90% menos almacenamiento**
- ✅ **Reconstrucción garantizada de cualquier versión**
- ✅ **Optimización automática y continua**
- ✅ **Escalabilidad para miles de competidores**
- ✅ **Mantenimiento automático sin intervención manual**

Este sistema permite que tu aplicación Competitor Tracker maneje eficientemente el crecimiento exponencial de datos mientras mantiene la funcionalidad completa de seguimiento de cambios históricos.

---

**Versión del Documento:** 1.0  
**Fecha:** Enero 2025  
**Autor:** Sistema de Desarrollo Competitor Tracker
