export interface Certificate {
  id: string;
  course_id: string;
  student_id: string;
  tenant_id: string;
  template: string; // URL o contenido del template del certificado
  qr_code: string; // Código QR para verificación
  signed_by: string; // Nombre de quien firma el certificado
  issued_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCertificateRequest {
  course_id: string;
  student_id: string;
  tenant_id: string;
  template: string;
  signed_by: string;
}

export interface UpdateCertificateRequest {
  template?: string;
  signed_by?: string;
}

export interface CertificateFilters {
  course_id?: string;
  student_id?: string;
  tenant_id?: string | null;
  signed_by?: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  content: string; // HTML/CSS template
  tenant_id: string;
  created_at: string;
  updated_at: string;
}