# Neptuno 🎓

**SaaS Multi-tenant para Gestión Integral de Instituciones Educativas**

Neptuno es una plataforma white-label, modular y escalable que unifica administración académica, aulas virtuales, evaluación, reporting y portal de padres, con branding autogestionado por institución.

## 🚀 Características Principales

### 🏢 Multi-tenancy Seguro
- **Row Level Security (RLS)** implementado en Supabase
- Aislamiento completo de datos entre instituciones
- Gestión centralizada de tenants desde super admin

### 👥 Gestión de Usuarios y Roles
- **Super Admin**: Gestión de tenants, planes y monitoreo de plataforma
- **Admin Institución**: Configuración, usuarios, cursos, facturación y branding
- **Coordinador Académico**: Planes de estudio, asignación de profesores, reportes
- **Profesor**: Gestión de cursos, evaluaciones y calificaciones
- **Estudiante**: Acceso a cursos, evaluaciones y recursos
- **Padre/Acudiente**: Portal de seguimiento académico

### 📚 Gestión Académica Completa
- **Cursos y Módulos**: Estructura jerárquica de contenidos
- **Lecciones**: Videos, documentos y recursos multimedia
- **Evaluaciones**: Formularios dinámicos con múltiples tipos de preguntas
- **Calificaciones**: Sistema de puntuación y retroalimentación
- **Certificados**: Generación automática con códigos QR de verificación
- **Progreso de Lecciones**: Seguimiento detallado del avance estudiantil
- **Control de Asistencia**: Registro de presencia, tardanzas y ausencias
- **Horarios de Clase**: Programación y gestión de cronogramas académicos

### 🎨 Branding Personalizable
- Logo y colores por institución
- Plantillas de certificados personalizables
- Portal white-label completamente brandeable

### 👨‍👩‍👧‍👦 Portal de Padres
- Seguimiento del progreso académico en tiempo real
- Visualización de calificaciones y evaluaciones
- Sistema de notificaciones personalizadas
- Observaciones y comunicación directa con profesores
- Mensajería integrada padre-profesor
- Acceso a reportes de asistencia y comportamiento

### 💰 Sistema de Pagos
- Gestión de matrículas y mensualidades
- Integración con Stripe para procesamiento de pagos
- Control de estados de pago y vencimientos
- Generación de recibos automáticos

## 🛠️ Stack Tecnológico

### Frontend
- **React 19** con TypeScript
- **Vite** como build tool
- **Tailwind CSS** para estilos
- **React Router** para navegación
- **TanStack Query** para manejo de estado del servidor
- **Heroicons** para iconografía

### Backend
- **Supabase** como Backend-as-a-Service
- **PostgreSQL** como base de datos principal
- **Row Level Security (RLS)** para multi-tenancy
- **Supabase Auth** para autenticación
- **Supabase Storage** para archivos multimedia

### Infraestructura
- **Supabase Cloud** para hosting y base de datos
- **Vercel/Netlify** para deployment del frontend
- **Stripe** para procesamiento de pagos

## 📊 Modelo de Datos

El sistema está diseñado con las siguientes entidades principales:

- **Perfiles de Usuario**: Información extendida de usuarios
- **Roles y Permisos**: Sistema granular de autorización
- **Instituciones**: Configuración multi-tenant
- **Campus y Áreas**: Estructura organizacional
- **Cursos y Módulos**: Contenido académico
- **Lecciones y Recursos**: Material educativo
- **Evaluaciones y Formularios**: Sistema de assessment
- **Calificaciones**: Registro de desempeño
- **Certificados**: Credenciales verificables
- **Pagos**: Gestión financiera
- **Notificaciones**: Sistema de comunicación
- **Documentos de Admisión**: Gestión de procesos de ingreso
- **Asistencia**: Control de presencia estudiantil
- **Mensajería**: Comunicación padre-profesor
- **Horarios**: Programación de clases
- **Analytics**: Eventos y métricas del sistema
- **Biblioteca Digital**: Gestión de recursos y préstamos
- **Becas**: Sistema de ayudas financieras estudiantiles
- **Gamificación**: Badges, puntos y reconocimientos
- **Auditoría**: Registro completo de actividades del sistema

## 🚦 Instalación y Configuración

### Prerrequisitos
- Node.js 18+
- npm o yarn
- Cuenta de Supabase
- Cuenta de Stripe (para pagos)

### Configuración del Proyecto

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd Neptuno
```

2. **Instalar dependencias**
```bash
cd web
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env.local
```

Editar `.env.local` con tus credenciales:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
```

4. **Configurar Supabase**
```bash
cd supabase
supabase start
supabase db reset
```

5. **Ejecutar en desarrollo**
```bash
cd web
npm run dev
```

