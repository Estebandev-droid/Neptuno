export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  user_id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationRequest {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  user_id: string;
  tenant_id: string;
}

export interface UpdateNotificationRequest {
  is_read?: boolean;
}

export interface NotificationFilters {
  user_id?: string;
  tenant_id?: string;
  is_read?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}