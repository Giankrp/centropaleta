# Centro Paleta · Código completo con inventario persistente

Exportación de la versión 57 publicada el 15 de octubre de 2026.
Commit: 3e08732c5ac7ad0b5b4aa0f72d21b3d34716e1ed

## Contenido

- public/: HTML, CSS, JavaScript, imágenes y bibliotecas de escaneo/OCR.
- public/cloud-bootstrap.js: carga del inventario desde el servidor.
- public/inventory-editor.js: alta, edición, imagen, eliminación, importación inicial y copia JSON.
- app/api/inventory/route.ts: API de lectura y escritura con autorización en servidor.
- lib/inventory-service.js: persistencia, validación, control de concurrencia e idempotencia.
- lib/stock-core.js: reglas de productos, stock, descuentos y ventas físicas.
- db/schema.ts y drizzle/: esquema y migración SQL.
- tests/: pruebas del inventario y recepción de stock.
- package.json y pnpm-lock.yaml: dependencias y comandos de ejecución.

## Base de datos y funcionamiento

La versión actual utiliza Cloudflare D1 (SQLite), NO PostgreSQL. Guarda productos,
imágenes comprimidas, descripciones, categorías, precios, códigos, existencias,
ofertas, movimientos y ventas físicas. El guardado se confirma tras recibir la
respuesta del servidor. Los conflictos de edición se rechazan antes de sobrescribir.
El historial de ventas se conserva cuando se elimina un producto.

Este ZIP contiene código y estructura SQL, no una copia de los registros de la
base de datos publicada. Para descargar los registros disponibles para tu cuenta,
usa Inventario → Descargar copia del inventario en la web actual.

Las cuentas/perfiles de demostración, favoritos, encargos y etiquetas de envío
mantienen sus mecanismos locales anteriores; no se han migrado a D1 en esta fase.
Los pagos reales no están conectados. El checkout online sigue siendo una simulación.
Los productos guardados anteriormente solo en el navegador no se importan solos:
usa Inventario → Importar productos de este navegador desde el dispositivo original.

## Requisitos de ejecución

Node.js >=22.13.0, pnpm 11.25.0 y un entorno compatible con Cloudflare Workers/D1.
La autenticación de producción utiliza las cabeceras verificadas de ChatGPT Sites.
INVENTORY_ADMIN_EMAIL es una variable del servidor; debe configurarse en el entorno
de despliegue. Nunca se incluye su valor de producción ni ninguna clave en el ZIP.

No basta con abrir index.html o subir public/ a un alojamiento estático para disponer
de la base de datos. Tampoco es un tema ni un plugin de WordPress. Para Hostinger u
otro servidor Node/PHP hay que adaptar el backend, la conexión a base de datos y la
autenticación. Si se elige PostgreSQL, también se deben adaptar SQL y acceso a datos.
No se deben aceptar cabeceras de identidad enviadas directamente por el visitante
fuera de la pasarela confiable de Sites.

## Desarrollo local

1. Instala las dependencias con `pnpm install --frozen-lockfile`.
2. Ejecuta `pnpm build` para generar el Worker y su configuración local.
3. Aplica la migración al almacenamiento LOCAL:

   `pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_flashy_freak.sql`

4. Para el acceso administrativo de prueba, crea un archivo `.dev.vars` local con
   `INVENTORY_ADMIN_EMAIL=seedy@sites.test`. No lo subas a Git ni a producción.
5. Inicia con `pnpm dev` y utiliza la URL local que imprima el servidor.
   La simulación local de inicio de sesión usa `/signin-with-chatgpt?return_to=/panel.html`.
   Esa identidad de prueba no se incorpora a producción.

Las bases de datos local y publicada son independientes. Aplica cada migración una
sola vez en tu base local. No modifiques migraciones ya aplicadas.

## Validación realizada

- Compilación del proyecto completada antes de publicar la versión 57.
- Sintaxis de JavaScript e inline scripts de HTML comprobada.
- `node tests/reception.cjs`: lectura de códigos y recepción.
- `node tests/inventory-service.mjs`: persistencia de campos e imágenes, edición,
  conflictos, validación, códigos únicos, doble envío, concurrencia, venta, borrado,
  historial, importación y errores de almacenamiento sin cambios parciales.
- Migración aplicada correctamente a una base D1 local.
- Despliegue de la versión 57 confirmado como correcto por Sites.

No se ha realizado una prueba visual en navegador de esta versión ni de la cámara
física. Las pruebas de persistencia usan SQLite real con un adaptador del contrato
D1; no constituyen una prueba de cada flujo en el navegador publicado.
