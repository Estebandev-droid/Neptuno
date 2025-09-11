# Configuración de Base de Datos - Neptuno

## Orden recomendado de ejecución (Supabase SQL Editor)

Opción A: Desarrollo rápido (sin RLS, acceso libre)

1. 001_schema.sql  → crea tablas y relaciones básicas
2. 002_update.sql  → agrega triggers y auditoría
3. 003_seed.sql    → inserta datos iniciales (roles, tenant demo, curso demo)
4. 010_disable_rls_for_dev.sql → deshabilita RLS y limpia políticas para desarrollo
5. 005_admin_api.sql → crea funciones RPC usadas por el frontend durante DEV

Opción B: Entorno con seguridad (preproducción/producción)

1. 001_schema.sql
2. 002_update.sql
3. 003_seed.sql (opcional o mínimo)
4. 004_policies.sql → habilita RLS y crea políticas
5. 005_admin_api.sql → crear o adaptar con validaciones de permisos por rol

Notas

- 005_admin_api.sql ya incluye las RPC que usa el frontend: role_create, role_rename, role_delete, user_role_assign, user_role_revoke, user_roles_list, create_dev_user, delete_dev_user.
- En DEV, las RPC no validan permisos estrictos. En PROD, debes agregar verificaciones con is_platform_admin() y/o has_role().
- 003_seed.sql es idempotente y solo crea un tenant demo (demo.neptuno.edu), una categoría "General" y un curso "Curso de Bienvenida".

Verificación rápida

- SELECT * FROM public.roles;
- SELECT * FROM public.tenants;
- SELECT public.is_platform_admin();
- SELECT * FROM public.user_roles WHERE user_id = auth.uid();

Si algo falla, ejecuta los scripts nuevamente en el orden indicado o revisa que las funciones/grants existan.