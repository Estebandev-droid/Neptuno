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