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

interface SidebarProps {
  className?: string
  onNavigate?: () => void
  collapsed?: boolean
  onToggle?: () => void
  position?: 'fixed' | 'static'
}

const NavItem = (
  to: string,
  label: string,
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>,
  collapsed?: boolean,
) => (
  <NavLink
    to={to}
    title={label}
    className={({ isActive }) =>
      `group flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} rounded-lg py-3 text-sm font-medium transition-all duration-200 ` +
      `${isActive 
        ? 'text-white bg-gradient-to-r from-brand-600 to-brand-700 shadow-md' 
        : 'text-gray-700 hover:text-brand-700 hover:bg-brand-50/80 hover:shadow-sm'
      } ` +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1'
    }
  >
    {({ isActive }) => (
      <>
        <Icon className={`h-5 w-5 flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-white' : collapsed ? 'text-gray-600' : 'group-hover:text-brand-600'}`} />
        {!collapsed && <span className="truncate transition-colors duration-200">{label}</span>}
      </>
    )}
  </NavLink>
)

export default function Sidebar({ className = '', onNavigate, collapsed = false, onToggle, position = 'fixed' }: SidebarProps) {
  const basePos = position === 'fixed' ? 'fixed left-0 top-0 h-full' : 'h-full'
  return (
    <aside className={`${basePos} ${collapsed ? 'w-16' : 'w-64'} border-r border-gray-200 bg-white shadow-sm transition-[width] duration-300 ${className}`}>
      <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-3 px-4 border-b border-gray-100 bg-white`}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 grid place-items-center shadow-md">
            <span className="text-white font-bold text-base">N</span>
          </div>
          {!collapsed && <span className="font-bold text-gray-900 text-lg tracking-tight">Neptuno</span>}
        </div>
        <button
          type="button"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          onClick={onToggle}
          className="hidden md:inline-flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-all duration-200"
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? (
            <ChevronDoubleRightIcon className="h-4 w-4" />
          ) : (
            <ChevronDoubleLeftIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100%-4rem)]" onClick={onNavigate}>
        {!collapsed && (
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Inicio</p>
        )}
        {NavItem('/app/dev/dashboard', 'Inicio', HomeIcon, collapsed)}

        {!collapsed && (
          <p className="mt-6 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Catálogo</p>
        )}
        {NavItem('#', 'Categorías', RectangleGroupIcon, collapsed)}
        {NavItem('#', 'Productos', TagIcon, collapsed)}
        {NavItem('#', 'Imágenes', PhotoIcon, collapsed)}

        {!collapsed && (
          <p className="mt-6 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Operaciones</p>
        )}
        {NavItem('#', 'Órdenes de Compra', ClipboardDocumentListIcon, collapsed)}
        {NavItem('#', 'Compras', ShoppingCartIcon, collapsed)}

        {!collapsed && (
          <p className="mt-6 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Almacén</p>
        )}
        {NavItem('#', 'Movimientos', ArrowsRightLeftIcon, collapsed)}
        {NavItem('#', 'Inventario', CubeIcon, collapsed)}
        {NavItem('#', 'Almacenes', BuildingStorefrontIcon, collapsed)}

        {!collapsed && (
          <p className="mt-6 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Maestros</p>
        )}
        {NavItem('#', 'Proveedores', BuildingOfficeIcon, collapsed)}
        {NavItem('#', 'Clientes', UsersIcon, collapsed)}
      </nav>
    </aside>
  )
}