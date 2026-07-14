# GLF - Prototipo local de adquisiciones

Este prototipo demuestra cómo podría funcionar una solución básica para gestión de adquisiciones y expedientes contractuales GLF antes de construir la aplicación definitiva.

## Qué incluye

- Login interno para el piloto: `ADMIN` / `DEMO`.
- Datos reales importados desde el Excel proporcionado.
- Dashboard ejecutivo.
- Registro maestro filtrable.
- Expediente contractual por código.
- Checklist documental basado en el índice del Excel.
- Seguimientos por IDD, contratación directa, no objeción y garantías.
- Calendario de vencimientos y próximos eventos.
- Semáforo inteligente de riesgo por expediente.
- Bitácora local de cambios por expediente.
- Estructura automática sugerida para expediente digital.
- Reportes PDF.
- Exportaciones Excel.
- Preparación para Google Drive API.
- Guardado en carpeta local sincronizada de Google Drive usando el selector de carpetas del navegador.
- Política de seguridad del navegador mediante Content Security Policy.

## Cómo abrir localmente

Opción recomendada:

1. Abre PowerShell en la carpeta `prototype-app`.
2. Ejecuta `.\start-local.ps1`.
3. Abre `http://127.0.0.1:8770`.
4. Ingresa con `ADMIN` / `DEMO`.

Nota: esta forma evita restricciones del navegador al abrir archivos directamente.

Opción alternativa para pruebas:

1. Abre la carpeta `prototype-app` en Visual Studio Code.
2. Usa una extensión tipo “Live Server” o publica la carpeta con cualquier servidor local simple.

Ejemplo con Python desde `prototype-app`:

```powershell
python -m http.server 8770
```

Luego abrir:

```text
http://127.0.0.1:8770
```

## Carpeta local de Google Drive

Si usas Google Drive para escritorio:

1. Entra a la pestaña “Drive y archivos”.
2. Haz clic en “Escoger carpeta local”.
3. Selecciona una carpeta dentro de tu Google Drive local.
4. Desde ese momento la app puede guardar respaldos y copiar archivos al expediente seleccionado.

Nota: esto usa permisos del navegador. Funciona mejor en Chrome o Edge desde `localhost`.

## Google Drive API real

Para que la app publicada en GitHub Pages pueda crear carpetas y subir archivos directamente a Google Drive, se necesita un OAuth Client ID.

Pasos generales:

1. Ir a Google Cloud Console: https://console.cloud.google.com/
2. Crear un proyecto, por ejemplo: `GLF Prototipo Adquisiciones`.
3. Habilitar la API “Google Drive API”.
4. Ir a “APIs y servicios” -> “Pantalla de consentimiento OAuth”.
5. Configurar la pantalla de consentimiento.
6. Ir a “Credenciales”.
7. Crear credencial “ID de cliente de OAuth”.
8. Tipo de aplicación: “Aplicación web”.
9. Agregar orígenes autorizados:
   - Para pruebas locales: `http://localhost:8770`
   - Si usas Live Server: `http://localhost:5500` o el puerto que indique VS Code.
   - Para GitHub Pages: `https://TU-USUARIO.github.io`
10. Copiar el Client ID en la pantalla “Drive y archivos” del prototipo.

Permiso usado por la app:

- `https://www.googleapis.com/auth/drive.file`

Ese permiso permite crear y administrar archivos creados o abiertos por esta app, evitando pedir acceso completo a todo Drive.

## Seguridad del prototipo

Este es un prototipo demostrativo sin backend. Por eso:

- El login `ADMIN` / `DEMO` no debe considerarse seguridad real de producción.
- Los datos se guardan en el navegador del usuario mediante `localStorage`.
- La sesión del piloto expira automáticamente después de 8 horas.
- El contenido proveniente del Excel y de formularios se escapa antes de mostrarse para reducir riesgo de inyección HTML.
- Los nombres de archivos/carpetas se limpian antes de guardar localmente.
- Para una aplicación definitiva se recomienda backend, base de datos, autenticación institucional y auditoría real.

La revisión técnica de seguridad y robustez quedó documentada en:

- `SECURITY_REVIEW.md`

## Publicación posterior en GitHub Pages

Cuando el prototipo esté depurado:

1. Crear un repositorio en GitHub, preferiblemente privado si se mantienen datos reales.
2. Subir únicamente el contenido de `prototype-app`.
3. Activar GitHub Pages desde la rama principal.
4. Agregar el dominio de GitHub Pages como origen autorizado en Google Cloud OAuth.
5. Probar Google Drive / Google Sheets real cuando ya exista OAuth.

Ver instrucciones detalladas en:

- `GITHUB_PAGES.md`

## Alimentación de datos

El prototipo permite actualizar datos desde la pantalla `Expediente`, sección `Actualizar datos del expediente`.

Los cambios se guardan localmente en el navegador y se incluyen al usar `Descargar Excel actualizado`.

Para alimentar un Google Sheet real en línea se requiere una integración adicional con Google OAuth, Google Sheets API o Apps Script.

## Innovaciones incorporadas

- `Semáforo inteligente de riesgo`: calcula riesgo bajo, medio, alto o crítico usando monto, nivel, IDD, documentos, vencimientos, garantías y no objeción.
- `Bitácora de cambios`: registra creación, edición, carga de archivos y generación de estructura digital por expediente.
- `Expediente digital automático`: propone y registra carpetas estándar para Drive o carpeta local sincronizada.

## Logotipo e identidad GLF

El prototipo usa el logotipo horizontal blanco descargado desde el sitio oficial de GLF:

- `assets/glf-logo-horizontal-blanco.png`

También toma como referencia las variables detectadas en la hoja de estilos oficial del sitio:

- Azul: `#1E3A6C`
- Cyan: `#00C1DE`
- Verde: `#038C7C`
- Blanco: `#ffffff`
- Negro: `#1d1d1b`
- Fuente principal: `Roboto`

Referencias locales guardadas:

- `docs/glf-home.html`
- `docs/glf-style.css`

Si luego se entrega un manual de marca oficial, se deben revisar proporciones, áreas de seguridad, usos permitidos del logo y colores secundarios.

## Regenerar datos desde Excel

Desde la carpeta raíz del proyecto:

```powershell
python tools/export_prototype_seed.py
```

Esto actualiza `prototype-app/data/seed-data.js`.
