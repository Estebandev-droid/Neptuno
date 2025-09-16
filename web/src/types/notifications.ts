export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'academic' | 'info';
  is_read: boolean;
  user_id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationRequest {
  title: string;
  message: string;
  type: 'system' | 'academic' | 'info';
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
  type?: 'system' | 'academic' | 'info';
}