# Backend — Taza & Miga API

> API REST desarrollada en Node.js con Express 5 y MariaDB, implementada bajo una estricta arquitectura en 3 capas, validación con Zod y autorización basada en roles (RBAC) con JWT.

---

## 🏛️ Arquitectura en 3 capas (Obligatoria)

El flujo de toda petición HTTP sigue invariablemente el camino **Ruta → Servicio → Repositorio → Base de datos**:

```text
Petición HTTP
     │
     ▼
[ 1. routes/ ]
  • Lee `req.body`, `req.params` y `req.query`.
  • Valida exhaustivamente con esquemas Zod (`src/schemas/`).
  • Obtiene los datos del usuario autenticado desde `req.usuario` (inyectados por `verificarToken`).
  • Invoca al servicio correspondiente.
  • Responde con el código de estado HTTP adecuado (200, 201, 204).
  * No contiene lógica de negocio ni sentencias SQL.
     │
     ▼
[ 2. services/ ]
  • Aplica las reglas de negocio (RN-01 a RN-35).
  • Valida permisos por rol (`DUENO`, `GERENTE`, `BARISTA`) y ámbito de sucursal.
  • Maneja transacciones SQL atómicas cuando se modifican múltiples tablas.
  • Registra acciones críticas en `auditoria_logs` (RN-27).
  • Lanza excepciones estructuradas mediante la clase `ErrorApp(codigoHttp, mensaje)`.
  * Desacoplado del protocolo: no conoce ni utiliza los objetos `req` ni `res`.
     │
     ▼
[ 3. repositories/ ]
  • Es el único lugar donde se escribe código SQL.
  • Ejecuta consultas parametrizadas con `?` mediante el pool de conexiones de `mysql2/promise`.
  • Realiza mapeos de columnas `snake_case` a objetos JavaScript `camelCase` mediante alias `AS`.
  * No toma decisiones de negocio ni valida permisos.
     │
     ▼
Base de datos (MariaDB)
```

---

## 📂 Estructura de carpetas

```text
backend/
├── database/                    # Scripts SQL ordenados correlativamente
│   ├── 01-negocios.sql
│   ├── 02-sucursales.sql
│   ├── 03-usuarios.sql
│   ├── 04-auditoria_logs.sql
│   ├── 05-semillas-pruebas.sql
│   ├── 06-categorias.sql
│   ├── 07-grupos_opciones.sql
│   ├── 08-opciones.sql
│   ├── 09-productos.sql
│   ├── 10-producto_grupos.sql
│   ├── 11-semillas-menu.sql
│   ├── 12-ordenes.sql
│   ├── 13-detalles_orden.sql
│   ├── 14-detalle_orden_opciones.sql
│   └── 15-tickets.sql
├── src/
│   ├── db.js                    # Pool de conexiones MariaDB con mysql2
│   ├── ErrorApp.js              # Clase de excepción personalizada con status HTTP
│   ├── index.js                 # Entrada principal, montaje de rutas, CORS y 404 JSON
│   ├── middlewares/
│   │   ├── verificarToken.js    # Decodificación y validación de tokens JWT
│   │   ├── permitirRoles.js     # Control de acceso por rol y bloqueo de claves temporales
│   │   └── manejarErrores.js    # Manejo centralizado de ErrorApp, ZodError y MySQL
│   ├── repositories/            # Acceso a datos con SQL parametrizado
│   ├── routes/                  # Controladores de ruta Express con esquemas Zod
│   ├── schemas/                 # Validaciones Zod (auth, admin, orden, etc.)
│   ├── services/                # Reglas de negocio, cálculos y auditoría
│   └── scripts/                 # Scripts de mantenimiento, siembra y pruebas
├── docker-compose.yml           # Configuración de MariaDB local en puerto 3307
├── package.json
└── pruebas.http                 # Casos de prueba listos para REST Client
```

---

## ⚙️ Variables de entorno (`.env`)

Crea un archivo `.env` en la raíz de `backend/` a partir de `.env.example`:

```ini
# Base de datos MariaDB (Docker local)
DB_HOST=localhost
DB_PORT=3307
DB_NAME=taza_miga
DB_USER=usuario_local
DB_PASSWORD=contrasena_segura_local
DB_ROOT_PASSWORD=root_contrasena_segura_local

# Servidor API
PORT=3001
FRONTEND_URL=http://localhost:5173
JWT_SECRET=clave_super_secreta_para_firmar_tokens_jwt
```

---

## 📜 Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `pnpm run dev` | Inicia el servidor con recarga automática (`node --watch`). |
| `pnpm start` | Inicia el servidor en modo estándar. |
| `pnpm run inicializar` | Script de inicialización de un solo uso (HU-04, RN-02). Crea el negocio, sucursal base y dueño inicial. Se niega a ejecutarse si el sistema ya fue inicializado. |
| `pnpm run sembrar-menu` | Inserta categorías, grupos de opciones y productos base en el menú. |
| `pnpm run sembrar:demo` | Inserta datos de prueba completos: 2 sucursales con coordenadas GPS, personal asignado, menú bilingüe, historial de órdenes con tickets y eventos de auditoría. |
| `pnpm run verificar-pruebas` | Ejecuta de manera automatizada las 144 pruebas de integración de la API comprobando códigos de estado y respuestas JSON. |
| `pnpm run verificar-calculos`| Certifica matemáticamente las reglas de métricas analíticas (RN-30 a RN-35). |

---

## 🔒 Reglas técnicas mandatorias

* **Cálculo de dinero en centavos:** Para evitar errores de punto flotante de JavaScript, todos los cálculos monetarios se procesan como enteros (centavos) en el servicio y se persisten en base de datos en formato `DECIMAL(10,2)`.
* **Fechas y horas:** Se registran y comparan en tiempo universal coordinado (**UTC**) en la base de datos, mostrándose al cliente en la zona horaria `America/El_Salvador`.
* **Aislamiento multinegocio:** Toda consulta filtrada por negocio toma el `negocio_id` extraído del token JWT verificado en el servidor (`req.usuario.negocio_id`), nunca de parámetros manipulables enviados por el cliente. Intentos de acceder a recursos de otros negocios responden con **404 Not Found** (RN-01).
* **Seguridad de contraseñas:** Cifrado con `bcryptjs` con un mínimo obligatorio de 8 caracteres (RN-07). Las contraseñas nunca viajan en las respuestas de la API ni en texto plano.
* **Manejo defensivo de errores:** La API responde **siempre** en formato JSON estructurado `{ error, mensaje }`, incluso ante rutas inexistentes (404) o errores inesperados (500).
