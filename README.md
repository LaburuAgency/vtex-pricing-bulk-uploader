# VTEX Pricing Bulk Uploader

Herramienta para actualización masiva de precios en VTEX utilizando archivos CSV.

## Características

- ✅ Actualización masiva de precios desde archivos CSV
- ⚡ Control de velocidad con rate limiting configurable
- 🔐 Autenticación segura con VTEX API
- 📊 Reportes detallados de éxito y errores
- 🛡️ Validación de datos y manejo robusto de errores

## Requisitos

- Node.js 14 o superior
- Cuenta VTEX con permisos de API
- App Key y App Token de VTEX

## Instalación

1. Clona o descarga el proyecto
2. Instala las dependencias:
```bash
npm install
```

3. Crea el archivo `.env` basado en `.env.example`:
```bash
cp .env.example .env
```

4. Configura tus credenciales en el archivo `.env`:
```env
VTEX_ACCOUNT_NAME=tu-cuenta-vtex
VTEX_APP_KEY=tu-app-key
VTEX_APP_TOKEN=tu-app-token
CSV_FILE_PATH=./data.csv
RATE_LIMIT=2
```

## Uso

1. Prepara tu archivo CSV con las siguientes columnas requeridas:
   - `Parte` - SKU del producto
   - `Precio Base.` - Precio a actualizar (formato: $1,234,567)

2. Ejecuta la herramienta:
```bash
npm start
```

## Formato del CSV

El archivo CSV debe incluir las siguientes columnas:

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| Parte | SKU del producto | 10446 |
| Precio Base. | Precio en formato monetario | $ 225,000 |

### Ejemplo de CSV válido:
```csv
Parte,Descripcion, Precio Base.
10446,CESTA REDONDA MOCCA," $ 225,000 "
10447,CESTA REDONDA AZ NVY," $ 225,000 "
```

## Configuración

### Variables de entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `VTEX_ACCOUNT_NAME` | Nombre de la cuenta VTEX | - |
| `VTEX_APP_KEY` | Clave de la aplicación VTEX | - |
| `VTEX_APP_TOKEN` | Token de la aplicación VTEX | - |
| `CSV_FILE_PATH` | Ruta al archivo CSV | ./data.csv |
| `RATE_LIMIT` | Solicitudes por segundo | 2 |

### Rate Limiting

La herramienta incluye control de velocidad para evitar sobrecargar la API de VTEX. El valor recomendado es 2 solicitudes por segundo.

## Salida del programa

La herramienta proporciona información detallada durante la ejecución:

```
🚀 Starting VTEX price update process...
📊 Found 150 products to update
📈 Updating 150 prices with rate limit of 2 requests/second
✅ [1/150] Updated 10446: $225000
✅ [2/150] Updated 10447: $225000
...

📊 Update Summary:
✅ Successful: 148
❌ Failed: 2

🔍 Failed Updates:
- 12345: Item not found
- 67890: Invalid price format
```

## Manejo de errores

La herramienta maneja varios tipos de errores:

- **Configuración inválida**: Credenciales faltantes o archivo CSV no encontrado
- **Errores de formato**: Precios inválidos o SKUs malformados
- **Errores de API**: Productos no encontrados, límites de velocidad, problemas de red
- **Errores de parsing**: Problemas al leer el archivo CSV

## Licencia

MIT