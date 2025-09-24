import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  UsersIcon,
  ShieldCheckIcon,
  TagIcon,
  BookOpenIcon,
  UserPlusIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  FolderIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  BellIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  UserIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import type React from 'react'
import { useTenant } from '../../hooks/useTenant'

interface SidebarProps {
  className?: string
  onNavigate?: () => void
  collapsed?: boolean
  onToggle?: () => void
  position?: 'fixed' | 'relative'
}

interface NavItemProps {
  to: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  collapsed?: boolean
}

const NavItem = ({ to, label, icon: Icon, collapsed }: NavItemProps) => (
  <NavLink
    to={to}
    title={collapsed ? label : undefined}
    className={({ isActive }) =>
      `group flex items-center transition-all duration-300 ${
        collapsed 
          ? 'justify-center px-2 sm:px-3 py-3 sm:py-4 mx-1 sm:mx-2' 
          : 'gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 mx-2 sm:mx-3'
      } rounded-xl text-xs sm:text-sm font-semibold ${
        isActive 
          ? 'text-primary glass-nav-item active border-l-4 border-primary' 
          : 'text-light/70 hover:text-primary glass-nav-item'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
    }
  >
    {({ isActive }) => (
      <>
        <Icon 
          className={`${
            collapsed ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4 sm:h-5 sm:w-5'
          } flex-shrink-0 transition-all duration-300 ${
            isActive 
              ? 'text-primary' 
              : 'text-light/60 group-hover:text-primary'
          }`} 
        />
        {!collapsed && (
          <span className="truncate transition-colors duration-300 font-semibold">
            {label}
          </span>
        )}
      </>
    )}
  </NavLink>
)

const SectionTitle = ({ title, collapsed }: { title: string; collapsed?: boolean }) => {
  if (collapsed) return null
  
  return (
    <div className="mt-8 mb-3 first:mt-0">
      <h3 className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-light/60 uppercase tracking-wider">
        {title}
      </h3>
    </div>
  )
}

export default function Sidebar({ 
  className = '', 
  onNavigate, 
  collapsed = false, 
  onToggle, 
  position = 'fixed' 
}: SidebarProps) {
  const basePos = position === 'fixed' ? 'fixed left-0 top-0 h-full z-50' : 'h-full'
  const { selectedTenant } = useTenant()
  const role = selectedTenant?.role
  const isOwnerAdmin = role === 'owner' || role === 'admin'
  const isTeacher = role === 'teacher'
  const isStudent = role === 'student'

  return (
    <aside 
      className={`${basePos} ${collapsed ? 'w-20 sm:w-24' : 'w-64 sm:w-72'} glass-sidebar transition-[width] duration-300 ease-in-out ${className}`}
    >
      {/* Header */}
      <div className="h-[73px] flex items-center px-2 sm:px-4 relative glass-header">
        <div className={`flex items-center gap-1 sm:gap-2 ${collapsed ? 'justify-center w-full' : ''}`}>
          {/* Botón a la izquierda del ícono */}
          {!collapsed && (
            <button
              type="button"
              aria-label="Colapsar sidebar"
              onClick={() => onToggle?.()}
              className="hidden md:inline-flex items-center justify-center rounded-lg p-1.5 sm:p-2 text-dark/70 hover:bg-dark/20 hover:text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark transition-all duration-200"
              title="Colapsar"
            >
              <ChevronDoubleLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              aria-label="Expandir sidebar"
              onClick={() => onToggle?.()}
              className="hidden md:inline-flex items-center justify-center rounded-lg p-1 sm:p-1.5 text-light/70 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200"
              title="Expandir"
            >
              <ChevronDoubleRightIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
          )}
          <img 
            src="/logo.webp" 
            alt="Neptuno Logo" 
            className="h-12 w-12 sm:h-14 sm:w-14 object-contain drop-shadow-lg glow-effect"
          />
          {!collapsed && (
            <span className="font-bold text-dark text-lg sm:text-xl tracking-tight select-none">
              Neptuno
            </span>
          )}
        </div>
        
        {/* Toggle Button - Only show when not collapsed */}
        {/* eliminado: botón a la derecha */}
        
        {/* Expand Button - Only show when collapsed */}
        {/* eliminado: botón absoluto a la derecha */}
      </div>

      {/* Navigation */}
      <nav 
        className={`${
          collapsed ? 'p-2' : 'p-6'
        } space-y-1 overflow-y-auto h-[calc(100%-73px)] scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-dark ${collapsed ? '' : 'scrollbar-styled'}`}
        onClick={() => onNavigate?.()}
      >
        {/* Panel Principal */}
        <SectionTitle title="Panel Principal" collapsed={collapsed} />
        <div className="space-y-1">
          <NavItem 
            to="/dashboard" 
            label="Inicio" 
            icon={HomeIcon} 
            collapsed={collapsed} 
          />
          {isOwnerAdmin && (
            <>
              <NavItem 
                to="/users" 
                label="Usuarios" 
                icon={UsersIcon} 
                collapsed={collapsed} 
              />
              <NavItem 
                to="/roles" 
                label="Roles" 
                icon={ShieldCheckIcon} 
                collapsed={collapsed} 
              />
              <NavItem 
                to="/categories" 
                label="Categorías" 
                icon={TagIcon} 
                collapsed={collapsed} 
              />
            </>
          )}
          {(isOwnerAdmin || isTeacher) && (
            <NavItem 
              to="/courses" 
              label="Cursos" 
              icon={BookOpenIcon} 
              collapsed={collapsed} 
            />
          )}
          {(isOwnerAdmin || isTeacher) && (
            <NavItem 
              to="/resources" 
              label="Recursos" 
              icon={FolderIcon} 
              collapsed={collapsed} 
            />
          )}
          {(isOwnerAdmin || isTeacher) && (
            <NavItem 
              to="/tasks" 
              label="Tareas" 
              icon={ClipboardDocumentListIcon} 
              collapsed={collapsed} 
            />
          )}
          {(isOwnerAdmin || isTeacher) && (
            <NavItem 
              to="/evaluations" 
              label="Evaluaciones" 
              icon={ClipboardDocumentCheckIcon} 
              collapsed={collapsed} 
            />
          )}
          {isStudent && (
            <NavItem 
              to="/submissions" 
              label="Entregas y Calificaciones" 
              icon={DocumentTextIcon} 
              collapsed={collapsed} 
            />
          )}
          {isStudent && (
            <NavItem 
              to="/enrollments" 
              label="Inscripciones" 
              icon={UserPlusIcon} 
              collapsed={collapsed} 
            />
          )}
          {isOwnerAdmin && (
            <>
              <NavItem 
                to="/admin/enrollments" 
                label="Admin Inscripciones" 
                icon={UsersIcon} 
                collapsed={collapsed} 
              />
              <NavItem 
                to="/admin/enrollment-reports" 
                label="Reportes Inscripciones" 
                icon={ChartBarIcon} 
                collapsed={collapsed} 
              />
            </>
          )}
          <NavItem 
            to="/profile" 
            label="Mi Perfil" 
            icon={UserIcon} 
            collapsed={collapsed} 
          />
        </div>

        {/* Gestión Multi-Tenant */}
        {(isOwnerAdmin) && (
          <>
            <SectionTitle title="Gestión Multi-Tenant" collapsed={collapsed} />
            <div className="space-y-1">
              <NavItem 
                to="/tenants" 
                label="Tenants" 
                icon={BuildingOfficeIcon} 
                collapsed={collapsed} 
              />
              <NavItem 
                to="/memberships" 
                label="Membresías" 
                icon={UsersIcon} 
                collapsed={collapsed} 
              />
              <NavItem 
                to="/relationships" 
                label="Relaciones Padre-Estudiante" 
                icon={UserGroupIcon} 
                collapsed={collapsed} 
              />
            </div>
          </>
        )}

        {/* Comunicación y Certificación */}
        <SectionTitle title="Comunicación y Certificación" collapsed={collapsed} />
        <div className="space-y-1">
          {isOwnerAdmin && (
            <NavItem 
              to="/notifications" 
              label="Notificaciones" 
              icon={BellIcon} 
              collapsed={collapsed} 
            />
          )}
          {isStudent && (
            <NavItem 
              to="/certificates" 
              label="Certificados" 
              icon={AcademicCapIcon} 
              collapsed={collapsed} 
            />
          )}
        </div>

      </nav>
    </aside>
  )
}