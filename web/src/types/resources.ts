export interface Resource {
  id: string;
  tenant_id: string | null;
  course_id: string;
  title: string;
  description: string | null;
  resource_type: 'document' | 'video' | 'link' | 'image';
  file_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateResourceRequest {
  course_id: string;
  title: string;
  description?: string;
  resource_type: 'document' | 'video' | 'link' | 'image';
  file_url?: string;
  is_public?: boolean;
}

export interface UpdateResourceRequest {
  title?: string;
  description?: string;
  resource_type?: 'document' | 'video' | 'link' | 'image';
  file_url?: string;
  is_public?: boolean;
}

export type ResourceType = 'document' | 'video' | 'link' | 'image';

export interface ResourceFilters {
  course_id?: string;
  resource_type?: ResourceType;
  is_public?: boolean;
  search?: string;
}