# Publicación en GitHub Pages

Este directorio contiene una aplicación web estática. Puede publicarse directamente en GitHub Pages sin proceso de compilación.

## Antes de subir

1. Revisar que no existan credenciales reales en el repositorio.
2. Confirmar si el repositorio será privado o público.
3. Si los datos del archivo `data/seed-data.js` son sensibles, usar un repositorio privado o anonimizar antes de publicar.

## Subida inicial sugerida

Desde la carpeta `prototype-app`:

```powershell
git init
git add .
git commit -m "Versión inicial del prototipo GLF"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin main
```

## Activar GitHub Pages

1. Ir al repositorio en GitHub.
2. Entrar en `Settings`.
3. Entrar en `Pages`.
4. En `Build and deployment`, seleccionar:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guardar.

GitHub entregará una URL similar a:

```text
https://TU-USUARIO.github.io/TU-REPOSITORIO/
```

## Google Drive / Google Sheets

Para usar Google Drive o Google Sheets reales desde GitHub Pages, se debe crear un OAuth Client ID en Google Cloud y agregar como origen autorizado:

```text
https://TU-USUARIO.github.io
```

Si el repositorio usa dominio propio, agregar también ese dominio.

## Limitaciones actuales del prototipo

- El login `ADMIN / DEMO` es demostrativo, no seguridad productiva.
- Los cambios se guardan localmente en el navegador.
- El Excel actualizado se descarga desde el navegador.
- El envío automático de correos requiere backend, Microsoft Power Automate, Google Apps Script o una integración de correo institucional.
