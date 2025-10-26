# Sistema de Extracción de Secciones y Análisis de IA

## Visión General

Este sistema optimiza el análisis de cambios en sitios web de competidores mediante:
1. **Extracción inteligente de secciones**: Identifica las partes específicas del HTML donde ocurrieron cambios
2. **Optimización de tokens**: Envía solo las secciones relevantes a la IA (ahorro de ~80% de tokens)
3. **Análisis contextual**: La IA analiza solo lo que cambió, no todo el sitio web

## Flujo de Funcionamiento

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DETECCIÓN DE CAMBIOS (changeDetector.js)                    │
│    - Compara HTML anterior vs actual                            │
│    - Genera diff de cambios                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. EXTRACCIÓN DE SECCIONES (sectionExtractor.js)               │
│    - Identifica secciones semánticas (pricing, hero, features) │
│    - Extrae solo el contenido cambiado                          │
│    - Optimiza para tokens (~80% de ahorro)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. ANÁLISIS DE IA (aiService.js)                               │
│    - Recibe solo las secciones relevantes                       │
│    - Genera análisis contextual                                 │
│    - Proporciona recomendaciones accionables                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. ALMACENAMIENTO (Snapshot)                                    │
│    - Guarda secciones extraídas en metadata                     │
│    - Almacena análisis de IA                                    │
│    - Disponible para consulta posterior                         │
└─────────────────────────────────────────────────────────────────┘
```

## Componentes del Sistema

### 1. `sectionExtractor.js`

**Responsabilidad**: Extraer secciones específicas del HTML donde ocurrieron cambios.

**Métodos principales**:

```javascript
// Extraer secciones cambiadas
extractChangedSection(htmlBefore, htmlAfter, diffChanges)

// Identificar secciones semánticas
identifySectionType(selector) // Retorna: 'pricing', 'hero', 'features', etc.

// Preparar datos para IA (optimizado)
prepareForAI(extractedData) // Retorna payload optimizado con estimación de tokens
```

**Secciones que identifica**:
- `hero`: Sección principal/banner
- `pricing`: Planes de precios
- `features`: Características del producto
- `testimonials`: Testimonios de clientes
- `cta`: Call-to-action
- `navigation`: Navegación
- `header`: Encabezado
- `footer`: Pie de página
- `form`: Formularios
- `content`: Contenido general

**Optimización de tokens**:
- Limita texto a 200 caracteres por campo
- Limita HTML a 1000 caracteres por sección
- Extrae solo atributos relevantes (`class`, `id`, `data-*`, `href`, `src`)
- Elimina scripts, estilos y elementos no semánticos

### 2. `aiService.js`

**Responsabilidad**: Analizar cambios usando Google Gemini AI.

**Método actualizado**:

```javascript
async analyzeChanges(changeData) {
  // changeData incluye:
  // - competitorName
  // - url
  // - date
  // - changeType
  // - severity
  // - totalChanges
  // - sections: [{ type, selector, changes: [{ type, before, after }] }]
}
```

**Respuesta de la IA**:
```json
{
  "resumen": "Descripción ejecutiva del cambio",
  "impacto": [
    "Punto de impacto 1",
    "Punto de impacto 2",
    "Punto de impacto 3"
  ],
  "recomendaciones": [
    "Acción recomendada 1",
    "Acción recomendada 2"
  ],
  "urgencia": "Alto|Medio|Bajo",
  "insights": "Análisis adicional y contexto"
}
```

### 3. `changeDetector.js` (Actualizado)

**Cambios implementados**:

```javascript
async compareVersions(lastSnapshot, currentHtml) {
  // ... comparación de HTML ...
  
  // NUEVO: Extraer secciones específicas
  if (significantChanges.length > 0) {
    extractedSections = sectionExtractor.extractChangedSection(
      prevHtmlStr,
      currHtmlStr,
      significantChanges
    )
    
    const aiPayload = sectionExtractor.prepareForAI(extractedSections)
    logger.info(`Tokens estimados: ${aiPayload.estimatedTokens}`)
  }
  
  return {
    // ... datos existentes ...
    extractedSections: extractedSections, // NUEVO
    aiAnalysis: aiAnalysis // NUEVO
  }
}
```

**Análisis de IA (opcional)**:

```javascript
async createNewVersion(competitorId, comparison, options = {}) {
  // Análisis de IA solo si se habilita explícitamente
  if (options.enableAI && comparison.extractedSections) {
    aiAnalysisData = await aiService.analyzeChanges({
      competitorName: competitor.name,
      url: competitor.url,
      sections: aiPayload.data.sections
    })
  }
  
  // Guardar en metadata del snapshot
  const snapshot = await Snapshot.create({
    // ... campos existentes ...
    metadata: {
      extractedSections: { ... },
      aiAnalysis: aiAnalysisData
    }
  })
}
```

## Uso del Sistema

### Opción 1: Monitoreo Automático (Sin IA)

Por defecto, el sistema extrae secciones pero **NO** ejecuta análisis de IA automáticamente (para ahorrar tokens).

```javascript
// En el monitoreo automático
const result = await changeDetector.captureChange(competitorId, url)
// result.extractedSections estará disponible
// result.aiAnalysis será null
```

### Opción 2: Monitoreo Manual con IA

Para habilitar análisis de IA, pasar la opción `enableAI`:

```javascript
// Desde el endpoint de monitoreo manual
const result = await changeDetector.captureChange(competitorId, url, {
  isManualCheck: true,
  enableAI: true // 🤖 Habilitar análisis de IA
})
```

### Opción 3: Análisis de IA Bajo Demanda

Analizar un cambio específico después de detectarlo:

```javascript
// Endpoint: POST /api/ai/analyze-change
const analysis = await aiService.analyzeChanges({
  competitorName: 'Competitor X',
  url: 'https://competitorx.com',
  sections: extractedSections.sections
})
```

## Endpoints API

### 1. Análisis de IA para un cambio específico

```http
POST /api/ai/analyze-change
Authorization: Bearer <token>
Content-Type: application/json

