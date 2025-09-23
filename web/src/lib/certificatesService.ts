import { supabase } from './supabaseClient';
import type { Certificate, CreateCertificateRequest, UpdateCertificateRequest, CertificateFilters, CertificateTemplate } from '../types/certificates';

export const certificatesService = {
  // Emitir un nuevo certificado
  async issueCertificate(data: CreateCertificateRequest): Promise<Certificate> {
    // Generar código QR único
    const qrCode = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: certificate, error } = await supabase
      .from('certificates')
      .insert({
        course_id: data.course_id,
        student_id: data.student_id,
        tenant_id: data.tenant_id,
        template: data.template,
        qr_code: qrCode,
        signed_by: data.signed_by,
        issued_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error issuing certificate: ${error.message}`);
    }

    return certificate;
  },

  // Listar certificados con filtros
  async getCertificates(filters: CertificateFilters = {}): Promise<Certificate[]> {
    let query = supabase
      .from('certificates')
      .select(`
        *,
        courses(title, description),
        profiles_with_email(full_name, email)
      `)
      .order('issued_at', { ascending: false });

    if (filters.course_id) {
      query = query.eq('course_id', filters.course_id);
    }

    if (filters.student_id) {
      query = query.eq('student_id', filters.student_id);
    }

    if (filters.tenant_id) {
      query = query.eq('tenant_id', filters.tenant_id);
    }

    if (filters.signed_by) {
      query = query.eq('signed_by', filters.signed_by);
    }

    const { data: certificates, error } = await query;

    if (error) {
      throw new Error(`Error fetching certificates: ${error.message}`);
    }

    return certificates || [];
  },

  // Obtener certificado por ID
  async getCertificateById(id: string): Promise<Certificate | null> {
    const { data: certificate, error } = await supabase
      .from('certificates')
      .select(`
        *,
        courses(title, description),
        profiles(full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching certificate: ${error.message}`);
    }

    return certificate;
  },

  // Verificar certificado por código QR
  async verifyCertificate(qrCode: string): Promise<Certificate | null> {
    const { data: certificate, error } = await supabase
      .from('certificates')
      .select(`
        *,
        courses:course_id(title, description),
        users:user_id(name, email)
      `)
      .eq('qr_code', qrCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error verifying certificate: ${error.message}`);
    }

    return certificate;
  },

  // Actualizar certificado
  async updateCertificate(id: string, data: UpdateCertificateRequest): Promise<Certificate> {
    const { data: certificate, error } = await supabase
      .from('certificates')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating certificate: ${error.message}`);
    }

    return certificate;
  },

  // Eliminar certificado
  async deleteCertificate(id: string): Promise<void> {
    const { error } = await supabase
      .from('certificates')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting certificate: ${error.message}`);
    }
  },

  // Obtener certificados de un usuario
  async getUserCertificates(userId: string, tenantId: string): Promise<Certificate[]> {
    return this.getCertificates({ student_id: userId, tenant_id: tenantId });
  },

  // Obtener certificados de un curso
  async getCourseCertificates(courseId: string): Promise<Certificate[]> {
    return this.getCertificates({ course_id: courseId });
  },

  // Verificar si un usuario ya tiene certificado para un curso
  async hasUserCertificate(userId: string, courseId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', userId)
      .eq('course_id', courseId);

    if (error) {
      throw new Error(`Error checking user certificate: ${error.message}`);
    }

    return (count || 0) > 0;
  },

  // Gestión de templates de certificados
  async getCertificateTemplates(tenantId?: string): Promise<CertificateTemplate[]> {
    // Si no hay tenantId, retornar array vacío en lugar de hacer consulta con valor vacío
    if (!tenantId) {
      return [];
    }

    const { data: templates, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching certificate templates: ${error.message}`);
    }

    return templates || [];
  },

  async createCertificateTemplate(name: string, content: string, tenantId: string): Promise<CertificateTemplate> {
    const { data: template, error } = await supabase
      .from('certificate_templates')
      .insert({
        name,
        content,
        tenant_id: tenantId
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating certificate template: ${error.message}`);
    }

    return template;
  },

  async updateCertificateTemplate(id: string, name?: string, content?: string): Promise<CertificateTemplate> {
    const updateData: Partial<Pick<CertificateTemplate, 'name' | 'content'>> = {};
    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;

    const { data: template, error } = await supabase
      .from('certificate_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating certificate template: ${error.message}`);
    }

    return template;
  },

  async deleteCertificateTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('certificate_templates')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting certificate template: ${error.message}`);
    }
  }
};