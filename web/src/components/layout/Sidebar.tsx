import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  RectangleGroupIcon,
  TagIcon,
  PhotoIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  ArrowsRightLeftIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  UsersIcon,
  BuildingOfficeIcon,
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
      `group flex items-center transition-all duration-200 ${
        collapsed 
          ? 'justify-center px-3 py-4 mx-2' 
          : 'gap-3 px-4 py-3 mx-3'
      } rounded-xl text-sm font-medium ${
        isActive 
          ? 'text-black border-l-4 border-gray-800' 
          : 'text-gray-700 hover:text-black hover:bg-gray-50 hover:shadow-sm'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2`
    }
  >
    {({ isActive }) => (
      <>
        <Icon 
          className={`${
            collapsed ? 'h-6 w-6' : 'h-5 w-5'
          } flex-shrink-0 transition-all duration-200 ${
            isActive 
              ? 'text-black' 
              : 'text-gray-600 group-hover:text-black'
          }`} 
        />
        {!collapsed && (
          <span className="truncate transition-colors duration-200 font-medium">
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
      <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
      className={`${
        basePos
      } ${
        collapsed ? 'w-20' : 'w-72'
      } border-r border-gray-200 bg-white shadow-xl transition-[width] duration-300 ease-in-out ${className}`}
    >
      {/* Header */}
      <div className={`
        h-16 flex items-center border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white
        ${collapsed ? 'justify-center px-4' : 'justify-between px-6'}
      `}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg select-none">
              N
            </span>
          </div>
          {!collapsed && (
            <span className="font-bold text-black text-xl tracking-tight select-none">
              Neptuno
            </span>
          )}
        </div>
        
        {/* Toggle Button - Only show when not collapsed */}
        {!collapsed && (
          <button
            type="button"
            aria-label="Colapsar sidebar"
            onClick={() => onToggle?.()}
            className="hidden md:inline-flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 transition-all duration-200"
            title="Colapsar"
          >
            <ChevronDoubleLeftIcon className="h-5 w-5" />
          </button>
        )}
        
        {/* Expand Button - Only show when collapsed */}
        {collapsed && (
          <button
            type="button"
            aria-label="Expandir sidebar"
            onClick={() => onToggle?.()}
            className="hidden md:inline-flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 transition-all duration-200 absolute top-4 right-2"
            title="Expandir"
          >
            <ChevronDoubleRightIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav 
        className={`${
          collapsed ? 'p-2' : 'p-6'
        } space-y-1 overflow-y-auto h-[calc(100%-4rem)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}
        onClick={() => onNavigate?.()}
      >
        {/* Panel Principal */}
        <SectionTitle title="Panel Principal" collapsed={collapsed} />
        <div className="space-y-1">
          <NavItem 
            to="/app/dev/dashboard" 
            label="Inicio" 
            icon={HomeIcon} 
            collapsed={collapsed} 
          />
        </div>

        {/* Catálogo */}
        <SectionTitle title="Catálogo" collapsed={collapsed} />
        <div className="space-y-1">
          <NavItem 
            to="/app/catalog/categories" 
            label="Categorías" 
            icon={RectangleGroupIcon} 
            collapsed={collapsed} 
          />
          <NavItem 
            to="#" 
            label="Productos" 
            icon={TagIcon} 
            collapsed={collapsed} 
          />
          <NavItem 
            to="#" 
            label="Imágenes" 
            icon={PhotoIcon} 
            collapsed={collapsed} 
          />
        </div>

        {/* Operaciones */}
        <SectionTitle title="Operaciones" collapsed={collapsed} />
        <div className="space-y-1">
          <NavItem 
            to="#" 
            label="Órdenes de Compra" 
            icon={ClipboardDocumentListIcon} 
            collapsed={collapsed} 
          />
          <NavItem 
            to="#" 
            label="Compras" 
            icon={ShoppingCartIcon} 
            collapsed={collapsed} 
          />
        </div>

        {/* Almacén */}
        <SectionTitle title="Almacén" collapsed={collapsed} />
        <div className="space-y-1">
          <NavItem 
            to="#" 
            label="Movimientos" 
            icon={ArrowsRightLeftIcon} 
            collapsed={collapsed} 
          />
          <NavItem 
            to="#" 
            label="Inventario" 
            icon={CubeIcon} 
            collapsed={collapsed} 
          />
          <NavItem 
            to="#" 
            label="Almacenes" 
            icon={BuildingStorefrontIcon} 
            collapsed={collapsed} 
          />
        </div>

        {/* Maestros */}
        <SectionTitle title="Maestros" collapsed={collapsed} />
        <div className="space-y-1">
          <NavItem 
            to="#" 
            label="Proveedores" 
            icon={BuildingOfficeIcon} 
            collapsed={collapsed} 
          />
          <NavItem 
            to="#" 
            label="Clientes" 
            icon={UsersIcon} 
            collapsed={collapsed} 
          />
        </div>
      </nav>
    </aside>
  )
}