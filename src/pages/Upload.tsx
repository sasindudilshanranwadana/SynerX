import React from 'react';
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

  const showNotification = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

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
      }
    }

    setUploading(false);
  };

  const filteredFiles = files.filter(file => {
    const matchesDate = !filterDate || new Date(file.uploadDate).toDateString() === new Date(filterDate).toDateString();
    const matchesType = !filterType || file.violationType === filterType;
    return matchesDate && matchesType;
  });

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      {/* Toast Notification */}
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
          toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toastType === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

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
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Browse Files'}
            </button>
          </div>

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
          </div>
        </div>
      </main>
    </div>
  );
}

export default Upload;