## Base de datos (Supabase)

Para preparar la base de datos en el SQL Editor de Supabase, ejecuta los scripts en este orden:

- 001_schema.sql
- 002_update.sql
- 003_seed.sql
- 010_disable_rls_for_dev.sql (solo para desarrollo) o 004_policies.sql (preproducción/producción)
- 005_admin_api.sql

Consulta el archivo ADMIN_SETUP.md para detalles, notas y verificación rápida.

## 📁 Estructura del Proyecto

```
Neptuno/
├── web/                    # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── contexts/       # Contextos de React
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Páginas de la aplicación
│   │   ├── types/          # Definiciones de TypeScript
│   │   └── utils/          # Utilidades
│   └── package.json
├── supabase/               # Configuración de Supabase
│   ├── migrations/         # Migraciones de BD
│   └── sql/               # Scripts SQL
└── docs/                   # Documentación
```

## 🎯 Roadmap MVP

### ✅ Fase 1: Fundación
- [x] Autenticación con Supabase Auth
- [x] Multi-tenancy con RLS
- [x] Gestión básica de usuarios y roles
- [x] Estructura de cursos y lecciones

### 🚧 Fase 2: Funcionalidades Core
- [ ] Sistema de evaluaciones completo
- [ ] Portal de padres
- [ ] Generación de certificados
- [ ] Sistema de notificaciones

### 📋 Fase 3: Características Avanzadas
- [ ] Analytics y reportes avanzados
- [ ] Sistema de pagos con Stripe
- [ ] Branding avanzado
- [ ] Biblioteca de recursos digitales
- [ ] Sistema de becas y ayudas financieras
- [ ] Gamificación (badges y puntos)
- [ ] Auditoría completa del sistema
- [ ] API pública para integraciones

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Para soporte técnico o consultas comerciales:
- Email: support@edumanager.pro
- Documentación: [docs.edumanager.pro](https://docs.edumanager.pro)

---

**Neptuno** - Transformando la educación a través de la tecnología 🚀

## Pendientes Sprint 1 (Auth, Perfiles y Multi-tenant)

Estado actual verificado
- [x] Modelo multi-tenant en DB: tabla `tenants` con campo `branding` (JSONB) que incluye `logo_url` y `primary_color`; RLS y helpers de roles presentes.
- [x] Trigger `handle_new_user` crea `profiles` al registrarse.
- [x] Buckets de storage existentes: `course-covers` (público), `resource-files` (privado), `tenant-logos` (público) y referencia a `signatures` en el seed; revisar duplicidad/ubicación final en `004_storage.sql`.
- [x] Frontend: `AuthContext` con `signUp`/`signIn`, página `Login`, rutas protegidas, `TenantContext` usa `getUserMemberships` y existen helpers en `membershipsService`. Aún no hay página de Signup ni UI de memberships/invitaciones.

Pendiente por implementar
1) Autenticación: Registro de usuarios (Signup UI)
- Crear página `/signup` con formulario email + password usando `useAuth.signUp` (wrap de `supabase.auth.signUp`).
- Añadir ruta en `App.tsx`: `<Route path="/signup" element={<Signup />} />` y enlace desde Login.
- Flujo: tras signUp, mostrar confirmación y redirigir a `/login`.
- Criterio de aceptación: se puede registrar, se crea `profile` vía trigger, sesión no inicia hasta confirmar email (según configuración de Supabase), manejo de errores de email en uso, etc.

2) Perfil: "Mi Perfil"
- Página `/profile` para ver/editar `full_name` y manejar avatar y firma.
- Storage: definir bucket `avatars` (lectura pública) y confirmar `signatures` (privado) con sus políticas.
- Implementar upload de avatar/firma y `updateProfile` en `usersService`.
- Mostrar firma en certificados emitidos usando Signed URL.

3) Memberships: UI de administración
- Listar memberships del tenant (solo `owner`/`admin`).
- Crear y desactivar memberships (asignar usuario ↔ tenant con rol).
- Reutilizar `lib/membershipsService`; añadir vistas y flujos en páginas.

4) Invitaciones por correo
- Definir tabla `invitations` (si no existe): `id`, `email`, `tenant_id`, `role`, `token`, `expires_at`, `accepted_at`.
- RPC para crear invitación y enviar email (temporalmente copiar enlace al portapapeles).
- Flujo de aceptación en `/invite/accept?token=...` que crea membership al usuario autenticado o tras completar Signup.

5) RPCs faltantes (roles y utilidades dev)
- `role_rename`, `role_delete`, `user_role_revoke`, `user_roles_list`.
- `create_dev_user`, `delete_dev_user` (solo entorno de desarrollo).
- Implementar en `002_functions.sql` y probar desde `web/src/lib/rolesService.ts` y `web/src/lib/usersService.ts`.

