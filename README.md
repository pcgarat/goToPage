# Navegador de Páginas - Extensión Chrome

Extensión de Chrome que detecta automáticamente paginadores en páginas web y muestra una barra flotante vertical para navegación rápida entre páginas.

## Características

- **Detección automática**: Identifica paginadores en múltiples sitios web usando diversos patrones
- **Barra flotante vertical**: Muestra números de página en una barra compacta a la derecha de la pantalla
- **Rango configurable**: Ajusta dinámicamente cuántas páginas mostrar (por defecto: ±10 páginas)
- **Navegación inteligente**: Navega haciendo clic en los números, usando los links existentes o modificando la URL
- **Persistencia**: Guarda tus preferencias de rango entre sesiones

## Instalación

### Desde el código fuente

1. Clona o descarga este repositorio
2. Abre Chrome y ve a `chrome://extensions/`
3. Activa el "Modo de desarrollador" (toggle en la esquina superior derecha)
4. Haz clic en "Cargar extensión sin empaquetar"
5. Selecciona la carpeta del proyecto

### Iconos

Los iconos ya están incluidos en el proyecto (`icon16.png`, `icon48.png`, `icon128.png`).

**Si necesitas regenerarlos:**

**Opción 1 - Script Python (recomendado):**
```bash
pip install Pillow
python3 generate-icons.py
```

**Opción 2 - Generador HTML:**
1. Abre `generate-icons.html` en tu navegador
2. Haz clic en "Generar y Descargar Todos los Iconos"
3. Los iconos se descargarán automáticamente

**Opción 3 - Iconos personalizados:**
Crea tus propios iconos PNG con las dimensiones 16x16, 48x48 y 128x128 píxeles.

## Uso

1. Navega a cualquier página web que tenga un paginador
2. La barra flotante aparecerá automáticamente en el lado derecho de la pantalla
3. Haz clic en cualquier número para ir a esa página
4. Ajusta el rango usando el input numérico (controla cuántas páginas mostrar antes y después de la actual)
5. Usa el botón "◄" para ocultar/mostrar la barra

## Patrones de Detección

La extensión detecta paginadores usando múltiples métodos:

- Parámetros de URL (`?page=`, `?p=`, `?pagina=`)
- Elementos con clases comunes (`.pagination`, `.pager`, etc.)
- Links con texto "siguiente", "next", "anterior", "previous"
- Atributos `data-page` y `aria-label`
- Elementos activos/seleccionados en el paginador

## Tecnologías

- Manifest V3 (estándar actual de Chrome)
- Vanilla JavaScript
- Shadow DOM para aislamiento de estilos
- Chrome Storage API para persistencia

## Desarrollo

### Estructura de archivos

```
goToPage/
├── manifest.json      # Configuración de la extensión
├── content.js         # Lógica principal y detección
├── styles.css         # Estilos adicionales (mínimos)
└── README.md          # Este archivo
```

### Pruebas

Para probar la extensión:

1. Carga la extensión en modo desarrollador
2. Visita sitios con paginación como:
   - Resultados de búsqueda de Google (página 2+)
   - Foros con múltiples páginas
   - Catálogos de productos con paginación
   - Cualquier sitio con parámetros `?page=` en la URL

## Licencia

Este proyecto es de código abierto y está disponible para uso personal y comercial.

