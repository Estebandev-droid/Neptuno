import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, X, Check, Filter, CheckCheck } from 'lucide-react';
import { notificationsService } from '../lib/notificationsService';
import type { Notification, CreateNotificationRequest, NotificationFilters } from '../types/notifications';
import { useAuth } from '../hooks/useAuth';

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [filters, setFilters] = useState<NotificationFilters>({
    tenant_id: user?.tenant_id ?? undefined
  });
  const [unreadCount, setUnreadCount] = useState(0);

  const [newNotification, setNewNotification] = useState<Omit<CreateNotificationRequest, 'tenant_id'>>({
    title: '',
    message: '',
    type: 'info',
    user_id: ''
  });

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notificationsService.getNotifications({
        ...filters,
        tenant_id: user?.tenant_id ?? undefined
      });
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  }, [filters, user?.tenant_id]);

  const loadUnreadCount = useCallback(async () => {
    if (user?.id && user?.tenant_id) {
      try {
        const count = await notificationsService.getUnreadCount(user.id, user.tenant_id);
        setUnreadCount(count);
      } catch (err) {
        console.error('Error loading unread count:', err);
      }
    }
  }, [user?.id, user?.tenant_id]);

  useEffect(() => {
    // Antes dependíamos de que existiera tenant_id; si venía nulo, jamás cargaba y se quedaba el spinner.
    // Ahora cargamos cuando exista un usuario; filtramos por tenant si está disponible.
    if (user) {
      loadNotifications();
      loadUnreadCount();
    }
  }, [user, filters, loadNotifications, loadUnreadCount]);

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenant_id) return;

    try {
      await notificationsService.createNotification({
        ...newNotification,
        tenant_id: user.tenant_id
      });
      setNewNotification({
        title: '',
        message: '',
        type: 'info',
        user_id: ''
      });
      setShowCreateForm(false);
      loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear notificación');
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsService.markAsRead(id);
      loadNotifications();
      loadUnreadCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al marcar como leída');
    }
  };

  const handleMarkSelectedAsRead = async () => {
    try {
      await notificationsService.markMultipleAsRead(selectedNotifications);
      setSelectedNotifications([]);
      loadNotifications();
      loadUnreadCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al marcar como leídas');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id || !user?.tenant_id) return;
    
    try {
      await notificationsService.markAllAsReadForUser(user.id, user.tenant_id);
      loadNotifications();
      loadUnreadCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al marcar todas como leídas');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta notificación?')) return;
    
    try {
      await notificationsService.deleteNotification(id);
      loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar notificación');
    }
  };

  const toggleNotificationSelection = (id: string) => {
    setSelectedNotifications(prev => 
      prev.includes(id) 
        ? prev.filter(notifId => notifId !== id)
        : [...prev, id]
    );
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case 'success': return <Check className={`${iconClass} text-green-500`} />;
      case 'warning': return <Bell className={`${iconClass} text-yellow-500`} />;
      case 'error': return <X className={`${iconClass} text-red-500`} />;
      default: return <Bell className={`${iconClass} text-blue-500`} />;
    }
  };

  const getNotificationBgColor = (type: string, isRead: boolean) => {
    const opacity = isRead ? 'bg-opacity-20' : 'bg-opacity-40';
    switch (type) {
      case 'success': return `bg-green-500 ${opacity}`;
      case 'warning': return `bg-yellow-500 ${opacity}`;
      case 'error': return `bg-red-500 ${opacity}`;
      default: return `bg-blue-500 ${opacity}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notificaciones</h1>
          <p className="text-gray-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : 'Todas las notificaciones están leídas'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Notificación
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-800 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Estado</label>
              <select
                value={filters.is_read === undefined ? 'all' : filters.is_read ? 'read' : 'unread'}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters(prev => ({
                    ...prev,
                    is_read: value === 'all' ? undefined : value === 'read'
                  }));
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="all">Todas</option>
                <option value="unread">Sin leer</option>
                <option value="read">Leídas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
              <select
                value={filters.type || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, type: (e.target.value as 'info' | 'success' | 'warning' | 'error') || undefined }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Todos los tipos</option>
                <option value="info">Información</option>
                <option value="success">Éxito</option>
                <option value="warning">Advertencia</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
          <span className="text-gray-300">
            {selectedNotifications.length} notificación(es) seleccionada(s)
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleMarkSelectedAsRead}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar como leídas
            </button>
            <button
              onClick={() => setSelectedNotifications([])}
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como leídas
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No hay notificaciones</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border transition-all ${
                notification.is_read 
                  ? 'bg-gray-800/50 border-gray-700' 
                  : 'bg-gray-800 border-gray-600'
              } ${getNotificationBgColor(notification.type, notification.is_read)}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedNotifications.includes(notification.id)}
                  onChange={() => toggleNotificationSelection(notification.id)}
                  className="mt-1 rounded border-gray-600 bg-gray-700 text-blue-600"
                />
                <div className="mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className={`font-medium ${
                        notification.is_read ? 'text-gray-300' : 'text-white'
                      }`}>
                        {notification.title}
                      </h3>
                      <p className={`mt-1 text-sm ${
                        notification.is_read ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Tipo: {notification.type}</span>
                        <span>{new Date(notification.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-green-400 transition-colors"
                          title="Marcar como leída"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Notification Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Nueva Notificación</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateNotification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título</label>
                <input
                  type="text"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mensaje</label>
                <textarea
                  value={newNotification.message}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-24 resize-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
                <select
                  value={newNotification.type}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, type: e.target.value as 'info' | 'success' | 'warning' | 'error' }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="info">Información</option>
                  <option value="success">Éxito</option>
                  <option value="warning">Advertencia</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">ID de Usuario</label>
                <input
                  type="text"
                  value={newNotification.user_id}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, user_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Dejar vacío para notificación general"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear Notificación
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;