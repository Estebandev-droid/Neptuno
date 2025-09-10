import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline'
import type React from 'react'

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
          ? 'justify-center px-3 py-4 mx-2' 
          : 'gap-3 px-4 py-3 mx-3'
      } rounded-xl text-sm font-semibold ${
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
            collapsed ? 'h-6 w-6' : 'h-5 w-5'
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
      <h3 className="px-4 text-xs font-semibold text-secondary uppercase tracking-wider">
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
  
  return (
    <aside 
      className={`${basePos} ${collapsed ? 'w-24' : 'w-72'} glass-sidebar transition-[width] duration-300 ease-in-out ${className}`}
    >
      {/* Header */}
      <div className="h-[73px] flex items-center px-4 relative glass-header">
        <div className={`flex items-center gap-2 ${collapsed ? 'justify-center w-full' : ''}`}>
          {/* Botón a la izquierda del ícono */}
          {!collapsed && (
            <button
              type="button"
              aria-label="Colapsar sidebar"
              onClick={() => onToggle?.()}
              className="hidden md:inline-flex items-center justify-center rounded-lg p-2 text-dark/70 hover:bg-dark/20 hover:text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark transition-all duration-200"
              title="Colapsar"
            >
              <ChevronDoubleLeftIcon className="h-5 w-5" />
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              aria-label="Expandir sidebar"
              onClick={() => onToggle?.()}
              className="hidden md:inline-flex items-center justify-center rounded-lg p-1.5 text-light/70 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200"
              title="Expandir"
            >
              <ChevronDoubleRightIcon className="h-4 w-4" />
            </button>
          )}
          <div className="h-10 w-10 rounded-xl glass-card border-2 border-primary/30 flex items-center justify-center glow-effect">
            <span className="text-primary font-bold text-lg select-none">
              N
            </span>
          </div>
          {!collapsed && (
            <span className="font-bold text-dark text-xl tracking-tight select-none">
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
        } space-y-1 overflow-y-auto h-[calc(100%-73px)] scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-dark`}
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
        </div>


      </nav>
    </aside>
  )
}