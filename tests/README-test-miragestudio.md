# Test de Flujo Completo: miragestudio.eu

Este test verifica el flujo completo de creación y análisis de un competidor.

## Ejecución

```bash
cd competitor-tracker-Backend
node tests/test-miragestudio-flow.js
```

## Variables de Entorno (Opcionales)

```env
API_URL=http://localhost:3002/api
TEST_USER_EMAIL=ramfiaogusto@gmail.com
TEST_USER_PASSWORD=12345678
```

## ¿Qué hace el test?

1. ✅ **Inicia sesión** con las credenciales de prueba
2. ✅ **Lista competidores** existentes
3. ✅ **Busca y borra** el competidor "mirages" si existe
4. ✅ **Crea el competidor** de nuevo con URL `https://miragestudio.eu/`
5. ⏳ **Espera el análisis inicial** (hasta 3 minutos)
6. ✅ **Verifica** que se haya creado la primera versión
7. ✅ **Muestra detalles** del análisis (estructura, IA, etc.)

## Problema Identificado

### Error de HeadlessX: Header Inválido

El test muestra que el análisis no completa porque HeadlessX está fallando con:

```
"error": "Content validation failed",
"message": "Invalid character in header content [\"X-Page-Title\"]"
```

**Causa**: HeadlessX genera el HTML exitosamente (2.2MB), pero falla al enviar la respuesta HTTP porque el header `X-Page-Title` contiene caracteres inválidos (probablemente saltos de línea o caracteres especiales del título de la página en polaco).

**Evidencia de los logs**:
```
[2025-11-04T03:21:04.989Z] Content fully extracted - Length: 2225503 chars
[2025-11-04T03:21:04.990Z] Successfully rendered HTML (GET): https://miragestudio.eu/
```

Pero luego:
```
23:21:04 [error]: HeadlessX Response Error: Request failed with status code 500
"error": "Invalid character in header content [\"X-Page-Title\"]"
```

## Solución Propuesta

### Opción 1: Arreglar HeadlessX (Recomendado)
HeadlessX debe sanitizar el header `X-Page-Title` antes de enviarlo:
- Remover caracteres de control (`\r`, `\n`, `\t`, etc.)
- Remover caracteres no-ASCII problemáticos
- Truncar si es muy largo

### Opción 2: Usar endpoint sin headers
Si HeadlessX tiene un endpoint que no incluya headers problemáticos, usar ese.

### Opción 3: Manejo de errores en nuestro backend
Intentar extraer el HTML del body de error si está disponible (pero esto puede no funcionar si Express rechaza la respuesta antes de que llegue a Axios).

## Estado Actual

- ✅ Test funciona correctamente
- ✅ Borrado y creación de competidor funciona
- ❌ Análisis inicial no completa debido a error de HeadlessX
- ⚠️ El backend está intentando analizar pero HeadlessX falla

## Próximos Pasos

1. **Reportar bug a HeadlessX**: El header `X-Page-Title` debe ser sanitizado
2. **Workaround temporal**: Usar un endpoint diferente de HeadlessX si está disponible
3. **Monitorear**: Ver si otros sitios tienen el mismo problema (solo sitios con títulos en caracteres especiales)



