import React from 'react';
import { 
  HardDrive, 
  Trash2, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileVideo,
  RefreshCw,
  BarChart3,
  Eye,
  X,
  XCircle,
  Info
} from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ServerStatusIndicator from '../components/ServerStatusIndicator';
import { getStoredTheme } from '../lib/theme';
import { fetchJSON } from '../lib/api';
import { supabase } from '../lib/supabase';

// Use Vite dev proxy in development; backend is mounted at /api
const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000');

interface VideoFile {
  id: string;
  name: string;
  size: number; // in bytes
  created_at: string;
  status: 'processed' | 'processing' | 'failed' | 'temp' | 'interrupted';
  duration?: number;
  resolution?: string;
  path: string;
}

interface StorageInfo {
  total: number; // in bytes
  used: number; // in bytes
  free: number; // in bytes
  temp_files: number; // count of temp files
  temp_size: number; // size of temp files in bytes
}

function Storage() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');
  const [loading, setLoading] = React.useState(true);
  const [storageInfo, setStorageInfo] = React.useState<StorageInfo>({
    total: 0,
    used: 0,
    free: 0,
    temp_files: 0,
    temp_size: 0
  });
  const [videos, setVideos] = React.useState<VideoFile[]>([]);
  const [selectedVideos, setSelectedVideos] = React.useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showCleanupModal, setShowCleanupModal] = React.useState(false);
  const [showVideoModal, setShowVideoModal] = React.useState(false);
  const [selectedVideo, setSelectedVideo] = React.useState<VideoFile | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = React.useState<string | null>(null);
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{message: string, type: 'success' | 'error'} | null>(null);

  React.useEffect(() => {
    loadStorageData();
    
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, []);

  const loadStorageData = async () => {
    try {
      setLoading(true);
      
      // Load storage info
      const storageData = await fetchJSON('/storage/info');
      
      if (storageData.status === 'success') {
        setStorageInfo(storageData.data);
      }
      
      // Load video files
      const videosData = await fetchJSON('/storage/videos');
      
      if (videosData.status === 'success') {
        setVideos(videosData.data);
      }
      
      setError(null);
    } catch (err: any) {
      setError('Failed to load storage data. Please try again.');
      console.error('Storage loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: VideoFile['status']) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'interrupted':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'temp':
        return <FileVideo className="w-4 h-4 text-orange-500" />;
      default:
        return <FileVideo className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: VideoFile['status']) => {
    const colors = {
      processed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      temp: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      interrupted: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getDisplayStatus = (video: VideoFile): VideoFile['status'] => {
    if (video.name.toLowerCase().includes('interrupted')) return 'interrupted';
    return video.status;
  };

  const handleSelectVideo = (videoId: string) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const handleSelectAll = () => {
    if (selectedVideos.length === videos.length) {
      setSelectedVideos([]);
    } else {
      setSelectedVideos(videos.map(v => v.id));
    }
  };

  const handleDeleteVideos = async () => {
    try {
      // Get the original filenames from the selected videos
      const selectedVideoNames = videos
        .filter(v => selectedVideos.includes(v.id))
        .map(v => v.name); // Use the original filename, not the unique ID
      
      const result = await fetchJSON('/storage/videos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: selectedVideoNames })
      });
      
      if (result.status === 'success') {
        setVideos(prev => prev.filter(v => !selectedVideos.includes(v.id)));
        setSelectedVideos([]);
        setShowDeleteModal(false);
        await loadStorageData(); // Refresh storage info
        showToast(`Successfully deleted ${result.deleted_files?.length || selectedVideos.length} video(s)`, 'success');
      } else {
        setError(result.error || 'Failed to delete videos');
        showToast('Failed to delete videos', 'error');
      }
    } catch (err: any) {
      setError('Failed to delete videos. Please try again.');
    }
  };

  const handleCleanupTempFiles = async () => {
    try {
      const result = await fetchJSON('/storage/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (result.status === 'success') {
        setShowCleanupModal(false);
        await loadStorageData(); // Refresh storage info
        showToast(`Successfully cleaned up ${result.cleaned_files?.length || 0} temporary files`, 'success');
      } else {
        setError(result.error || 'Failed to cleanup temporary files');
        showToast('Failed to cleanup temporary files', 'error');
      }
    } catch (err: any) {
      setError('Failed to cleanup temporary files. Please try again.');
    }
  };

  const handleDownloadVideo = async (video: VideoFile) => {
    try {
      const headers = new Headers();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userToken = (session as any)?.access_token as string | undefined;
        if (userToken) {
          headers.set('Authorization', `Bearer ${userToken}`);
        }
      } catch {}
      const response = await fetch(`${API_BASE}/storage/video/${encodeURIComponent(video.name)}/download`, { headers });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = video.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast('Failed to download video', 'error');
    }
  };

  const handleViewVideo = (video: VideoFile) => {
    // Open video in modal
    setSelectedVideo(video);
    setShowVideoModal(true);
  };

  // Fetch signed URL first for faster progressive streaming; fallback to blob with auth
  React.useEffect(() => {
    let isCancelled = false;
    const fetchVideoBlob = async () => {
      if (!showVideoModal || !selectedVideo) return;
      try {
        // Try signed URL
        const sig = await fetchJSON(`/storage/video/${encodeURIComponent(selectedVideo.name)}/signed?expires_in=300`);
        if (sig?.status === 'success' && sig.url) {
          if (isCancelled) return;
          setSignedUrl(sig.url as string);
          setVideoBlobUrl(null);
          return;
        }
        // Fallback to auth fetch blob
        const headers = new Headers();
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userToken = (session as any)?.access_token as string | undefined;
          if (userToken) headers.set('Authorization', `Bearer ${userToken}`);
        } catch {}
        const response = await fetch(`${API_BASE}/storage/video/${encodeURIComponent(selectedVideo.name)}`, { headers });
        if (!response.ok) throw new Error('Failed to load video');
        const blob = await response.blob();
        if (isCancelled) return;
        const url = URL.createObjectURL(blob);
        setSignedUrl(null);
        setVideoBlobUrl(url);
      } catch (e) {
        // Fallback to direct URL; player may still work if public
        setSignedUrl(null);
        setVideoBlobUrl(null);
      }
    };

    fetchVideoBlob();
    return () => {
      isCancelled = true;
      if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
      setSignedUrl(null);
    };
  }, [showVideoModal, selectedVideo]);

  const closeVideoModal = () => {
    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    setVideoBlobUrl(null);
    setShowVideoModal(false);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const storageUsagePercentage = storageInfo.total > 0 ? (storageInfo.used / storageInfo.total) * 100 : 0;
  const tempFilesPercentage = storageInfo.used > 0 ? (storageInfo.temp_size / storageInfo.used) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header title="Storage" onToggleSidebar={() => setSidebarOpen(s => !s)} isSidebarOpen={sidebarOpen} />
        <Sidebar activePath="/storage" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
            <span className="text-lg font-medium">Loading storage data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="Storage" onToggleSidebar={() => setSidebarOpen(s => !s)} isSidebarOpen={sidebarOpen} />
      <Sidebar activePath="/storage" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="p-6 ml-0 lg:ml-64">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <HardDrive className="w-8 h-8 text-primary-500" />
                  Storage Management
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Monitor storage usage and manage video files
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ServerStatusIndicator />
                <button
                  onClick={loadStorageData}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-red-700 dark:text-red-400">{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Storage Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Storage */}
            <div className={`p-6 rounded-xl ${isDark ? 'bg-[#151F32]' : 'bg-white shadow-lg border border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Storage</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatBytes(storageInfo.total)}
                  </p>
                </div>
                <HardDrive className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            {/* Used Storage */}
            <div className={`p-6 rounded-xl ${isDark ? 'bg-[#151F32]' : 'bg-white shadow-lg border border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Used Storage</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatBytes(storageInfo.used)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {storageUsagePercentage.toFixed(1)}% of total
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            {/* Free Storage */}
            <div className={`p-6 rounded-xl ${isDark ? 'bg-[#151F32]' : 'bg-white shadow-lg border border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Free Storage</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatBytes(storageInfo.free)}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>

            {/* Temp Files */}
            <div className={`p-6 rounded-xl ${isDark ? 'bg-[#151F32]' : 'bg-white shadow-lg border border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Temp Files</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {storageInfo.temp_files}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatBytes(storageInfo.temp_size)} ({tempFilesPercentage.toFixed(1)}%)
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </div>

          {/* Storage Usage Chart */}
          <div className={`p-6 rounded-xl mb-8 ${isDark ? 'bg-[#151F32]' : 'bg-white shadow-lg border border-gray-200'}`}>
            <h2 className="text-lg font-semibold mb-6">Storage Usage</h2>
            <div className="space-y-4">
              {/* Main storage bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Usage</span>
                  <span className="text-sm text-gray-500">{storageUsagePercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${storageUsagePercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Temp files bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Temporary Files</span>
                  <span className="text-sm text-gray-500">{tempFilesPercentage.toFixed(1)}% of used</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${tempFilesPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Video Files Management */}
          <div className={`p-6 rounded-xl mb-8 ${isDark ? 'bg-[#151F32]' : 'bg-white shadow-lg border border-gray-200'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Video Files</h2>
              <div className="flex items-center gap-3">
                {selectedVideos.length > 0 && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected ({selectedVideos.length})
                  </button>
                )}
                {storageInfo.temp_files > 0 && (
                  <button
                    onClick={() => setShowCleanupModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Cleanup Temp Files ({storageInfo.temp_files})
                  </button>
                )}
              </div>
            </div>

            {/* Video Files Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <th className="text-left px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedVideos.length === videos.length && videos.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Size</th>
                    <th className="text-left px-4 py-3 font-semibold">Duration</th>
                    <th className="text-left px-4 py-3 font-semibold">Created</th>
                    <th className="text-left px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((video) => (
                    <tr key={video.id} className={`border-b hover:bg-opacity-50 transition-colors ${
                      isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedVideos.includes(video.id)}
                          onChange={() => handleSelectVideo(video.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(getDisplayStatus(video))}
                          <div>
                            <div className="font-medium text-sm">{video.name}</div>
                            <div className="text-xs text-gray-500">{video.path}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(getDisplayStatus(video))}
                      </td>
                      <td className="px-4 py-4 text-sm font-mono">
                        {formatBytes(video.size)}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {video.duration ? formatDuration(video.duration) : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {new Date(video.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleViewVideo(video)}
                            className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                            title="View video"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDownloadVideo(video)}
                            className="p-1 text-gray-500 hover:text-green-500 transition-colors"
                            title="Download video"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-xl max-w-lg w-full mx-4 ${isDark ? 'bg-[#151F32]' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold">Delete Videos</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete <strong>{selectedVideos.length} video(s)</strong>? This action cannot be undone.
              </p>
              
              <div className={`p-4 rounded-lg border-l-4 border-yellow-400 ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Important Notice</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      <strong>Video files will be permanently deleted</strong> and cannot be streamed anymore. 
                      However, <strong>tracking data and analytics</strong> for these videos will remain in the database.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVideos}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete Videos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Confirmation Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-xl max-w-md w-full mx-4 ${isDark ? 'bg-[#151F32]' : 'bg-white'}`}>
            <h3 className="text-lg font-semibold mb-4">Cleanup Temporary Files</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This will delete {storageInfo.temp_files} temporary files and free up {formatBytes(storageInfo.temp_size)} of storage.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCleanupModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCleanupTempFiles}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Cleanup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className={`relative w-full max-w-4xl mx-4 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-xl overflow-hidden`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedVideo.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {(selectedVideo.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={closeVideoModal}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Video Player */}
            <div className="p-4">
              <video
                controls
                className="w-full h-auto max-h-96 rounded-lg"
                preload="metadata"
                src={signedUrl || videoBlobUrl || undefined}
              >
                Your browser does not support the video tag.
              </video>
              <div className={`mt-2 text-xs flex items-center justify-center gap-2 ${isDark ? 'text-yellow-300/90' : 'text-yellow-700'}`}>
                <Info className={`w-4 h-4 ${isDark ? 'text-yellow-300/90' : 'text-yellow-600'}`} />
                <span>Large videos may take a few seconds to start buffering on first play.</span>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-between p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Created: {new Date(selectedVideo.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadVideo(selectedVideo)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Storage;
