export interface Relationship {
  id: string;
  tenant_id: string;
  parent_id: string;
  student_id: string;
  relationship_type: string;
  created_at: string;
  parent?: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
  };
  student?: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface CreateRelationshipRequest {
  parent_id: string;
  student_id: string;
  relationship_type?: string;
}

export interface UpdateRelationshipRequest {
  relationship_type?: string;
}

export interface RelationshipWithDetails extends Relationship {
  parent: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role: string;
  };
  student: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role: string;
  };
}

export interface ParentStudentOption {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'parent' | 'student';
}