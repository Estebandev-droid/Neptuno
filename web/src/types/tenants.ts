export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
    custom_css?: string;
  };
  plan: 'free' | 'basic' | 'pro';
  created_at: string;
  updated_at: string;
}

export interface CreateTenantRequest {
  name: string;
  domain?: string;
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
    custom_css?: string;
  };
  plan?: 'free' | 'basic' | 'pro';
}

export interface UpdateTenantRequest {
  name?: string;
  domain?: string;
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
    custom_css?: string;
  };
  plan?: 'free' | 'basic' | 'pro';
}

export interface TenantAdmin {
  id: string;
  tenant_id: string;
  user_id: string;
  permissions: string[];
  created_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface AssignAdminRequest {
  tenant_id: string;
  user_id: string;
  permissions?: string[];
}