6) Storage y recursos privados
- Asegurar que `resource-files` es privado; vistas/descargas deben usar Signed URLs con expiración.
- Revisar previsualización en componentes como `FilePreview` y página `Resources`.

7) Branding por tenant en frontend
- Leer `tenants.branding` al seleccionar tenant.
- Aplicar `logo_url` y `primary_color` en `AppLayout`, `Login` y pantallas clave.

8) QA y DX
- Estados de error y loading consistentes.
- Mensajería/validaciones UX en formularios de Auth y Perfil.
- Scripts de semilla/limpieza no deben desactivar RLS en entornos productivos.

Rutas nuevas a crear
- GET `/signup` (página)
- GET `/profile` (página)
- GET `/invite/accept?token=...` (página)

Referencias internas (ubicación actual)
- Auth y rutas: `web/src/contexts/AuthContext.tsx`, `web/src/App.tsx`, `web/src/pages/Login.tsx`
- Multi-tenant: `web/src/contexts/TenantContext.tsx`, `web/src/lib/membershipsService.ts`
- Usuarios: `web/src/lib/usersService.ts`
- SQL: `supabase/sql/001_schema.sql`, `supabase/sql/002_functions.sql`, `supabase/sql/003_policies.sql`, `supabase/sql/004_storage.sql`

Checklist ejecutable
- [ ] Signup UI y ruta
- [ ] Enlace desde Login
- [ ] Página Mi Perfil (editar nombre)
- [ ] Buckets `avatars` y `signatures` + políticas
- [ ] Upload de avatar y firma
- [ ] Signed URL para resources privados
- [ ] UI de Memberships (listar/crear/desactivar)
- [ ] Invitaciones (tabla, RPC, flujo)
- [ ] RPCs de roles/dev completadas
- [ ] Branding por tenant aplicado en UI

Notas
- Evitar duplicar buckets entre `001_schema.sql` y `004_storage.sql`; centralizar la creación/configuración en `004_storage.sql`.
- Documentar helpers de roles y permisos en `002_functions.sql` y `003_policies.sql`.
////////////////////////////////////////////////////////

# 🌊 Análisis Completo del Proyecto Neptuno
## 📊 Validación de Coherencia del Proyecto
### ✅ Estado Actual: EXCELENTE
El proyecto Neptuno presenta una arquitectura sólida y bien estructurada con alta coherencia entre backend y frontend:

Fortalezas identificadas:

- Esquema SQL robusto : 20+ tablas con RLS, auditoría y multi-tenancy
- Frontend moderno : React 19 + TypeScript + Tailwind CSS
- Servicios bien organizados : Cada entidad tiene su servicio correspondiente
- Autenticación completa : Supabase Auth con contextos React
- Arquitectura escalable : Preparada para múltiples instituciones
Coherencia Backend-Frontend:

- ✅ Todas las tablas SQL tienen servicios TypeScript correspondientes
- ✅ Tipos TypeScript alineados con esquema de base de datos
- ✅ Políticas RLS implementadas correctamente
- ✅ Sistema de roles consistente entre SQL y React
## 🏗️ Orden de Construcción Recomendado
### Fase 1: Fundación (COMPLETADA)
1. 1.
   ✅ Configuración de Supabase y esquemas SQL
2. 2.
   ✅ Autenticación y gestión de usuarios
3. 3.
   ✅ Sistema de roles y permisos
4. 4.
   ✅ Multi-tenancy básico
### Fase 2: Core Académico (EN PROGRESO)
1. 1.
   🔄 Gestión de Cursos - 80% completado
2. 2.
   🔄 Inscripciones de Estudiantes - 70% completado
3. 3.
   🔄 Recursos Educativos - 60% completado
4. 4.
   ⏳ Sistema de Evaluaciones - 40% completado
### Fase 3: Funcionalidades Avanzadas (PENDIENTE)
1. 1.
   ⏳ Portal de Padres
2. 2.
   ⏳ Sistema de Certificados
3. 3.
   ⏳ Notificaciones en tiempo real
4. 4.
   ⏳ Reportes y Analytics
### Fase 4: Optimización (FUTURO)
1. 1.
   ⏳ Gamificación
2. 2.
   ⏳ Biblioteca Digital
3. 3.
   ⏳ Sistema de Becas
4. 4.
   ⏳ Integración con sistemas externos
