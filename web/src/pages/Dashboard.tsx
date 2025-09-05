export default function Dashboard() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Inventario actual</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-brand-700 text-lg">Productos</h3>
            <p className="text-3xl font-bold mt-2 text-gray-900">0</p>
            <p className="text-sm text-gray-600 mt-2">Total en inventario</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-brand-700 text-lg">Categorías</h3>
            <p className="text-3xl font-bold mt-2 text-gray-900">0</p>
            <p className="text-sm text-gray-600 mt-2">Activas</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-brand-700 text-lg">Almacenes</h3>
            <p className="text-3xl font-bold mt-2 text-gray-900">0</p>
            <p className="text-sm text-gray-600 mt-2">Configurados</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-8 bg-white shadow-sm">
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Estado del sistema</h3>
        <p className="text-gray-600 text-lg">No hay productos en inventario aún.</p>
      </section>
    </div>
  )
}