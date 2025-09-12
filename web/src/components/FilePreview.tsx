import React from 'react';
import { FileText, Download, Eye, Music } from 'lucide-react';

interface FilePreviewProps {
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  className?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({ 
  fileUrl, 
  fileName = 'archivo', 
  fileType = '', 
  className = '' 
}) => {
  const getFileExtension = (url: string) => {
    return url.split('.').pop()?.toLowerCase() || '';
  };

  const getMimeType = (url: string) => {
    const ext = getFileExtension(url);
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'video/ogg',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain'
    };
    return mimeTypes[ext] || fileType;
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');
  const isVideo = (mimeType: string) => mimeType.startsWith('video/');
  const isAudio = (mimeType: string) => mimeType.startsWith('audio/');
  const isPDF = (mimeType: string) => mimeType === 'application/pdf';

  const mimeType = getMimeType(fileUrl);
  const extension = getFileExtension(fileUrl);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = () => {
    window.open(fileUrl, '_blank');
  };

  const renderPreview = () => {
    if (isImage(mimeType)) {
      return (
        <div className="relative group">
          <img 
            src={fileUrl} 
            alt={fileName}
            className="max-w-full max-h-64 object-contain rounded border"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded flex items-center justify-center">
            <button
              onClick={handlePreview}
              className="opacity-0 group-hover:opacity-100 bg-white bg-opacity-90 hover:bg-opacity-100 p-2 rounded-full transition-all duration-200"
              title="Ver en tamaño completo"
            >
              <Eye className="w-4 h-4 text-gray-700" />
            </button>
          </div>
        </div>
      );
    }

    if (isVideo(mimeType)) {
      return (
        <video 
          controls 
          className="max-w-full max-h-64 rounded border"
          preload="metadata"
        >
          <source src={fileUrl} type={mimeType} />
          Tu navegador no soporta la reproducción de video.
        </video>
      );
    }

    if (isAudio(mimeType)) {
      return (
        <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded border">
          <Music className="w-8 h-8 text-blue-500" />
          <div className="flex-1">
            <audio controls className="w-full">
              <source src={fileUrl} type={mimeType} />
              Tu navegador no soporta la reproducción de audio.
            </audio>
          </div>
        </div>
      );
    }

    if (isPDF(mimeType)) {
      return (
        <div className="border rounded p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-6 h-6 text-red-500" />
              <span className="font-medium text-gray-700">{fileName}</span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handlePreview}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                title="Ver PDF"
              >
                <Eye className="w-4 h-4" />
                <span className="text-sm">Ver</span>
              </button>
            </div>
          </div>
          <iframe
            src={`${fileUrl}#toolbar=0`}
            className="w-full h-64 border rounded"
            title={fileName}
          />
        </div>
      );
    }

    // Archivo genérico
    return (
      <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded border">
        <FileText className="w-8 h-8 text-gray-500" />
        <div className="flex-1">
          <p className="font-medium text-gray-700">{fileName}</p>
          <p className="text-sm text-gray-500 uppercase">{extension || 'archivo'}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handlePreview}
            className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            title="Abrir archivo"
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm">Abrir</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`file-preview scrollbar-styled ${className}`}>
      {renderPreview()}
      <div className="flex justify-end mt-2">
        <button
          onClick={handleDownload}
          className="flex items-center space-x-1 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
          title="Descargar archivo"
        >
          <Download className="w-4 h-4" />
          <span>Descargar</span>
        </button>
      </div>
    </div>
  );
};

export default FilePreview;