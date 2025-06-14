import React from 'react';
<<<<<<< Updated upstream
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FileVideo, AlertCircle, CheckCircle, Clock, Filter, Calendar } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

interface VideoFile {
  id: string;
  name: string;
  size: number;
  uploadDate: Date;
  status: 'processing' | 'completed' | 'failed';
  url?: string;
  violationType?: string;
  progress?: number;
}

function Upload() {
  const [isDragging, setIsDragging] = React.useState(false);
  const [files, setFiles] = React.useState<VideoFile[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [filterDate, setFilterDate] = React.useState('');
  const [filterType, setFilterType] = React.useState('');
  const [showToast, setShowToast] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastType, setToastType] = React.useState<'success' | 'error'>('success');
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const storage = getStorage();
=======
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
>>>>>>> Stashed changes

  const showNotification = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

<<<<<<< Updated upstream
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    await handleFiles(droppedFiles);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      await handleFiles(selectedFiles);
    }
  };

  const handleFiles = async (fileList: File[]) => {
    const validFiles = fileList.filter(file => 
      file.type === 'video/mp4' || file.type === 'video/quicktime'
    );

    if (validFiles.length !== fileList.length) {
      showNotification('Only MP4 and MOV files are allowed', 'error');
      return;
    }

    setUploading(true);

    for (const file of validFiles) {
      try {
        const storageRef = ref(storage, `videos/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setFiles(prev => prev.map(f => 
              f.name === file.name ? { ...f, progress } : f
            ));
          },
          (error) => {
            console.error('Upload error:', error);
            showNotification(`Failed to upload ${file.name}`, 'error');
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const newFile: VideoFile = {
              id: Math.random().toString(36).substr(2, 9),
              name: file.name,
              size: file.size,
              uploadDate: new Date(),
              status: 'processing',
              url: downloadURL,
              violationType: 'speed',
            };
            
            setFiles(prev => [...prev, newFile]);
            showNotification(`${file.name} uploaded successfully`, 'success');
          }
        );
      } catch (error) {
        console.error('File handling error:', error);
        showNotification(`Error processing ${file.name}`, 'error');
=======
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
>>>>>>> Stashed changes
      }
    }

    setUploading(false);
  };

<<<<<<< Updated upstream
  const filteredFiles = files.filter(file => {
    const matchesDate = !filterDate || new Date(file.uploadDate).toDateString() === new Date(filterDate).toDateString();
    const matchesType = !filterType || file.violationType === filterType;
    return matchesDate && matchesType;
  });

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      {/* Toast Notification */}
=======
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
>>>>>>> Stashed changes
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
          toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
<<<<<<< Updated upstream
          {toastType === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
=======
          {toastType === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
>>>>>>> Stashed changes
          <span>{toastMessage}</span>
        </div>
      )}

<<<<<<< Updated upstream
      {/* Header */}
      <Header 
        title="Video Upload" 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        isSidebarOpen={sidebarOpen} 
      />

      {/* Sidebar */}
      <Sidebar 
        activePath="/upload" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">Video Upload</h1>
          <p className="text-gray-400 mb-8">Upload traffic footage for AI analysis. Supported formats: MP4, MOV</p>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-12 mb-8 text-center transition-colors ${
              isDragging
                ? 'border-primary-400 bg-primary-500/10'
                : 'border-[#1E293B] hover:border-primary-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".mp4,.mov"
              multiple
              onChange={handleFileSelect}
            />
            <FileVideo className="w-12 h-12 mx-auto mb-4 text-primary-400" />
            <h3 className="text-xl font-semibold mb-2 text-white">Drag and drop video files here</h3>
            <p className="text-gray-400 mb-4">or click to browse your files</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors text-white"
=======
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
>>>>>>> Stashed changes
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Browse Files'}
            </button>
          </div>

<<<<<<< Updated upstream
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                <Calendar className="w-4 h-4 inline-block mr-2" />
                Date Filter
              </label>
              <input
                type="date"
                className="w-full px-4 py-2 bg-[#151F32] border border-[#1E293B] rounded-lg focus:outline-none focus:border-primary-400 text-white"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                <Filter className="w-4 h-4 inline-block mr-2" />
                Violation Type
              </label>
              <select
                className="w-full px-4 py-2 bg-[#151F32] border border-[#1E293B] rounded-lg focus:outline-none focus:border-primary-400 text-white"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="speed">Speed</option>
                <option value="signal">Signal</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* File List */}
          <div className="bg-[#151F32] rounded-xl border border-[#1E293B] overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#1E293B] text-sm font-medium text-gray-400">
              <div className="col-span-1">Type</div>
              <div className="col-span-5">Filename</div>
              <div className="col-span-3">Upload Date</div>
              <div className="col-span-3">Status</div>
            </div>
            <div className="divide-y divide-[#1E293B]">
              {filteredFiles.map((file) => (
                <div key={file.id} className="grid grid-cols-12 gap-4 p-4 items-center text-white">
                  <div className="col-span-1">
                    <FileVideo className="w-5 h-5 text-primary-400" />
                  </div>
                  <div className="col-span-5">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-gray-400">Type: {file.violationType}</div>
                  </div>
                  <div className="col-span-3 text-gray-400">
                    {new Date(file.uploadDate).toLocaleDateString()}
                  </div>
                  <div className="col-span-3">
                    {file.status === 'processing' ? (
                      <div className="flex items-center space-x-2 text-yellow-400">
                        <Clock className="w-4 h-4" />
                        <span>Processing</span>
                      </div>
                    ) : file.status === 'completed' ? (
                      <div className="flex items-center space-x-2 text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        <span>Completed</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>Failed</span>
                      </div>
                    )}
                  </div>
                  {file.progress !== undefined && file.progress < 100 && (
                    <div className="col-span-12">
                      <div className="w-full bg-[#1E293B] rounded-full h-1">
                        <div
                          className="bg-primary-400 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
=======
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
>>>>>>> Stashed changes
          </div>
        </div>
      </main>
    </div>
  );
}

<<<<<<< Updated upstream
export default Upload;
=======
export default UploadPage;
>>>>>>> Stashed changes
