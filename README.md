# Preinformes Web App

Aplicacion web para registrar preinformes estudiantiles con `React + Bootstrap` en el frontend, `Node.js` en `Vercel Functions` para el backend, y `Supabase` como base de datos relacional.

## Arquitectura

- `src/`: SPA React.
- `api/index.js`: API HTTP para login, administracion, preinformes y PDF.
- `lib/`: acceso a Supabase, cache, autenticacion y servicios.
- `scripts/init-sheets.mjs`: valida la conexion y el acceso a las entidades requeridas.
- `templates/*.csv`: plantillas para carga masiva.

## Modelo de datos

La aplicacion trabaja sobre estas tablas:

- `Teachers`: docentes usuarios del sistema.
- `Subjects`: asignaturas.
- `Grades`: grados, modalidad educativa y director de grupo.
- `GradeSubjects`: asociacion grado-asignatura-docente.
- `Students`: estudiantes y su grado.
- `Periods`: periodos academicos.
- `PreReports`: preinformes por estudiante, asignatura y periodo.
- `Settings`: ajustes reservados.

Todos los valores se normalizan antes de persistirse o devolverse al frontend. Las entidades generadas por el sistema usan IDs secuenciales del tipo `_0001`.

## Variables de entorno

Copia `.env.example` a `.env` y configura:

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_publishable_o_anon_key
SUPABASE_SERVICE_ROLE_KEY=
APP_PASSWORD_SALT=cambia-este-valor
APP_BASE_URL=http://127.0.0.1:5173
GMAIL_SMTP_USER=tu-cuenta@gmail.com
GMAIL_APP_PASSWORD=contraseña-de-aplicacion-de-16-caracteres
PASSWORD_RESET_EMAIL_FROM=Preinformes <tu-cuenta@gmail.com>
PASSWORD_RESET_TTL_MINUTES=30
PASSWORD_RESET_COOLDOWN_SECONDS=60
CACHE_TTL_MS=60000
DEFAULT_INSTITUTION_ID=_0001
DEFAULT_SEDE_ID=_0001
```

La recuperación de contraseñas utiliza Gmail mediante SMTP. En producción, `APP_BASE_URL` debe ser la URL pública de Vercel. Activa la verificación en dos pasos de la cuenta Gmail y genera una contraseña de aplicación; utiliza esa clave de 16 caracteres en `GMAIL_APP_PASSWORD`, no la contraseña normal de Gmail. `SUPABASE_SERVICE_ROLE_KEY` y `GMAIL_APP_PASSWORD` solo deben configurarse en el servidor y nunca exponerse en variables `VITE_*`.

Antes de desplegar esta funcionalidad, ejecuta en el SQL Editor de Supabase:

```text
supabase/migrations/20260722_add_teacher_email_and_password_resets.sql
```

## Instalacion local

```bash
npm install
npm run init:db
npm run seed:admin
```

En desarrollo local abre dos terminales:

```bash
npm run dev:api
```

```bash
npm run dev
```

Tambien puedes crear el admin con valores personalizados:

```bash
npm run seed:admin -- --id=admin --firstName=Admin --lastName=Institucion --email=admin@ejemplo.com --password=admin123
```

## Despliegue en Vercel

1. Crea un repositorio con este proyecto.
2. Importa el repo en Vercel.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Agrega las variables de entorno del archivo `.env.example`.
7. Despliega.

Las rutas `/api/*` se sirven desde `api/index.js` como funciones Node.

## Uso funcional

### Administrador

- Crea o importa docentes.
- Crea o importa asignaturas.
- Crea o importa grados.
- Define modalidad y director de grupo por grado.
- Define las asociaciones en `GradeSubjects`.
- Crea o importa estudiantes.
- Crea periodos academicos.
- Los IDs internos de asignaturas, grados, asignaciones, estudiantes, periodos y preinformes se generan automaticamente como secuencias de texto.
- Solo el `id` del docente usuario se define manualmente porque se usa para el ingreso.

### Docente

- Inicia sesion con `id` y `clave`.
- Solo ve grados y asignaturas que tenga asignadas.
- Crea preinformes solo para estudiantes disponibles en su grado/asignatura/periodo.
- Edita o borra sus propios preinformes.

### PDF

- El administrador puede generar PDFs por filtros.
- El director de grupo puede generar PDFs para sus grados.
- El director de grupo tambien puede exportar CSV y ver resumenes filtrados de sus grados.

## Importaciones masivas

Puedes usar:

- Archivos Excel o CSV desde el panel administrador.
- JSON pegado desde el panel administrador.
- Plantillas de `templates/` como base.

Columnas esperadas por entidad:

- `Teachers`: `id, firstName, lastName, email, password, isAdmin, active`
- `Subjects`: `id, name, shortName, active`
- `Grades`: `id, name, educationModel, directorTeacherId, active`
- `GradeSubjects`: `id, gradeId, subjectId, teacherId, active`
- `Students`: `id, firstName, lastName, gradeId, active`
- `Periods`: `id, name, status, active`

## Endpoints principales

- `POST /api/login`
- `POST /api/password/forgot`
- `POST /api/password/reset`
- `GET /api/bootstrap`
- `GET /api/teacher/students`
- `GET /api/teacher/pre-reports`
- `POST /api/pre-reports`
- `PUT /api/pre-reports/:id`
- `DELETE /api/pre-reports/:id`
- `POST /api/admin/entity`
- `POST /api/admin/import-workbook`
- `POST /api/admin/import-sheet`
- `POST /api/pdf`

## Observaciones de implementacion

- Las claves de docentes no se almacenan en claro en la base desde la API manual; se convierten a hash SHA-256 con `APP_PASSWORD_SALT`.
- Los tokens de recuperación se almacenan como hash, vencen por defecto en 30 minutos y solo pueden utilizarse una vez.
- El frontend guarda un token simple en `localStorage`; para produccion conviene endurecer esto con expiracion y firma.
- La interfaz administrativa es funcional y deliberadamente compacta; puede evolucionarse a formularios especificos por entidad.
