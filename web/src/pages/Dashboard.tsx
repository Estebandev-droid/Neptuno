import { useAuth } from '../hooks/useAuth'
import { UserIcon, AcademicCapIcon, BookOpenIcon, UsersIcon } from '@heroicons/react/24/outline'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Bienvenida */}
      <section className="primary-bg rounded-xl p-4 sm:p-6 lg:p-8 text-dark subtle-shadow">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-dark/20 flex items-center justify-center border-2 border-dark/30 flex-shrink-0">
            <UserIcon className="h-6 w-6 sm:h-8 sm:w-8 text-dark" />
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark">¡Bienvenido a Neptuno!</h1>
            <p className="text-dark/80 mt-1 font-semibold text-sm sm:text-base truncate max-w-[280px] sm:max-w-none">
              Conectado como: {user?.email}
            </p>
          </div>
        </div>
      </section>

      {/* Estadísticas del sistema */}
      <section>
        <h2 className="text-xl sm:text-2xl font-bold text-light mb-4 sm:mb-6">Resumen del Sistema Educativo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="rounded-xl glass-card p-4 sm:p-6 hover:scale-105 transition-all duration-300">
            <div className="flex items-center gap-3">
              <AcademicCapIcon className="h-8 w-8 text-primary glow-effect" />
              <div>
                <h3 className="font-bold text-light text-lg">Estudiantes</h3>
                <p className="text-3xl font-bold mt-1 text-primary">0</p>
              </div>
            </div>
            <p className="text-sm text-light/70 mt-3">Estudiantes registrados</p>
          </div>
          
          <div className="rounded-xl glass-card p-4 sm:p-6 hover:scale-105 transition-all duration-300">
            <div className="flex items-center gap-3">
              <UsersIcon className="h-8 w-8 text-secondary glow-effect" />
              <div>
                <h3 className="font-bold text-light text-lg">Docentes</h3>
                <p className="text-3xl font-bold mt-1 text-secondary">0</p>
              </div>
            </div>
            <p className="text-sm text-light/70 mt-3">Profesores activos</p>
          </div>
          
          <div className="rounded-xl glass-card p-4 sm:p-6 hover:scale-105 transition-all duration-300">
            <div className="flex items-center gap-3">
              <BookOpenIcon className="h-8 w-8 text-accent glow-effect" />
              <div>
                <h3 className="font-bold text-light text-lg">Materias</h3>
                <p className="text-3xl font-bold mt-1 text-accent">3</p>
              </div>
            </div>
            <p className="text-sm text-light/70 mt-3">Materias disponibles</p>
          </div>
        </div>
      </section>

      {/* Acciones rápidas */}
      <section className="rounded-xl glass-card p-4 sm:p-6 lg:p-8">
        <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-light">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <button className="glass-button p-4 rounded-lg text-left hover:scale-105 transition-all duration-300">
            <h4 className="font-bold text-light">Gestionar Estudiantes</h4>
            <p className="text-sm text-light/70 mt-1">Agregar, editar o ver estudiantes</p>
          </button>
          
          <button className="glass-button p-4 rounded-lg text-left hover:scale-105 transition-all duration-300">
            <h4 className="font-bold text-light">Crear Evaluación</h4>
            <p className="text-sm text-light/70 mt-1">Nueva evaluación o examen</p>
          </button>
          
          <button className="glass-button p-4 rounded-lg text-left hover:scale-105 transition-all duration-300">
            <h4 className="font-bold text-light">Ver Reportes</h4>
            <p className="text-sm text-light/70 mt-1">Estadísticas y análisis</p>
          </button>
        </div>
      </section>

      {/* Estado del sistema */}
      <section className="rounded-xl glass-card p-4 sm:p-6 lg:p-8">
        <h3 className="text-lg sm:text-xl font-bold mb-4 text-light">Estado del Sistema</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-primary glow-effect"></div>
            <span className="text-light font-semibold">Base de datos conectada</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-primary animate-pulse glow-effect"></div>
            <span className="text-light font-semibold">Autenticación funcionando</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-primary animate-pulse glow-effect"></div>
            <span className="text-light font-semibold">Sistema listo para usar</span>
          </div>
        </div>
      </section>
    </div>
  )
}