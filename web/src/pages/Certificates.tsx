import React, { useState, useEffect, useCallback } from 'react';
import { Award, Plus, Search, Download, Eye, Trash2, QrCode, FileText, X, Check } from 'lucide-react';
import { certificatesService } from '../lib/certificatesService';
import { listCourses } from '../lib/coursesService';
import { listProfiles } from '../lib/usersService';
import type { Certificate, CreateCertificateRequest, CertificateFilters, CertificateTemplate } from '../types/certificates';
import type { Course } from '../types/courses';
import type { Profile } from '../types/users';
import { useAuth } from '../hooks/useAuth';

const Certificates: React.FC = () => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'certificates' | 'templates'>('certificates');
  const [filters, setFilters] = useState<CertificateFilters>({});
  const [verifyQrCode, setVerifyQrCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<Certificate | null>(null);

  const [newCertificate, setNewCertificate] = useState<Omit<CreateCertificateRequest, 'tenant_id'>>({
    course_id: '',
    student_id: '',
    template: '',
    signed_by: ''
  });

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [certificatesData, coursesData, usersData, templatesData] = await Promise.all([
        certificatesService.getCertificates({ ...filters, tenant_id: user?.tenant_id ?? undefined }),
        listCourses({ pageSize: 1000 }),
        listProfiles(),
        // Solo cargar templates si hay tenant_id
        user?.tenant_id ? certificatesService.getCertificateTemplates(user.tenant_id) : Promise.resolve([])
      ]);
      setCertificates(certificatesData);
      setCourses(coursesData.data);
      setUsers(usersData);
      setTemplates(templatesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [filters, user?.tenant_id]);

  // Sincronizar filtros con el usuario
  useEffect(() => {
    if (user?.tenant_id) {
      setFilters(prev => ({ ...prev, tenant_id: user.tenant_id }));
    }
  }, [user?.tenant_id]);

  // Sincronizar signed_by con el usuario
  useEffect(() => {
    if (user?.id) {
      setNewCertificate(prev => ({ ...prev, signed_by: user.id }));
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenant_id) return;

    try {
      // Verificar si el usuario ya tiene certificado para este curso
      const hasExisting = await certificatesService.hasUserCertificate(
        newCertificate.student_id,
        newCertificate.course_id
      );

      if (hasExisting) {
        setError('El usuario ya tiene un certificado para este curso');
        return;
      }

      await certificatesService.issueCertificate({
        ...newCertificate,
        tenant_id: user.tenant_id!
      });
      
      setNewCertificate({
        course_id: '',
        student_id: '',
        template: '',
        signed_by: ''
      });
      setShowIssueForm(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al emitir certificado');
    }
  };

  const handleVerifyCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await certificatesService.verifyCertificate(verifyQrCode);
      setVerificationResult(result);
      if (!result) {
        setError('Certificado no encontrado o código QR inválido');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar certificado');
      setVerificationResult(null);
    }
  };

  const handleDeleteCertificate = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este certificado?')) return;
    
    try {
      await certificatesService.deleteCertificate(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar certificado');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenant_id) return;

    try {
      await certificatesService.createCertificateTemplate(
        newTemplate.name,
        newTemplate.content,
        user.tenant_id!
      );
      
      setNewTemplate({ name: '', content: '' });
      setShowTemplateForm(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear template');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este template?')) return;
    
    try {
      await certificatesService.deleteCertificateTemplate(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar template');
    }
  };

  const getCourseTitle = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course?.title || 'Curso no encontrado';
  };

  const getUserName = (userId: string) => {
    const userData = users.find(u => u.id === userId);
    return userData?.full_name || 'Usuario no encontrado';
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
          <h1 className="text-2xl font-bold text-white">Certificados</h1>
          <p className="text-gray-400 mt-1">
            Gestiona la emisión y verificación de certificados
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowVerifyForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <QrCode className="h-4 w-4" />
            Verificar
          </button>
          <button
            onClick={() => setShowIssueForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Emitir Certificado
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-400 hover:text-red-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('certificates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'certificates'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            Certificados
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            Templates
          </button>
        </nav>
      </div>

      {/* Certificates Tab */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Curso</label>
                <select
                  value={filters.course_id || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, course_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Todos los cursos</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Usuario</label>
                <select
                  value={filters.student_id || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, student_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Todos los usuarios</option>
                  {users.map(userData => (
                    <option key={userData.id} value={userData.id}>{userData.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Firmado por</label>
                <input
                  type="text"
                  value={filters.signed_by || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, signed_by: e.target.value || undefined }))}
                  placeholder="Filtrar por firmante"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          {/* Certificates List */}
          <div className="grid gap-4">
            {certificates.length === 0 ? (
              <div className="text-center py-12">
                <Award className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No hay certificados emitidos</p>
              </div>
            ) : (
              certificates.map((certificate) => (
                <div key={certificate.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Award className="h-6 w-6 text-yellow-500" />
                        <h3 className="text-lg font-semibold text-white">
                          {getCourseTitle(certificate.course_id)}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Usuario: </span>
                          <span className="text-white">{getUserName(certificate.student_id)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Firmado por: </span>
                          <span className="text-white">{certificate.signed_by}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Código QR: </span>
                          <span className="text-white font-mono text-xs">{certificate.qr_code}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Emitido: </span>
                          <span className="text-white">{new Date(certificate.issued_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Ver certificado"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className="p-2 text-gray-400 hover:text-green-400 transition-colors"
                        title="Descargar certificado"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCertificate(certificate.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Eliminar certificado"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowTemplateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo Template
            </button>
          </div>

          <div className="grid gap-4">
            {templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No hay templates de certificados</p>
              </div>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                      <p className="text-gray-400 text-sm mb-3">
                        Creado: {new Date(template.created_at).toLocaleDateString()}
                      </p>
                      <div className="bg-gray-900 p-3 rounded border text-xs text-gray-300 font-mono max-h-32 overflow-y-auto">
                        {template.content.substring(0, 200)}...
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Editar template"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Eliminar template"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Issue Certificate Modal */}
      {showIssueForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Emitir Certificado</h2>
              <button
                onClick={() => setShowIssueForm(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleIssueCertificate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Curso</label>
                <select
                  value={newCertificate.course_id}
                  onChange={(e) => setNewCertificate(prev => ({ ...prev, course_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                >
                  <option value="">Seleccionar curso</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Usuario</label>
                <select
                  value={newCertificate.student_id}
                  onChange={(e) => setNewCertificate(prev => ({ ...prev, student_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                >
                  <option value="">Seleccionar usuario</option>
                  {users.map(userData => (
                    <option key={userData.id} value={userData.id}>{userData.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Template</label>
                <select
                  value={newCertificate.template}
                  onChange={(e) => setNewCertificate(prev => ({ ...prev, template: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                >
                  <option value="">Seleccionar template</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Firmado por</label>
                <input
                  type="text"
                  value={newCertificate.signed_by}
                  onChange={(e) => setNewCertificate(prev => ({ ...prev, signed_by: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Nombre del firmante"
                  required
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Emitir Certificado
                </button>
                <button
                  type="button"
                  onClick={() => setShowIssueForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Certificate Modal */}
      {showVerifyForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Verificar Certificado</h2>
              <button
                onClick={() => {
                  setShowVerifyForm(false);
                  setVerificationResult(null);
                  setVerifyQrCode('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {!verificationResult ? (
              <form onSubmit={handleVerifyCertificate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Código QR</label>
                  <input
                    type="text"
                    value={verifyQrCode}
                    onChange={(e) => setVerifyQrCode(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Ingresa el código QR del certificado"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Verificar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVerifyForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-400 mb-4">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Certificado Válido</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-400">Curso: </span>
                    <span className="text-white">{getCourseTitle(verificationResult.course_id)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Usuario: </span>
                    <span className="text-white">{getUserName(verificationResult.student_id)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Firmado por: </span>
                    <span className="text-white">{verificationResult.signed_by}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Emitido: </span>
                    <span className="text-white">{new Date(verificationResult.issued_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setVerificationResult(null);
                    setVerifyQrCode('');
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mt-4"
                >
                  Verificar Otro
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Nuevo Template de Certificado</h2>
              <button
                onClick={() => setShowTemplateForm(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del Template</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Ej: Certificado de Finalización"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Contenido HTML/CSS</label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-64 resize-none font-mono text-sm"
                  placeholder="Ingresa el HTML/CSS del template del certificado..."
                  required
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear Template
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplateForm(false)}
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

export default Certificates;