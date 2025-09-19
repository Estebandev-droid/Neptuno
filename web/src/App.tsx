import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { type ReactNode } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { TenantProvider } from './contexts/TenantContext'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AppLayout from './layouts/AppLayout'
import RolesPage from './pages/Roles'
import UsersPage from './pages/Users'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CategoriesPage from './pages/Categories'
import CoursesPage from './pages/Courses'
import CourseDetailPage from './pages/CourseDetail'
import EnrollmentsPage from './pages/Enrollments'
import TasksPage from './pages/Tasks'
import SubmissionsPage from './pages/Submissions'
import ResourcesPage from './pages/Resources'
import TenantsPage from './pages/Tenants'
import RelationshipsPage from './pages/Relationships'
import NotificationsPage from './pages/Notifications'
import CertificatesPage from './pages/Certificates'
import EvaluationsPage from './pages/Evaluations'
import Signup from './pages/Signup'
import ProfilePage from './pages/Profile'
import MembershipsPage from './pages/Memberships'

const queryClient = new QueryClient()

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            {/* Área protegida con layout persistente */}
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="courses/:id" element={<CourseDetailPage />} />
              <Route path="resources" element={<ResourcesPage />} />
              <Route path="enrollments" element={<EnrollmentsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="submissions" element={<SubmissionsPage />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="memberships" element={<MembershipsPage />} />
              <Route path="relationships" element={<RelationshipsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="certificates" element={<CertificatesPage />} />
              <Route path="evaluations" element={<EvaluationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </BrowserRouter>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
