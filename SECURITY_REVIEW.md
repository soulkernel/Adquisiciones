# Revisión de seguridad y robustez del prototipo

Fecha: 2026-07-14

## Mejoras aplicadas

- Se agregó una política CSP en `index.html` para limitar fuentes de scripts, estilos, imágenes, conexiones y frames.
- Se agregó sesión demo con expiración de 8 horas usando `sessionStorage`.
- Se subió la versión interna de datos locales a `glf_demo_state_v2` para evitar reutilizar estados antiguos del navegador.
- Se agregó carga tolerante a errores cuando `localStorage` está vacío, corrupto o incompleto.
- Se escapó contenido proveniente del Excel, formularios y logs antes de insertarlo en la página.
- Se marcaron explícitamente como HTML confiable solo los componentes internos controlados, como botones de acción y pills.
- Se validan nombres de carpetas y archivos antes de escribir en carpeta local.
- Se validan Client IDs de Google OAuth antes de iniciar autenticación.
- Se agregó manejo de errores para creación de carpetas Drive y escritura de archivos locales.
- Se agregó límite demo de 50 MB por archivo local para evitar bloqueos accidentales del navegador.
- Se agregaron verificaciones de carga para librerías PDF y Excel antes de exportar.
- Se agregó vista de calendario para contratos, IDD, garantías y entregables.

## Riesgos que permanecen por ser prototipo frontend

- El login `ADMIN` / `DEMO` no es autenticación real. Cualquier usuario con acceso al código puede verlo.
- Los datos se almacenan en el navegador, no en una base de datos con control de acceso.
- No existe backend para auditoría inalterable.
- Google Drive real depende de OAuth y de la configuración de Google Cloud.
- Las librerías externas se cargan desde CDN; para producción conviene empaquetarlas o fijarlas con integridad.
- Los permisos del selector de carpeta local dependen del navegador y del usuario.

## Recomendaciones para la aplicación definitiva

- Usar autenticación institucional: Microsoft Entra ID o Google Workspace.
- Implementar backend con roles, permisos, bitácora y base de datos.
- Mover reglas de negocio críticas al servidor.
- Guardar documentos en repositorio controlado con permisos por expediente.
- Implementar auditoría inalterable para cambios, aprobaciones y documentos.
- Usar escaneo antivirus/OCR para archivos cargados.
- Empaquetar dependencias y aplicar revisión SRI/SBOM.
- Implementar copias de seguridad, monitoreo y recuperación ante errores.
