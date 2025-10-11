# PROMPT: Página de Detalle de Competidor Individual

## 📋 Contexto del Proyecto

Estás trabajando en una aplicación de **Competitive Intelligence** llamada "CompetitorWatch". Es un sistema que monitorea sitios web de competidores y detecta cambios automáticamente.

### Stack Tecnológico
- **Framework**: Next.js 14+ con App Router
- **Lenguaje**: TypeScript
- **Styling**: TailwindCSS
- **Components**: Shadcn UI (Radix UI primitives)
- **Icons**: Lucide React
- **State Management**: React Hooks (useState, useEffect)
- **Authentication**: Context API (AuthContext)

---

## 🎯 Objetivo

Crear la página de **detalle individual de un competidor** que se accede mediante la ruta:
```
/dashboard/competitors/[id]
```

Esta página debe mostrar toda la información relevante de un competidor específico:
- Datos generales
- Métricas y estadísticas
- Historial de cambios
- Timeline visual
- Acciones rápidas

---

## 📁 Estructura de Archivos a Crear

```
app/
  dashboard/
    competitors/
      [id]/
        page.tsx          ← CREAR ESTA PÁGINA
```

---

## 🎨 Patrones de Diseño Observados

### 1. Estructura Básica de Página

Todas las páginas del dashboard siguen este patrón:

```tsx
"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
// ... otros imports

export default function PageName() {
  // Estados
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Type | null>(null)

  // useEffect para cargar datos
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      // ... fetch data
    } catch (err) {
      setError('Error message')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadData}>Reintentar</Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Título</h1>
            <p className="text-muted-foreground">Descripción</p>
          </div>
          <Button>CTA Principal</Button>
        </div>

        {/* Stats Cards (Grid de 4 columnas) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Stats cards aquí */}
        </div>

        {/* Contenido principal */}
        <Card>
          <CardHeader>
            <CardTitle>Sección</CardTitle>
            <CardDescription>Descripción</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Contenido */}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
```

### 2. Stats Cards Pattern

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Título</CardTitle>
    <Icon className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{valor}</div>
    <p className="text-xs text-muted-foreground">
      Descripción secundaria
    </p>
  </CardContent>
</Card>
```

### 3. Colores por Severidad

```tsx
const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical": return "destructive"
    case "high": return "destructive"
    case "medium": return "secondary"
    case "low": return "outline"
    default: return "outline"
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high": return "destructive"
    case "medium": return "secondary"
    case "low": return "outline"
    default: return "outline"
  }
}
```

### 4. Formato de Timestamps

```tsx
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Ahora mismo'
  if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
  
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
```

---

## 🔌 API Disponible

### Archivo de Referencia: `lib/competitors-api.ts`

```typescript
// Tipo de datos del Competitor
interface Competitor {
  id: string
  name: string
  url: string
  description?: string
  monitoringEnabled: boolean
  checkInterval: number
  priority: 'low' | 'medium' | 'high'
  lastCheckedAt?: string
  totalVersions: number
  lastChangeAt?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  changeCount: number
}

// Métodos disponibles en competitorsApi:
competitorsApi.getCompetitor(id: string)           // Obtener datos del competidor
competitorsApi.getHistory(id: string, params)      // Obtener historial de cambios
competitorsApi.manualCheck(id: string)             // Ejecutar check manual
competitorsApi.updateCompetitor(id, data)          // Actualizar competidor
competitorsApi.deleteCompetitor(id)                // Eliminar competidor
competitorsApi.enableMonitoring(id)                // Habilitar monitoreo
competitorsApi.disableMonitoring(id)               // Deshabilitar monitoreo
```

### Cómo Usar la API

```tsx
import { competitorsApi, Competitor } from "@/lib/competitors-api"

// Dentro de un componente
const [competitor, setCompetitor] = useState<Competitor | null>(null)
const { id } = useParams() // Para obtener el ID de la URL

const loadCompetitorData = async () => {
  try {
    const response = await competitorsApi.getCompetitor(id as string)
    setCompetitor(response.data)
  } catch (err) {
    setError('Error al cargar el competidor')
  }
}
```

---

## 📋 Componentes UI Disponibles (Shadcn)

Todos estos componentes ya están instalados y listos para usar:

```tsx
// Layout y Estructura
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// Interacción
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"

