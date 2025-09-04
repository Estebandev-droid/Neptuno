# Tech Stack — MVP Neptuno (SaaS Inventarios)

Versión: 0.1 — Workspace sin VCS

## Frontend
- React 18 + Vite 5 (npm) — PWA.
- TypeScript 5.
- Router: React Router 6.26.
- State/Data: TanStack Query 5.
- Formularios: react-hook-form 7 + Zod 3.
- i18n: i18next + react-i18next.
- UI: Tailwind CSS (ver sección Tailwind). Iconos: Lucide React.
- Utilidades: date-fns, clsx, ky (HTTP) o fetch con envoltura.

## Backend (BaaS)
- Supabase: Auth, Postgres 15/16, Storage, Edge Functions (Deno 1.39+).
- RLS en Postgres para multi‑tenant. SQL + Policies, Triggers para audit y PEPS.

## Infra y despliegue
- Hosting estático (CDN) para frontend (Supabase/Netlify/Vercel Static). Cache SW.
- Supabase Cloud para DB/Auth/Storage/Edge.

## Testing y calidad
- Vitest + Testing Library para UI. Playwright para e2e básico.
- ESLint (typescript-eslint), Prettier. Husky + lint-staged (opcional).

## Observabilidad
- Sentry (frontend) y logs de Edge Functions. Métricas básicas de uso.

## Política de versiones
- SemVer para app y Edge Functions. Dependencias minor/patch automáticas con Renovate.

## Dependencias recomendadas (npm)
- react, react-dom, react-router-dom, @tanstack/react-query, react-hook-form, zod, @hookform/resolvers, i18next, react-i18next, tailwindcss, postcss, autoprefixer, lucide-react, date-fns, clsx, ky, supabase-js, workbox-build (opcional PWA) o vite-plugin-pwa.

## Tailwind
- Preferencia: confirmar v4 (CSS-first) vs v3 clásica. Si v4: configuración minimalista con tokens CSS. Si v3: instalar tailwindcss@latest postcss autoprefixer y configurar Vite. Se documentará en dev/tailwind-setup.md cuando se confirme.