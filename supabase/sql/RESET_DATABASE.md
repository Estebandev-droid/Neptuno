# Reset Completo de Base de Datos - Neptuno

⚠️ **ADVERTENCIA**: Este proceso eliminará TODOS los datos existentes en la base de datos.

## Proceso de Reset Completo

### 1. Limpieza de la Base de Datos

Ejecuta el script de limpieza en el SQL Editor de Supabase:

```sql
-- Ejecutar: 000_cleanup_database.sql
```

Este script eliminará:
- Todas las tablas del dominio de inventario
- Todas las tablas del dominio de órdenes  
- Tablas del esquema base (tenants, memberships, etc.)
- Funciones personalizadas
- Tipos personalizados
- El esquema completo `app`

### 2. Reconstrucción en Orden

Ejecuta los siguientes scripts **EN ESTE ORDEN EXACTO**:

#### Paso 1: Esquema Base
```sql
-- 1. Ejecutar: 001_schema_base.sql
-- Crea el esquema app, tipos, tablas base (tenants, memberships, etc.)
```

#### Paso 2: Funciones
```sql
-- 2. Ejecutar: 010_functions.sql
-- Funciones auxiliares para RLS y lógica de negocio
```

#### Paso 3: Políticas RLS Base
```sql
-- 3. Ejecutar: 020_rls_policies.sql
-- Políticas de seguridad a nivel de fila generales
```

#### Paso 4: Políticas RLS Super Admins
```sql
-- 4. Ejecutar: 021_rls_super_admins.sql
-- Políticas especiales para usuarios super admin
```

#### Paso 5: Triggers de Auditoría
```sql
-- 5. Ejecutar: 030_triggers_audit.sql
-- Sistema de auditoría automática
```

#### Paso 6: Usuario Super Admin
```sql
-- 6. Ejecutar: 040_seed_super_admin.sql
-- ✅ YA CONFIGURADO: esteban@gmail.com (UID: 20ca37f3-8310-4a63-ae8c-9d09cc759079)
```

#### Paso 7: Dominio de Inventario
```sql
-- 7. Ejecutar: 100_domain_inventory.sql
-- Tablas: categories, suppliers, inventory_items, etc.
```

#### Paso 8: Dominio de Almacenes
```sql
-- 8. Ejecutar: 110_domain_warehouses.sql
-- Tablas: warehouses, inventory_movements
```

#### Paso 9: Dominio de Órdenes
```sql
-- 9. Ejecutar: 120_domain_orders.sql
-- Tablas: customers, orders, order_items
```

#### Paso 10: RLS para Dominios
```sql
-- 10. Ejecutar: 121_rls_domain.sql
-- Políticas RLS específicas para los dominios de negocio
```

#### Paso 11: Triggers para Dominios
```sql
-- 11. Ejecutar: 130_triggers_domain.sql
-- Triggers de auditoría para las tablas de dominio
```

### 3. Verificación Post-Reset

Después de ejecutar todos los scripts, verifica que todo esté funcionando:

```sql
-- Verificar que el esquema se creó correctamente
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'app';

-- Verificar que las tablas principales existen
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'app' 
ORDER BY table_name;

-- Verificar que el super admin está configurado
SELECT * FROM app.app_super_admins;

-- Verificar función de super admin
SELECT app.is_super_admin('20ca37f3-8310-4a63-ae8c-9d09cc759079'::uuid);

-- Verificar que las políticas RLS están activas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'app'
ORDER BY tablename, policyname;
```

### 4. Configuración del Frontend

Después del reset de la base de datos:

1. **Reinicia el servidor de desarrollo** si está corriendo:
   ```bash
   # En la terminal del proyecto web
   Ctrl+C  # Detener el servidor
   npm run dev  # Reiniciar
   ```

2. **Verifica la conexión** accediendo a:
   - http://localhost:5174/
   - Inicia sesión con: `esteban@gmail.com`
   - Navega a: Catálogo → Categorías

### 5. Cuenta Super Admin Configurada

✅ **La cuenta ya está configurada en el seed:**
- **Email**: `esteban@gmail.com`
- **UID**: `20ca37f3-8310-4a63-ae8c-9d09cc759079`
- **Permisos**: Acceso completo a todos los tenants y funcionalidades

### Notas Importantes

- ⚠️ Este proceso es **IRREVERSIBLE** - todos los datos se perderán
- 🔄 Ejecuta los scripts en el orden exacto especificado
- ✅ El usuario super admin ya está preconfigurado
- 🚀 Después del reset, la aplicación estará lista para usar
- 📝 Todos los logs de auditoría se reiniciarán

### Solución de Problemas

Si encuentras errores:

1. **Error de dependencias**: Asegúrate de ejecutar los scripts en orden
2. **Error de permisos**: Verifica que estés ejecutando como propietario de la base de datos
3. **Error de RLS**: Confirma que las funciones se crearon antes que las políticas
4. **Frontend no conecta**: Reinicia el servidor de desarrollo y verifica las variables de entorno