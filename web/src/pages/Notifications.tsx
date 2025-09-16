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
      // Si no se especifica user_id, usar el ID del usuario actual
      const notificationData = {
        ...newNotification,
        tenant_id: user.tenant_id,
        user_id: newNotification.user_id || user.id
      };
      
      await notificationsService.createNotification(notificationData);
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
      case 'system': return <X className={`${iconClass} text-red-500`} />;
      case 'academic': return <Check className={`${iconClass} text-green-500`} />;
      case 'info': return <Bell className={`${iconClass} text-blue-500`} />;
      default: return <Bell className={`${iconClass} text-blue-500`} />;
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
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-light">Notificaciones</h1>
          <p className="text-light/70 mt-1">
            {unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : 'Todas las notificaciones están leídas'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="glass-nav-item px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="glass-button px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Notificación
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="glass-card p-4 rounded-xl border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-4 rounded-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">Estado</label>
              <select
                value={filters.is_read === undefined ? 'all' : filters.is_read ? 'read' : 'unread'}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters(prev => ({
                    ...prev,
                    is_read: value === 'all' ? undefined : value === 'read'
                  }));
                }}
                className="glass-input w-full px-3 py-2 rounded-lg"
              >
                <option value="all">Todas</option>
                <option value="unread">Sin leer</option>
                <option value="read">Leídas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-light/80 mb-2">Tipo</label>
              <select
              value={filters.type || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as 'system' | 'academic' | 'info' | undefined }))}
              className="glass-input px-3 py-2 rounded-lg"
            >
              <option value="">Todos los tipos</option>
              <option value="info">Información</option>
              <option value="system">Sistema</option>
              <option value="academic">Académico</option>
            </select>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <div className="glass-card p-4 rounded-xl flex items-center justify-between">
          <span className="text-light/80">
            {selectedNotifications.length} notificación(es) seleccionada(s)
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleMarkSelectedAsRead}
              className="glass-button px-3 py-1 rounded flex items-center gap-1"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar como leídas
            </button>
            <button
              onClick={() => setSelectedNotifications([])}
              className="glass-nav-item px-3 py-1 rounded"
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
            className="glass-button px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como leídas
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="glass-card p-12 rounded-xl text-center">
            <Bell className="h-12 w-12 text-light/50 mx-auto mb-4" />
            <p className="text-light/70">No hay notificaciones</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`glass-card p-4 rounded-xl transition-all ${
                notification.is_read 
                  ? 'opacity-70' 
                  : 'border-l-4 border-l-primary'
              }`}
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
                        notification.is_read ? 'text-light/70' : 'text-light'
                      }`}>
                        {notification.title}
                      </h3>
                      <p className={`mt-1 text-sm ${
                        notification.is_read ? 'text-light/50' : 'text-light/80'
                      }`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-light/60">
                        <span>Tipo: {notification.type}</span>
                        <span>{new Date(notification.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-1 text-light/60 hover:text-primary transition-colors"
                          title="Marcar como leída"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNotification(notification.id)}
                        className="p-1 text-light/60 hover:text-red-400 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-light">Nueva Notificación</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-light/60 hover:text-light transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateNotification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-light/80 mb-2">Título</label>
                <input
                  type="text"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, title: e.target.value }))}
                  className="glass-input w-full px-3 py-2 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light/80 mb-2">Mensaje</label>
                <textarea
                  value={newNotification.message}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, message: e.target.value }))}
                  className="glass-input w-full px-3 py-2 rounded-lg h-24 resize-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light/80 mb-2">Tipo</label>
                <select
                  value={newNotification.type}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, type: e.target.value as 'system' | 'academic' | 'info' }))}
                  className="glass-input w-full px-3 py-2 rounded-lg"
                >
                  <option value="info">Información</option>
                  <option value="system">Sistema</option>
                  <option value="academic">Académico</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-light/80 mb-2">ID de Usuario</label>
                <input
                  type="text"
                  value={newNotification.user_id}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, user_id: e.target.value }))}
                  className="glass-input w-full px-3 py-2 rounded-lg"
                  placeholder="Dejar vacío para notificación general"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="glass-button flex-1 px-4 py-2 rounded-lg"
                >
                  Crear Notificación
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="glass-nav-item flex-1 px-4 py-2 rounded-lg"
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