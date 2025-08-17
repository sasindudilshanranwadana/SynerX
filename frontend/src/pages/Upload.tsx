import React from 'react';
import { supabase } from '../lib/supabase';
import {
  FileVideo, AlertCircle, CheckCircle,
  Clock, Download, Trash2, Activity,
  Info, Timer, FileCheck
} from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { processVideo, deleteVideo, getVideoUrl } from '../lib/api';
import { Upload } from '../lib/types';

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm'
];

function UploadPage() {
  const [isDragging, setIsDragging] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [showToast, setShowToast] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastType, setToastType] = React.useState<'success' | 'error'>('success');
  const [uploads, setUploads] = React.useState<Upload[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    loadUploads();
    // Set up real-time subscription
    const subscription = supabase
      .channel('uploads_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'video_uploads' },
        () => loadUploads()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const loadUploads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('video_uploads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUploads(data || []);
    } catch (error) {
      console.error('Error loading uploads:', error);
      showNotification('Failed to load uploads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = async (files: File[]) => {
    if (uploading) return;
    setUploading(true);

    for (const file of files) {
      if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
        showNotification('Unsupported file type.', 'error');
        continue;
      }

      try {
        // Create upload record in database
        const { data: uploadData, error: uploadError } = await supabase
          .from('video_uploads')
          .insert({
            file_name: file.name,
            file_size: file.size,
            status: 'uploading',
            progress: 0
          })
          .select()
          .single();

        if (uploadError) throw uploadError;

        // Upload file to storage
        const { error: storageError } = await supabase.storage
          .from('videos')
          .upload(file.name, file, {
            onUploadProgress: (progress) => {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              supabase
                .from('video_uploads')
                .update({ progress: percent })
                .eq('id', uploadData.id)
                .then();
            }
          });

        if (storageError) throw storageError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('videos')
          .getPublicUrl(file.name);

        // Update status to completed
        await supabase
          .from('video_uploads')
          .update({ 
            status: 'completed',
            progress: 100
          })
          .eq('id', uploadData.id);

        // Trigger video processing
        await processVideo(uploadData.id, urlData.publicUrl);
        
        showNotification(`Uploaded: ${file.name}`, 'success');
      } catch (err: any) {
        console.error('Upload error:', err);
        showNotification(`Error uploading: ${file.name}`, 'error');
      }
    }

    setUploading(false);
  };

  const handleDelete = async (uploadId: string, fileName: string) => {
    try {
      await deleteVideo(fileName, uploadId);
      showNotification('Video deleted successfully', 'success');
    } catch (error) {
      console.error('Delete error:', error);
      showNotification('Failed to delete video', 'error');
    }
  };

  const handleDownload = async (fileName: string, status: string) => {
    if (status !== 'completed') {
      showNotification('Video is still being processed. Please wait.', 'error');
      return;
    }

    try {
      const url = await getVideoUrl(fileName);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      showNotification('Failed to download video', 'error');
    }
  };

  const formatFileSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading': return <Activity className="w-5 h-5 text-yellow-400" />;
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed': return <AlertCircle className="w-5 h-5 text-red-400" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading': return 'text-yellow-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getEstimatedTime = (fileSize: number) => {
    const minutes = Math.ceil(fileSize / (1024 * 1024 * 5));
    return minutes > 1 ? `${minutes} minutes` : '1 minute';
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
          toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toastType === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toastMessage}</span>
        </div>
      )}

      <Header title="Video Upload" onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isSidebarOpen={sidebarOpen} />
      <Sidebar activePath="/upload" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">Upload Video for Analysis</h1>
            <p className="text-gray-400">Supported formats: MP4, MOV, AVI, MKV, WebM</p>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-12 mb-8 text-center transition-colors ${
              isDragging 
                ? 'border-primary-400 bg-primary-500/10' 
                : 'border-[#1E293B] hover:border-primary-400'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
            onDrop={e => {
              e.preventDefault();
              setIsDragging(false);
              const files = Array.from(e.dataTransfer.files);
              handleFiles(files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_VIDEO_TYPES.join(',')}
              onChange={e => {
                handleFiles(e.target.files ? Array.from(e.target.files) : []);
              }}
              hidden
            />
            <FileVideo className="w-12 h-12 mx-auto mb-4 text-primary-400" />
            <h3 className="text-xl font-semibold mb-2">Drop files here or click to browse</h3>
            <p className="text-gray-400 mb-4">Your video will be automatically processed for analysis</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Browse Files'}
            </button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-400" />
                <p className="text-gray-400">Loading uploads...</p>
              </div>
            ) : uploads.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileVideo className="w-8 h-8 mx-auto mb-4" />
                <p>No uploads yet</p>
              </div>
            ) : (
              uploads.map(upload => (
                <div key={upload.id} className="bg-[#151F32] rounded-xl border border-[#1E293B] p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#1E293B] rounded-lg">
                          <FileCheck className="w-6 h-6 text-primary-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-1">{upload.file_name}</h3>
                          <p className="text-sm text-gray-400">{formatFileSize(upload.file_size)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#1E293B] rounded-lg">
                          {getStatusIcon(upload.status)}
                        </div>
                        <div>
                          <div className={`flex items-center gap-2 font-semibold mb-1 ${getStatusColor(upload.status)}`}>
                            <span className="capitalize">{upload.status}</span>
                          </div>
                          {upload.status === 'uploading' && (
                            <div className="w-full bg-[#1E293B] rounded-full h-1 mb-2">
                              <div 
                                className="bg-primary-400 h-1 rounded-full transition-all duration-300" 
                                style={{ width: `${upload.progress}%` }} 
                              />
                            </div>
                          )}
                          <p className="text-sm text-gray-400">
                            {upload.status === 'uploading' && `${upload.progress}% uploaded`}
                            {upload.status === 'processing' && 'Processing your video...'}
                            {upload.status === 'completed' && 'Ready for download'}
                            {upload.status === 'failed' && upload.error}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#1E293B] rounded-lg">
                          <Timer className="w-6 h-6 text-primary-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">Processing Time</h4>
                          <p className="text-sm text-gray-400">
                            Estimated: {getEstimatedTime(upload.file_size)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleDownload(upload.file_name, upload.status)}
                        className={`p-2 transition-colors ${
                          upload.status === 'completed'
                            ? 'text-primary-400 hover:text-primary-500'
                            : 'text-gray-500 cursor-not-allowed'
                        }`}
                        title={upload.status === 'completed' ? 'Download' : 'Processing...'}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(upload.id, upload.file_name)}
                        className="p-2 text-red-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default UploadPage;