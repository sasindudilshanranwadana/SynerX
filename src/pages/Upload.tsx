import React from 'react';
import {
  FileVideo, AlertCircle, CheckCircle,
  Clock, Download, Trash2, Activity,
  Info, Timer, FileCheck, RefreshCw, X
} from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ServerStatusIndicator from '../components/ServerStatusIndicator';
import { 
  processVideoWithDatabase, 
  startRunPodProcessing, 
  clearCompletedRunPodJobs, 
  shutdownAllRunPodJobs, 
  shutdownSpecificRunPodJob 
} from '../lib/api';
import { Video, Job, JobsSummary, JobsResponse, StreamFrame } from '../lib/types';
import { getStoredTheme } from '../lib/theme';

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm'
];

const RUNPOD_API_BASE = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';

// User-friendly error messages
const getErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected error occurred';
  
  const errorMessage = error.message || error.toString();
  
  // Network errors
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
    return 'Unable to connect to the processing server. Please check your internet connection and try again.';
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
    return 'The request took too long to complete. Please try again.';
  }
  
  // Server errors
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return 'The processing server is experiencing issues. Please try again in a few minutes.';
  }
  
  if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
    return 'The requested service is not available. Please contact support if this continues.';
  }
  
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'Access denied. Please check your permissions or contact support.';
  }
  
  // WebSocket errors
  if (errorMessage.includes('WebSocket')) {
    return 'Connection to the processing server was lost. Attempting to reconnect...';
  }
  
  // File upload errors
  if (errorMessage.includes('file') || errorMessage.includes('upload')) {
    return 'Failed to upload the file. Please check the file format and try again.';
  }
  
  // Generic fallback with simplified message
  return 'Something went wrong. Please try again or contact support if the problem continues.';
};

// Enhanced notification system
interface NotificationState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