// Formularios
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Feedback
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Visualización
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
```

---

## 🎨 Iconos Disponibles (Lucide React)

```tsx
import {
  // Navegación y acciones
  ArrowLeft, ExternalLink, MoreHorizontal, Plus, X, Check,
  
  // Estado y monitoreo
  Eye, EyeOff, Play, Pause, RefreshCw, AlertTriangle, CheckCircle,
  
  // Datos y análisis
  TrendingUp, TrendingDown, BarChart, LineChart, Activity,
  History, Calendar, Clock, Globe,
  
  // Edición
  Edit, Trash2, Settings, Save, Copy,
  
  // Tipos de cambio
  FileText, Code, Palette, DollarSign, Package,
  
  // UI
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Search, Filter, Download, Upload,
} from "lucide-react"
```

---

## 🎯 Especificación de la Página de Detalle

### Secciones Requeridas

#### 1. **Header con Breadcrumbs y Acciones**

```tsx
// Incluir:
- Breadcrumb: Dashboard > Competitors > [Competitor Name]
- Nombre del competidor (H1)
- URL del competidor (con link externo)
- Badges: Estado (Active/Paused), Priority (High/Medium/Low)
- Botones de acción:
  * Editar
  * Eliminar (con confirmación)
  * Toggle Monitoring (Eye/EyeOff)
  * Manual Check (Play icon)
  * Dropdown con más acciones
```

#### 2. **Stats Cards (4 columnas)**

```tsx
// Card 1: Total de Versiones
- Icono: History
- Valor: totalVersions
- Descripción: "versiones guardadas"

// Card 2: Cambios Detectados
- Icono: TrendingUp
- Valor: changeCount
- Descripción: "cambios en total" con +X esta semana

// Card 3: Última Verificación
- Icono: Clock
- Valor: formatTimestamp(lastCheckedAt)
- Descripción: "última verificación"

// Card 4: Severidad del Último Cambio
- Icono: AlertTriangle
- Valor: severity (con color correspondiente)
- Descripción: "nivel de alerta"
```

#### 3. **Tabs de Contenido**

```tsx
<Tabs defaultValue="overview" className="w-full">
  <TabsList>
    <TabsTrigger value="overview">Vista General</TabsTrigger>
    <TabsTrigger value="history">Historial</TabsTrigger>
    <TabsTrigger value="settings">Configuración</TabsTrigger>
  </TabsList>

  <TabsContent value="overview">
    {/* Vista General */}
  </TabsContent>

  <TabsContent value="history">
    {/* Historial de Cambios */}
  </TabsContent>

  <TabsContent value="settings">
    {/* Configuración del Competidor */}
  </TabsContent>
</Tabs>
```

##### Tab 1: Vista General

```tsx
// Incluir:

// A. Información del Competidor (Card)
- Nombre
- URL (con botón para abrir)
- Descripción
- Fecha de creación
- Última actualización
- Check interval
- Estado del monitoreo

// B. Últimos Cambios (Card)
- Lista de los últimos 5 cambios
- Cada cambio con:
  * Badge de severity
  * Resumen del cambio
  * Timestamp relativo
  * Botón para ver detalles
  
// C. Quick Actions (Card)
- Ejecutar check manual
- Ver todos los cambios
- Configurar alertas
- Exportar datos
```

##### Tab 2: Historial

```tsx
// Incluir:

// Filtros:
- Search bar
- Filtro por severity
- Filtro por fecha
- Ordenar por (más reciente/antiguo)

// Timeline de Cambios:
- Lista completa de cambios
- Formato de timeline vertical
- Agrupación por día/semana
- Iconos según tipo de cambio
- Expandible para ver detalles

// Cada cambio muestra:
- Fecha y hora
- Badge de severity
- Resumen
- Número de versión
- Botón de acciones (Ver detalles, Comparar, etc.)
```

##### Tab 3: Configuración

```tsx
// Incluir:

// Formulario de Edición:
- Nombre (Input)
- URL (Input)
- Descripción (Textarea)
- Priority (Select: Low/Medium/High)
- Check Interval (Select o Input)
- Monitoring Enabled (Switch)

// Botones:
- Guardar Cambios
- Cancelar
- Eliminar Competidor (en zona de peligro, con confirmación)
```

#### 4. **Zona de Peligro (Danger Zone)**

```tsx
// Al final del Tab de Settings
<Card className="border-destructive">
  <CardHeader>
    <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
    <CardDescription>
      Acciones irreversibles que afectarán permanentemente este competidor
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Botón para eliminar con Dialog de confirmación */}
  </CardContent>
</Card>
```

---

## 💡 Funcionalidades Adicionales (Nice to Have)

Si tienes tiempo, agrega estas features:

### 1. **Gráfico de Actividad**
```tsx
// Mostrar un gráfico de línea o barras con:
- Número de cambios por día/semana
- Usar biblioteca simple o placeholder
```

### 2. **Comparación de Versiones**
```tsx
// Dialog que permita seleccionar dos versiones y ver el diff
- Select para "Version A"
- Select para "Version B"
- Botón "Comparar"
- Mostrar diferencias lado a lado
```

### 3. **Export Data**
```tsx
// Botón para exportar:
- Historial completo (CSV)
- Report PDF
- Screenshot del sitio actual
```

### 4. **Notes/Comments**
```tsx
// Permitir agregar notas al competidor
- Textarea para agregar nota
- Lista de notas con fecha y autor
- Botón para eliminar nota
```

---

## 📝 Ejemplo de Estructura Completa

```tsx
"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { competitorsApi, Competitor } from "@/lib/competitors-api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  ExternalLink,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Play,
  MoreHorizontal,
  History,
  TrendingUp,
  Clock,
  AlertTriangle,
} from "lucide-react"

