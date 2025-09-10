import { useAuth } from '../hooks/useAuth'
import { UserIcon, AcademicCapIcon, BookOpenIcon, UsersIcon } from '@heroicons/react/24/outline'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      {/* Bienvenida */}
      <section className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
            <UserIcon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">¡Bienvenido a Neptuno!</h1>
            <p className="text-emerald-100 mt-1">
              Conectado como: {user?.email}
            </p>
          </div>
        </div>
      </section>

      {/* Estadísticas del sistema */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Resumen del Sistema Educativo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <AcademicCapIcon className="h-8 w-8 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Estudiantes</h3>
                <p className="text-3xl font-bold mt-1 text-gray-900">0</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3">Estudiantes registrados</p>
          </div>
          
          <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <UsersIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Docentes</h3>
                <p className="text-3xl font-bold mt-1 text-gray-900">0</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3">Profesores activos</p>
          </div>
          
          <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <BookOpenIcon className="h-8 w-8 text-purple-600" />
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Materias</h3>
                <p className="text-3xl font-bold mt-1 text-gray-900">3</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3">Materias disponibles</p>
          </div>
        </div>
      </section>

      {/* Acciones rápidas */}
      <section className="rounded-xl border border-gray-200 p-8 bg-white shadow-sm">
        <h3 className="text-xl font-semibold mb-6 text-gray-900">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <h4 className="font-medium text-gray-900">Gestionar Estudiantes</h4>
            <p className="text-sm text-gray-600 mt-1">Agregar, editar o ver estudiantes</p>
          </button>
          
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <h4 className="font-medium text-gray-900">Crear Evaluación</h4>
            <p className="text-sm text-gray-600 mt-1">Nueva evaluación o examen</p>
          </button>
          
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <h4 className="font-medium text-gray-900">Ver Reportes</h4>
            <p className="text-sm text-gray-600 mt-1">Estadísticas y análisis</p>
          </button>
        </div>
      </section>

      {/* Estado del sistema */}
      <section className="rounded-xl border border-gray-200 p-8 bg-white shadow-sm">
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Estado del Sistema</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span className="text-gray-700">Base de datos conectada</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span className="text-gray-700">Autenticación funcionando</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span className="text-gray-700">Sistema listo para usar</span>
          </div>
        </div>
      </section>
    </div>
  )
}