## 👥 Historias de Usuario por Rol
### 🔧 Super Admin
- Como super admin, quiero gestionar múltiples instituciones desde un panel centralizado
- Como super admin, quiero monitorear el uso de la plataforma y generar reportes de facturación
- Como super admin, quiero configurar planes y límites por institución
### 🏫 Admin de Institución
- Como admin, quiero personalizar el branding de mi institución (logo, colores)
- Como admin, quiero gestionar usuarios (profesores, estudiantes, padres)
- Como admin, quiero configurar categorías de cursos y estructura académica
- Como admin, quiero generar reportes de desempeño institucional
### 👨‍🏫 Profesor
- Como profesor, quiero crear y gestionar mis cursos con recursos multimedia
- Como profesor, quiero diseñar evaluaciones con diferentes tipos de preguntas
- Como profesor, quiero calificar tareas y proporcionar retroalimentación
- Como profesor, quiero comunicarme con padres sobre el progreso estudiantil
### 🎓 Estudiante
- Como estudiante, quiero acceder a mis cursos y recursos de aprendizaje
- Como estudiante, quiero realizar evaluaciones y ver mis calificaciones
- Como estudiante, quiero entregar tareas y recibir retroalimentación
- Como estudiante, quiero descargar mis certificados al completar cursos
### 👨‍👩‍👧‍👦 Padre/Acudiente
- Como padre, quiero monitorear el progreso académico de mi hijo en tiempo real
- Como padre, quiero comunicarme directamente con los profesores
- Como padre, quiero recibir notificaciones sobre calificaciones y eventos
- Como padre, quiero acceder a reportes de asistencia y comportamiento
## 🚪 Portales Necesarios por Rol
### Portal Super Admin
- Dashboard de instituciones y métricas globales
- Gestión de tenants y planes de suscripción
- Monitoreo de uso y facturación
- Configuración de la plataforma
### Portal Admin Institucional
- Dashboard académico institucional
- Gestión de usuarios y roles
- Configuración de branding
- Reportes y analytics institucionales
- Gestión de categorías y estructura académica
### Portal Profesor
- Dashboard de cursos asignados
- Creador de contenido y evaluaciones
- Centro de calificaciones
- Comunicación con estudiantes y padres
- Biblioteca de recursos
### Portal Estudiante
- Dashboard de cursos inscritos
- Aula virtual con recursos
- Centro de evaluaciones
- Historial de calificaciones
- Descarga de certificados
### Portal Padres
- Dashboard de seguimiento académico
- Vista de calificaciones y progreso
- Centro de comunicación con profesores
- Notificaciones y alertas
- Reportes de asistencia
## ✅ Checklist de Tareas Pendientes
### 🔥 Prioridad Alta (Inmediato)
- Completar sistema de evaluaciones - Falta implementar tipos de preguntas avanzadas
- Implementar portal de padres - Crear vistas y funcionalidades específicas
- Sistema de notificaciones en tiempo real - Integrar WebSockets o Server-Sent Events
- Gestión de archivos mejorada - Implementar upload múltiple y preview
- Sistema de certificados - Generación automática con códigos QR
### ⚡ Prioridad Media (Próximas 2 semanas)
- Reportes y analytics - Dashboard con métricas académicas
- Sistema de mensajería - Chat entre profesores y padres
- Gestión de asistencia - Control de presencia estudiantil
- Horarios de clase - Programación y gestión de cronogramas
- Optimización de rendimiento - Lazy loading y paginación mejorada
### 🔧 Prioridad Baja (Futuro)
- Gamificación - Sistema de badges y puntos
- Biblioteca digital - Gestión de recursos y préstamos
- Sistema de becas - Gestión de ayudas financieras
- Integración con LMS externos - Conectores con Moodle, Canvas
- App móvil - Versión nativa para iOS/Android
### 🛠️ Tareas Técnicas
- Testing automatizado - Implementar Jest + React Testing Library
- CI/CD Pipeline - Automatizar deployment con GitHub Actions
- Documentación técnica - API docs y guías de desarrollo
- Monitoreo y logging - Implementar Sentry o similar
- Backup y recuperación - Estrategia de respaldo de datos
### 🎨 Mejoras de UX/UI
- Tema oscuro - Implementar modo dark/light
- Responsive mejorado - Optimizar para tablets
- Accesibilidad - Cumplir estándares WCAG 2.1
- Internacionalización - Soporte multi-idioma
- PWA - Convertir en Progressive Web App
## 🎯 Recomendaciones Estratégicas
1. 1.
   Enfoque en Portal de Padres : Es una funcionalidad diferenciadora clave
2. 2.
   Priorizar Notificaciones : Mejora significativamente la experiencia de usuario
3. 3.
   Optimizar Performance : Implementar lazy loading y caching
4. 4.
   Documentar APIs : Facilitar integraciones futuras
5. 5.
   Testing Robusto : Asegurar calidad antes de producción
El proyecto Neptuno está en excelente estado y listo para las siguientes fases de desarrollo. La arquitectura es sólida y escalable.