export default function CompetitorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const competitorId = params.id as string

  const [competitor, setCompetitor] = useState<Competitor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [manualCheckLoading, setManualCheckLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [competitorId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await competitorsApi.getCompetitor(competitorId)
      setCompetitor(response.data)
    } catch (err) {
      setError('Error al cargar el competidor')
    } finally {
      setLoading(false)
    }
  }

  const handleManualCheck = async () => {
    setManualCheckLoading(true)
    try {
      await competitorsApi.manualCheck(competitorId)
      await loadData()
    } catch (err) {
      setError('Error ejecutando check manual')
    } finally {
      setManualCheckLoading(false)
    }
  }

  // ... rest of handlers

  if (loading) {
    return <DashboardLayout>{/* Loading state */}</DashboardLayout>
  }

  if (error || !competitor) {
    return <DashboardLayout>{/* Error state */}</DashboardLayout>
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Breadcrumb + Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/competitors')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Competidores
              </Button>
            </div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold">{competitor.name}</h1>
              <Badge variant={getPriorityColor(competitor.priority)}>
                {competitor.priority}
              </Badge>
              <Badge variant={competitor.monitoringEnabled ? "default" : "secondary"}>
                {competitor.monitoringEnabled ? "Activo" : "Pausado"}
              </Badge>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <a
                href={competitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-primary"
              >
                {competitor.url}
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualCheck}
              disabled={manualCheckLoading}
            >
              {manualCheckLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Check Manual
            </Button>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            {/* More actions dropdown */}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Stat cards here */}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Overview content */}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {/* History content */}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {/* Settings content */}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
```

---

## ✅ Checklist de Implementación

Asegúrate de incluir:

- [ ] Layout con `DashboardLayout`
- [ ] Estados: loading, error, data
- [ ] useParams para obtener el ID de la URL
- [ ] Fetch de datos con `competitorsApi.getCompetitor(id)`
- [ ] Header con breadcrumb y nombre del competidor
- [ ] 4 Stats cards con métricas relevantes
- [ ] Tabs: Overview, History, Settings
- [ ] Badges para priority y status con colores correctos
- [ ] Botones de acciones (Edit, Delete, Manual Check, etc.)
- [ ] Formato de timestamps relativo
- [ ] Loading state con spinner
- [ ] Error state con botón de retry
- [ ] Dialog de confirmación para acciones destructivas
- [ ] Responsive design (grid-cols-1 md:grid-cols-4)
- [ ] TypeScript types correctos
- [ ] Manejo de errores en try/catch
- [ ] Link externo al sitio del competidor
- [ ] Dropdown menu con más acciones

---

## 🎨 Consideraciones de Diseño

### Espaciado
- Usar `space-y-8` para separación entre secciones principales
- Usar `space-y-4` o `space-y-6` dentro de cards
- Usar `gap-6` en grids

### Colores
- **Primary**: Acciones principales
- **Secondary**: Acciones secundarias
- **Destructive**: Acciones peligrosas (eliminar)
- **Outline**: Botones neutros
- **Muted**: Texto secundario

### Responsive
- Mobile first: `grid-cols-1`
- Tablet: `md:grid-cols-2`
- Desktop: `md:grid-cols-4` o `lg:grid-cols-4`

---

## 🚀 Extras Opcionales

Si terminas rápido, considera agregar:

1. **Skeleton Loading**: Usar `<Skeleton />` en lugar de spinner
2. **Toast Notifications**: Para feedback de acciones
3. **Keyboard Shortcuts**: Ej: `Ctrl+E` para editar
4. **Empty States**: Cuando no hay historial
5. **Pull to Refresh**: En móvil
6. **Infinite Scroll**: En historial
7. **Search Highlighting**: En búsqueda de historial

---

## 📚 Recursos de Referencia

- **Shadcn UI Docs**: https://ui.shadcn.com
- **Lucide Icons**: https://lucide.dev
- **TailwindCSS**: https://tailwindcss.com

---

## ✨ Notas Finales

- **Mantén consistencia** con las páginas existentes
- **Usa los patrones** que ya están establecidos en el proyecto
- **TypeScript strict**: Define tipos para todo
- **Accesibilidad**: Usa labels, aria-labels cuando sea necesario
- **Loading states**: Siempre muestra feedback visual
- **Error handling**: Catch todos los errores y muestra mensajes útiles

---

**¡Listo para implementar!** 🎉

Este prompt contiene toda la información necesaria para que una IA pueda generar la página de detalle del competidor siguiendo los estándares y patrones del proyecto.