function UploadPage() {
  const [isDragging, setIsDragging] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');
  const [uploadedVideos, setUploadedVideos] = React.useState<Video[]>([]);
  const [uploading, setUploading] = React.useState(false);
  
  // Enhanced notification state
  const [notification, setNotification] = React.useState<NotificationState>({
    show: false,
    message: '',
    type: 'info'
  });
  
  // Job Dashboard State
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [jobsSummary, setJobsSummary] = React.useState<JobsSummary>({
    total_jobs: 0,
    queue_length: 0,
    queue_processor_running: false
  });
  const [uploadStatus, setUploadStatus] = React.useState('');
  
  // Stream Modal State
  const [streamModalOpen, setStreamModalOpen] = React.useState(false);
  const [currentStreamJobId, setCurrentStreamJobId] = React.useState<string | null>(null);
  const [streamFrame, setStreamFrame] = React.useState<string | null>(null);
  const [streamStatus, setStreamStatus] = React.useState('Connecting...');
  
  // Connection status state
  const [runpodConnected, setRunpodConnected] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [connectionError, setConnectionError] = React.useState<string>('');
  
  // WebSocket References
  const jobsWSRef = React.useRef<WebSocket | null>(null);
  const streamWSRef = React.useRef<WebSocket | null>(null);
  const shouldReconnectRef = React.useRef<boolean>(true);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    
    // Start jobs WebSocket connection
    startJobsSocket();
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      shouldReconnectRef.current = false;
      clearNotificationTimeout();
      if (jobsWSRef.current) {
        jobsWSRef.current.close();
      }
      if (streamWSRef.current) {
        streamWSRef.current.close();
      }
    };
  }, []);

  // Notification timeout ref
  const notificationTimeoutRef = React.useRef<NodeJS.Timeout>();

  const clearNotificationTimeout = () => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
  };

  const showNotification = (message: string, type: NotificationState['type'] = 'info', duration: number = 5000) => {
    clearNotificationTimeout();
    
    setNotification({
      show: true,
      message,
      type,
      duration
    });

    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, duration);
  };

  const startJobsSocket = () => {
    setConnectionStatus('connecting');
    setRunpodConnected(false);
    setConnectionError('');
    
    try {
      if (jobsWSRef.current) {
        jobsWSRef.current.close();
        jobsWSRef.current = null;
      }
    } catch (e) {
      console.error('Error closing existing WebSocket:', e);
    }
    
    const wsUrl = RUNPOD_API_BASE.replace(/^http/, 'ws') + '/ws/jobs';
    jobsWSRef.current = new WebSocket(wsUrl);
    
    jobsWSRef.current.onopen = () => {
      console.log('Jobs WebSocket connected');
      setConnectionStatus('connected');
      setRunpodConnected(true);
      setConnectionError('');
      showNotification('Successfully connected to processing server', 'success', 3000);
    };
    
    jobsWSRef.current.onmessage = (evt) => {
      try {
        const payload: JobsResponse = JSON.parse(evt.data);
        if (payload && payload.status === 'success') {
          setJobsSummary(payload.summary);
          setJobs(payload.all_jobs || []);
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };
    
    jobsWSRef.current.onerror = (error) => {
      const errorMsg = getErrorMessage(error);
      setConnectionStatus('error');
      setRunpodConnected(false);
      setConnectionError(errorMsg);
      
      // Attempt reconnection after 3 seconds if component is still mounted
      if (shouldReconnectRef.current) {
        setTimeout(() => {
          if (shouldReconnectRef.current) {
            console.log('Attempting to reconnect to jobs WebSocket...');
            startJobsSocket();
          }
        }, 3000);
      }
    };
    
    jobsWSRef.current.onclose = () => {
      console.log('Jobs WebSocket closed');
      setConnectionStatus('disconnected');
      setRunpodConnected(false);
      
      if (shouldReconnectRef.current) {
        setConnectionError('Connection lost. Attempting to reconnect...');
      }
      
      // Attempt reconnection after 3 seconds if component is still mounted
      if (shouldReconnectRef.current) {
        setTimeout(() => {
          if (shouldReconnectRef.current) {
            console.log('Attempting to reconnect to jobs WebSocket...');
            startJobsSocket();
          }
        }, 3000);
      }
    };
  };

  const openStream = (jobId: string) => {
    setCurrentStreamJobId(jobId);
    setStreamModalOpen(true);
    setStreamFrame(null);
    setStreamStatus('Connecting...');
    
    try {
      if (streamWSRef.current) {
        streamWSRef.current.close();
        streamWSRef.current = null;
      }
    } catch (e) {
      console.error('Error closing existing stream WebSocket:', e);
    }
    
    const wsUrl = RUNPOD_API_BASE.replace(/^http/, 'ws') + `/ws/video-stream/${encodeURIComponent(jobId)}`;
    streamWSRef.current = new WebSocket(wsUrl);
    
    streamWSRef.current.onopen = () => {
      setStreamStatus('Connected. Waiting for frames...');
    };
    
    streamWSRef.current.onmessage = (evt) => {
      try {
        const msg: StreamFrame = JSON.parse(evt.data);
        if (msg.type === 'frame' && msg.frame_data) {
          setStreamFrame(msg.frame_data);
        }
      } catch (e) {
        console.error('Error parsing stream message:', e);
      }
    };
    
    streamWSRef.current.onerror = () => {
      setStreamStatus('WebSocket error.');
    };
    
    streamWSRef.current.onclose = () => {
      setStreamStatus('Disconnected.');
    };
  };

  const closeStream = () => {
    setStreamModalOpen(false);
    setCurrentStreamJobId(null);
    setStreamFrame(null);
    
    try {
      if (streamWSRef.current) {
        streamWSRef.current.close();
        streamWSRef.current = null;
      }
    } catch (e) {
      console.error('Error closing stream WebSocket:', e);
    }
  };

  const clearCompleted = async () => {
    try {
      await clearCompletedRunPodJobs();
      showNotification('Completed jobs cleared successfully', 'success');
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      console.error('Error clearing completed jobs:', errorMsg);
      showNotification(errorMsg, 'error');
    }
  };

  const shutdownAny = async () => {
    if (!confirm('Are you sure you want to shutdown the current processing job? This action cannot be undone.')) return;
    try {
      await shutdownAllRunPodJobs();
      showNotification('Processing jobs shutdown successfully', 'success');
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      console.error('Error shutting down jobs:', errorMsg);
      showNotification(errorMsg, 'error');
    }
  };

  const shutdownJob = async (jobId: string) => {
    if (!confirm(`Are you sure you want to shutdown job ${jobId}? This action cannot be undone.`)) return;
    try {
      await shutdownSpecificRunPodJob(jobId);
      showNotification(`Job ${jobId} shutdown successfully`, 'success');
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      console.error('Error shutting down job:', errorMsg);
      showNotification(errorMsg, 'error');
    }
  };

  const formatElapsed = (sec: number): string => {
    const s = Math.floor(sec % 60);
    const m = Math.floor(sec / 60) % 60;
    const h = Math.floor(sec / 3600);
    return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const truncate = (str: string, n: number): string => {
    return str && str.length > n ? str.slice(0, n - 1) + '…' : str || '';
  };

  const getPillClass = (status: Job['status']): string => {
    const classes = {
      queued: 'bg-blue-500/10 text-blue-400',
      processing: 'bg-yellow-500/10 text-yellow-400',
      completed: 'bg-green-500/10 text-green-400',
      failed: 'bg-red-500/10 text-red-400',
      cancelled: 'bg-gray-500/10 text-gray-400'
    };
    return classes[status] || classes.queued;
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Check RunPod connection before allowing upload
    if (!runpodConnected) {
      showNotification('Cannot upload files because the processing server is not connected. Please wait for the connection to be restored or refresh the page.', 'error');
      return;
    }

    setUploading(true);
    setUploadStatus('Uploading...');
    
    try {
      for (const file of files) {
        if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
          const errorMsg = `The file "${file.name}" is not a supported video format. Please use MP4, MOV, AVI, MKV, or WebM files.`;
          showNotification(errorMsg, 'error');
          setUploadStatus(errorMsg);
          continue;
        }

        const videoName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const { video } = await processVideoWithDatabase(file, videoName);
        
        setUploadedVideos(prev => [video, ...prev]);
        
        // Start RunPod processing
        try {
          const result = await startRunPodProcessing(video);
          setUploadStatus(`Queued job ${result.job_id} (pos ${result.queue_position})`);
          showNotification(`Successfully uploaded "${file.name}" and added to processing queue`, 'success');
        } catch (runpodError) {
          const errorMsg = getErrorMessage(runpodError);
          console.error('RunPod processing error:', errorMsg);
          setUploadStatus(`Upload successful, but processing failed: ${errorMsg}`);
          showNotification(`Uploaded "${file.name}" but failed to start processing: ${errorMsg}`, 'warning');
        }
      }
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      console.error('Upload error:', errorMsg);
      showNotification(`Upload failed: ${errorMsg}`, 'error');
      setUploadStatus(`Upload failed: ${errorMsg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  return (
    <div className={`min-h-screen ${
      isDark ? 'bg-[#0B1121] text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <ServerStatusIndicator />

      {/* Enhanced Notification System */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-start space-x-3 max-w-md ${
          notification.type === 'success' ? 'bg-green-500' : 
          notification.type === 'error' ? 'bg-red-500' : 
          notification.type === 'warning' ? 'bg-yellow-500' : 
          'bg-blue-500'
        }`}>
          <div className="flex-shrink-0 mt-0.5">
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
             notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
             notification.type === 'warning' ? <AlertCircle className="w-5 h-5" /> : 
             <Info className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <span className="text-white text-sm leading-relaxed">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(prev => ({ ...prev, show: false }))}
            className="flex-shrink-0 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Header title="Video Upload" onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isSidebarOpen={sidebarOpen} />
      <Sidebar activePath="/upload" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">Upload Video for Analysis</h1>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Supported formats: MP4, MOV, AVI, MKV, WebM
            </p>
          </div>

          {/* Upload Section */}
          <div 
            className={`border-2 border-dashed rounded-xl p-12 mb-8 text-center transition-colors ${
              isDragging 
                ? 'border-primary-500 bg-primary-500/10' 
                : uploading
                ? 'border-yellow-400 bg-yellow-400/10'
                : isDark
                ? 'border-gray-600 bg-gray-800/20 hover:border-gray-500'
                : 'border-gray-300 bg-gray-100/50 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_VIDEO_TYPES.join(',')}
              multiple
              onChange={e => {
                handleFiles(e.target.files ? Array.from(e.target.files) : []);
              }}
              disabled={uploading}
              hidden
            />
            
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold mb-2 text-yellow-400">Uploading...</h3>
                <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Please wait while your video is being uploaded</p>
              </>
            ) : isDragging ? (
              <>
                <FileVideo className="w-12 h-12 mx-auto mb-4 text-primary-500" />
                <h3 className="text-xl font-semibold mb-2 text-primary-500">Drop your videos here</h3>
                <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Release to upload your video files</p>
              </>
            ) : (
              <>
                <FileVideo className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <h3 className="text-xl font-semibold mb-2">Upload Videos for Analysis</h3>
                <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Drag and drop your video files here, or click to browse</p>
              </>
            )}
            
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  uploading || !runpodConnected
                    ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                }`}
                disabled={uploading || !runpodConnected}
                title={!runpodConnected ? 'RunPod server not connected' : ''}
              >
                {uploading ? 'Uploading...' : !runpodConnected ? 'Server Disconnected' : 'Upload & Queue'}
              </button>
              {uploadStatus && (
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {uploadStatus}
                </span>
              )}
            </div>
          </div>

          {/* Jobs Dashboard */}
          <div className={`rounded-xl p-6 mb-8 ${
            isDark 
              ? 'bg-[#151F32]' 
              : 'bg-white shadow-lg border border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">Jobs</h2>
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total: {jobsSummary.total_jobs} | Queue: {jobsSummary.queue_length} | Running: {jobsSummary.queue_processor_running ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Auto-refresh: <span className="text-green-400">On</span>
                </span>
                <button
                  onClick={startJobsSocket}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark 
                      ? 'bg-[#1E293B] hover:bg-[#2D3B4E] text-gray-300' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={clearCompleted}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    isDark 
                      ? 'bg-[#1E293B] hover:bg-[#2D3B4E] text-gray-300' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Clear Completed
                </button>
              </div>
            </div>

            {/* Jobs Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Job ID</th>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>File</th>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</th>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Progress</th>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Message</th>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Elapsed</th>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs
                    .sort((a, b) => (a.status === 'processing' ? -1 : 1))
                    .map((job) => {
                      const progress = Math.max(0, Math.min(100, Math.round(job.progress || 0)));
                      return (
                        <tr key={job.job_id} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <td className={`py-3 px-4 font-mono text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {job.job_id}
                          </td>
                          <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} title={job.file_name}>
                            {truncate(job.file_name, 36)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPillClass(job.status)}`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className={`w-full bg-gray-200 rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              <div 
                                className="bg-primary-500 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`} title={job.message || ''}>
                            {truncate(job.message || '', 40)}
                          </td>
                          <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {formatElapsed(job.elapsed_time)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => shutdownJob(job.job_id)}
                                className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                              >
                                Shutdown
                              </button>
                              {job.status === 'processing' && (
                                <button
                                  onClick={() => openStream(job.job_id)}
                                  className="px-2 py-1 text-xs bg-primary-500 hover:bg-primary-600 text-white rounded transition-colors"
                                >
                                  Stream
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {jobs.length === 0 && (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  No jobs found. Upload a video to get started.
                </div>
              )}
            </div>
          </div>

          {/* Stream Modal */}
          {streamModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
              <div className={`rounded-xl p-4 w-full max-w-4xl mx-4 ${
                isDark 
                  ? 'bg-[#151F32] border border-[#1E293B]' 
                  : 'bg-white border border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Live Stream - Job {currentStreamJobId}</h3>
                  <button
                    onClick={closeStream}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark 
                        ? 'hover:bg-[#1E293B] text-gray-300' 
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="bg-black rounded-lg flex items-center justify-center min-h-[360px]">
                  {streamFrame ? (
                    <img
                      src={`data:image/jpeg;base64,${streamFrame}`}
                      alt="Live stream"
                      className="max-w-full h-auto rounded"
                    />
                  ) : (
                    <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {streamStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recently Uploaded Videos List */}
          {uploadedVideos.length > 0 && (
            <div className={`rounded-xl p-6 ${
              isDark 
                ? 'bg-[#151F32]' 
                : 'bg-white shadow-lg border border-gray-200'
            }`}>
              <h2 className="text-xl font-semibold mb-4">Recently Uploaded Videos</h2>
              <div className="space-y-3">
                {uploadedVideos.map((video) => (
                  <div key={video.id} className={`flex items-center justify-between p-4 rounded-lg ${
                    isDark ? 'bg-[#1E293B]' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <FileVideo className="w-5 h-5 text-primary-500" />
                      <div>
                        <h3 className="font-medium">{video.video_name}</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {video.original_filename} • {video.file_size ? `${(video.file_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown size'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        video.status === 'uploaded' ? 'bg-blue-500/10 text-blue-400' :
                        video.status === 'processing' ? 'bg-yellow-500/10 text-yellow-400' :
                        video.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                        video.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                        isDark ? 'bg-gray-500/10 text-gray-400' : 'bg-gray-500/10 text-gray-600'
                      }`}>
                        {video.status?.charAt(0).toUpperCase() + video.status?.slice(1) || 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default UploadPage;