{
  "competitorName": "Competitor X",
  "url": "https://competitorx.com",
  "changeType": "pricing",
  "severity": "high",
  "totalChanges": 13,
  "sections": [
    {
      "type": "pricing",
      "selector": "section.pricing",
      "changeType": "modified",
      "changes": [
        {
          "type": "text",
          "before": "$99/month",
          "after": "$79/month"
        }
      ]
    }
  ]
}
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "resumen": "Reducción de precios del 20%...",
    "impacto": ["...", "...", "..."],
    "recomendaciones": ["...", "..."],
    "urgencia": "Alto",
    "insights": "..."
  }
}
```

### 2. Obtener análisis de IA de un snapshot

```http
GET /api/competitors/:id/snapshots/:snapshotId
Authorization: Bearer <token>
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "versionNumber": 12,
    "changeCount": 13,
    "severity": "high",
    "changeSummary": "...",
    "metadata": {
      "extractedSections": {
        "summary": "Se detectaron cambios en 2 sección(es): pricing, features",
        "sectionsCount": 2,
        "sectionTypes": ["pricing", "features"]
      },
      "aiAnalysis": {
        "resumen": "...",
        "impacto": ["...", "..."],
        "recomendaciones": ["...", "..."],
        "urgencia": "Alto"
      }
    }
  }
}
```

## Métricas de Eficiencia

### Ejemplo Real (Test)

**Escenario**: Cambio en pricing y features de un competidor

| Métrica | Valor |
|---------|-------|
| HTML completo (before + after) | ~3,220 caracteres |
| Tokens HTML completo | ~805 tokens |
| Secciones extraídas | 1 sección (main) |
| Tokens secciones | ~153 tokens |
| **Ahorro de tokens** | **81.0%** |

### Costo Estimado (Google Gemini 2.5 Flash)

Asumiendo un análisis por día para 10 competidores:

**Sin optimización**:
- 10 competidores × 805 tokens × 30 días = 241,500 tokens/mes
- Costo: ~$0.24/mes (tarifa gratuita cubre hasta 1.5M tokens/día)

**Con optimización**:
- 10 competidores × 153 tokens × 30 días = 45,900 tokens/mes
- Costo: ~$0.05/mes
- **Ahorro: $0.19/mes (79% menos)**

## Configuración

### Variables de Entorno

```env
# Google AI (Gemini) Configuration
GOOGLE_AI_API_KEY=tu_api_key_aqui
```

### Habilitar/Deshabilitar IA

**Por defecto**: IA deshabilitada (solo extrae secciones)

**Habilitar para monitoreo manual**:
```javascript
// En el endpoint de monitoreo manual
router.post('/competitors/:id/check', async (req, res) => {
  const result = await changeDetector.captureChange(
    req.params.id,
    null,
    {
      isManualCheck: true,
      enableAI: true // 🤖 Habilitar IA
    }
  )
})
```

**Habilitar para monitoreo automático** (no recomendado por costos):
```javascript
// En el scheduler de monitoreo
await changeDetector.captureChange(competitorId, url, {
  enableAI: true // Solo para cambios críticos
})
```

## Testing

### Script de Prueba

```bash
# Probar extracción de secciones + análisis de IA
node test-section-extraction.js
```

**Salida esperada**:
- ✅ Secciones extraídas correctamente
- ✅ Tokens optimizados (~80% ahorro)
- ✅ Análisis de IA con resumen, impacto, recomendaciones y urgencia

### Prueba con Competidor Real

```bash
# Monitoreo manual con IA habilitada
curl -X POST http://localhost:3002/api/competitors/:id/check \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"enableAI": true}'
```

## Mejoras Futuras

1. **Análisis de IA selectivo**: Solo analizar cambios de alta severidad automáticamente
2. **Cache de análisis**: Evitar analizar cambios similares múltiples veces
3. **Análisis comparativo**: Comparar múltiples competidores en un solo análisis
4. **Alertas inteligentes**: Crear alertas basadas en el nivel de urgencia de la IA
5. **Insights históricos**: Analizar tendencias de cambios a lo largo del tiempo

## Troubleshooting

### Error: "Google AI no está configurado"

**Causa**: `GOOGLE_AI_API_KEY` no está en `.env`

**Solución**:
```bash
# Agregar al archivo .env
GOOGLE_AI_API_KEY=tu_api_key_aqui

# Reiniciar el servidor
node src/server.js
```

### Error: "No se pudieron extraer secciones"

**Causa**: HTML mal formado o sin estructura semántica

**Solución**: El sistema continúa funcionando, pero envía los cambios raw a la IA

### Tokens excedidos

**Causa**: Demasiados cambios o secciones muy grandes

**Solución**: El sistema ya limita automáticamente:
- Texto a 200 caracteres
- HTML a 1000 caracteres
- Si aún excede, considera aumentar `fullVersionInterval` en config

## Conclusión

Este sistema proporciona:
- ✅ **Análisis inteligente** de cambios en competidores
- ✅ **Optimización masiva** de tokens (~80% ahorro)
- ✅ **Insights accionables** generados por IA
- ✅ **Flexibilidad** para habilitar/deshabilitar IA según necesidad
- ✅ **Escalabilidad** para monitorear múltiples competidores

**Resultado**: Análisis de competidores más inteligente, rápido y económico.

