import { supabase } from './supabaseClient';
import type { Notification, CreateNotificationRequest, UpdateNotificationRequest, NotificationFilters } from '../types/notifications';

export const notificationsService = {
  // Crear una nueva notificación
  async createNotification(data: CreateNotificationRequest): Promise<Notification> {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        title: data.title,
        message: data.message,
        type: data.type,
        user_id: data.user_id,
        tenant_id: data.tenant_id,
        is_read: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating notification: ${error.message}`);
    }

    return notification;
  },

  // Listar notificaciones con filtros
  async getNotifications(filters: NotificationFilters = {}): Promise<Notification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters.tenant_id) {
      query = query.eq('tenant_id', filters.tenant_id);
    }

    if (filters.is_read !== undefined) {
      query = query.eq('is_read', filters.is_read);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    const { data: notifications, error } = await query;

    if (error) {
      throw new Error(`Error fetching notifications: ${error.message}`);
    }

    return notifications || [];
  },

  // Obtener una notificación por ID
  async getNotificationById(id: string): Promise<Notification | null> {
    const { data: notification, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching notification: ${error.message}`);
    }

    return notification;
  },

  // Marcar notificación como leída
  async markAsRead(id: string): Promise<Notification> {
    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error marking notification as read: ${error.message}`);
    }

    return notification;
  },

  // Marcar múltiples notificaciones como leídas
  async markMultipleAsRead(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids);

    if (error) {
      throw new Error(`Error marking notifications as read: ${error.message}`);
    }
  },

  // Marcar todas las notificaciones de un usuario como leídas
  async markAllAsReadForUser(userId: string, tenantId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Error marking all notifications as read: ${error.message}`);
    }
  },

  // Actualizar notificación
  async updateNotification(id: string, data: UpdateNotificationRequest): Promise<Notification> {
    const { data: notification, error } = await supabase
      .from('notifications')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating notification: ${error.message}`);
    }

    return notification;
  },

  // Eliminar notificación
  async deleteNotification(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting notification: ${error.message}`);
    }
  },

  // Contar notificaciones no leídas
  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Error counting unread notifications: ${error.message}`);
    }

    return count || 0;
  }
};