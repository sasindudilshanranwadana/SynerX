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
  createVideoMetadataRecord,
  startRunPodProcessingDirect,
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

const getErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected error occurred';

  const errorMessage = error.message || error.toString();

  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
    return 'Unable to connect to the processing server. Please check your internet connection and try again.';
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
    return 'The request took too long to complete. Please try again.';
  }

  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return 'The processing server is experiencing issues. Please try again in a few minutes.';
  }

  if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
    return 'The requested service is not available. Please contact support if this continues.';
  }

  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'Access denied. Please check your permissions or contact support.';
  }

  if (errorMessage.includes('WebSocket')) {
    return 'Connection to the processing server was lost. Attempting to reconnect...';
  }

  if (errorMessage.includes('file') || errorMessage.includes('upload')) {
    return 'Failed to upload the file. Please check the file format and try again.';
  }

  return 'Something went wrong. Please try again or contact support if the problem continues.';
};

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

  const [notification, setNotification] = React.useState<NotificationState>({
    show: false,
    message: '',
    type: 'info'
  });

  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [jobsSummary, setJobsSummary] = React.useState<JobsSummary>({
    total_jobs: 0,
    queue_length: 0,
    queue_processor_running: false
  });
  const [uploadStatus, setUploadStatus] = React.useState('');
  const [currentUploadFileName, setCurrentUploadFileName] = React.useState('');
  const [currentUploadFileSize, setCurrentUploadFileSize] = React.useState(0);

  const [streamModalOpen, setStreamModalOpen] = React.useState(false);
  const [currentStreamJobId, setCurrentStreamJobId] = React.useState<string | null>(null);
  const [streamFrame, setStreamFrame] = React.useState<string | null>(null);
  const [streamStatus, setStreamStatus] = React.useState('Connecting...');

  const [runpodConnected, setRunpodConnected] = React.useState(false);
  const [runpodUrlAvailable, setRunpodUrlAvailable] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [connectionError, setConnectionError] = React.useState<string>('');

  const jobsWSRef = React.useRef<WebSocket | null>(null);
  const streamWSRef = React.useRef<WebSocket | null>(null);
  const shouldReconnectRef = React.useRef<boolean>(true);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploading) {
        e.preventDefault();
        e.returnValue = 'Your video is still uploading. Are you sure you want to leave? The upload will be cancelled.';
        return e.returnValue;
      }
    };

    window.addEventListener('themeChanged', handleThemeChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    checkRunPodUrl();
    startJobsSocket();

    // Check RunPod URL availability every 30 seconds
    const urlCheckInterval = setInterval(checkRunPodUrl, 30000);

    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      shouldReconnectRef.current = false;
      clearNotificationTimeout();
      clearInterval(urlCheckInterval);
      if (jobsWSRef.current) {
        jobsWSRef.current.close();
      }
      if (streamWSRef.current) {
        streamWSRef.current.close();
      }
    };
  }, [uploading]);

  const notificationTimeoutRef = React.useRef<NodeJS.Timeout>();

  const clearNotificationTimeout = () => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
  };

  const checkRunPodUrl = async () => {
    try {
      const runpodUrl = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
      const response = await fetch(`${runpodUrl}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        setRunpodUrlAvailable(true);
        console.log('RunPod URL is available');
      } else {
        setRunpodUrlAvailable(false);
        console.log('RunPod URL is not responding');
      }
    } catch (error) {
      setRunpodUrlAvailable(false);
      console.log('RunPod URL is not available:', error);
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

    const runpodUrl = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
    const wsUrl = runpodUrl.replace(/^http/, 'ws') + '/ws/jobs';
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

    const runpodUrl = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
    const wsUrl = runpodUrl.replace(/^http/, 'ws') + `/ws/video-stream/${encodeURIComponent(jobId)}`;
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
    if (!confirm('Are you sure you want to delete the current processing job? This action cannot be undone.')) return;
    try {
      await shutdownAllRunPodJobs();
      showNotification('Processing jobs deleted successfully', 'success');
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      console.error('Error deleting jobs:', errorMsg);
      showNotification(errorMsg, 'error');
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm(`Are you sure you want to delete job ${jobId}? This action cannot be undone.`)) return;
    try {
      await shutdownSpecificRunPodJob(jobId);
      showNotification(`Job ${jobId} deleted successfully`, 'success');
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      console.error('Error deleting job:', errorMsg);
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

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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

    if (!runpodConnected) {
      showNotification('Cannot upload files because the processing server is not connected. Please wait for the connection to be restored or refresh the page.', 'error');
      return;
    }

    setUploading(true);
    setUploadStatus('Preparing upload...');
    setCurrentUploadFileName('');
    setCurrentUploadFileSize(0);

    try {
      for (const file of files) {
        if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
          const errorMsg = `The file "${file.name}" is not a supported video format. Please use MP4, MOV, AVI, MKV, or WebM files.`;
          showNotification(errorMsg, 'error');
          setUploadStatus(errorMsg);
          continue;
        }

        const videoName = file.name.replace(/\.[^/.]+$/, '');
        setCurrentUploadFileName(file.name);
        setCurrentUploadFileSize(file.size);
        setUploadStatus('Uploading video to server...');

        const result = await startRunPodProcessingDirect(file, videoName, () => {
          // Progress callback - keeping it for API compatibility but not using percentage
        });

        const video = await createVideoMetadataRecord(file, videoName, result.original_url);

        setUploadedVideos(prev => [video, ...prev]);

        setUploadStatus(`Successfully queued job ${result.job_id}`);
        showNotification(`Successfully uploaded "${file.name}" and added to processing queue`, 'success', 5000);

        setCurrentUploadFileName('');
        setCurrentUploadFileSize(0);
      }
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      console.error('Processing error:', errorMsg);
      showNotification(`Upload failed: ${errorMsg}`, 'error', 8000);
      setUploadStatus(`Upload failed: ${errorMsg}`);
    } finally {
      setUploading(false);
      setCurrentUploadFileName('');
      setCurrentUploadFileSize(0);
      setUploadStatus('');
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

      {uploading && (
        <div className="lg:ml-64 mt-16 lg:mt-0">
          <div className={`px-4 py-3 ${isDark ? 'bg-yellow-500/20 border-yellow-500/40' : 'bg-yellow-100 border-yellow-300'} border-b`}>
            <div className="max-w-6xl mx-auto flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <p className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                  Upload in Progress - Please do not close or refresh this page
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-xl sm:text-2xl font-bold mb-2">Upload Video for Analysis</h1>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Supported formats: MP4, MOV, AVI, MKV, WebM
            </p>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-6 sm:p-8 md:p-12 mb-8 text-center transition-colors ${
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
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-t-4 border-yellow-400 mx-auto mb-6"></div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 text-yellow-400">
                  Uploading Video...
                </h3>
                {currentUploadFileName && (
                  <p className={`mb-2 text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <span className="font-medium">{currentUploadFileName}</span>
                    {currentUploadFileSize > 0 && (
                      <span> ({formatBytes(currentUploadFileSize)})</span>
                    )}
                  </p>
                )}
                <p className={`mb-2 text-base sm:text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Video is uploading. Please stay tuned!
                </p>
                <p className={`mb-4 text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Do not close or refresh this page while uploading.
                </p>
                <div className={`mt-4 px-4 py-3 rounded-lg ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'} border ${isDark ? 'border-yellow-500/20' : 'border-yellow-200'}`}>
                  <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                    <strong>Please wait:</strong> Large files may take several minutes to upload. Your video will be automatically added to the processing queue once complete.
                  </p>
                </div>
              </>
            ) : isDragging ? (
              <>
                <FileVideo className="w-12 h-12 mx-auto mb-4 text-primary-500" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-primary-500">Drop your videos here</h3>
                <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Release to upload your video files</p>
              </>
            ) : (
              <>
                <FileVideo className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Upload Videos for Analysis</h3>
                <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Drag and drop your video files here, or click to browse</p>
              </>
            )}

            {!uploading && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-4 sm:px-6 py-2 rounded-lg transition-colors text-sm sm:text-base ${
                    !runpodConnected || !runpodUrlAvailable
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }`}
                  disabled={!runpodConnected || !runpodUrlAvailable}
                  title={!runpodConnected ? 'WebSocket not connected' : !runpodUrlAvailable ? 'RunPod URL not available' : ''}
                >
                  {!runpodConnected ? 'WebSocket Disconnected' : !runpodUrlAvailable ? 'RunPod URL Unavailable' : 'Select Video to Upload'}
                </button>
              </div>
            )}
          </div>

          <div className={`rounded-xl p-6 mb-8 ${
            isDark
              ? 'bg-[#151F32]'
              : 'bg-white shadow-lg border border-gray-200'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 sm:gap-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <h2 className="text-lg sm:text-xl font-semibold">Jobs</h2>
                <span className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total: {jobsSummary.total_jobs} | Queue: {jobsSummary.queue_length} | Running: {jobsSummary.queue_processor_running ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Auto-refresh: <span className="text-green-400">On</span>
                </span>
                <div className="flex items-center gap-2">
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
                    className={`px-2 sm:px-3 py-2 text-xs sm:text-sm rounded-lg transition-colors ${
                      isDark
                        ? 'bg-[#1E293B] hover:bg-[#2D3B4E] text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    Clear Completed
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <th className={`text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Job ID</th>
                    <th className={`text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>File</th>
                    <th className={`text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</th>
                    <th className={`text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Progress</th>
                    <th className={`text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Message</th>
                    <th className={`text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Elapsed</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs
                    .sort((a, b) => (a.status === 'processing' ? -1 : 1))
                    .map((job) => {
                      const progress = Math.max(0, Math.min(100, Math.round(job.progress || 0)));
                      return (
                        <tr key={job.job_id} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 font-mono text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {job.job_id}
                          </td>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`} title={job.file_name}>
                            {truncate(job.file_name, 36)}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPillClass(job.status)}`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <div className={`w-full bg-gray-200 rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              <div
                                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`} title={job.message || ''}>
                            {truncate(job.message || '', 40)}
                          </td>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {formatElapsed(job.elapsed_time)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {jobs.length === 0 && (
                <div className={`text-center py-6 sm:py-8 text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  No jobs found. Upload a video to get started.
                </div>
              )}
            </div>
          </div>

          {streamModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className={`rounded-xl p-4 sm:p-6 w-full max-w-4xl ${
                isDark
                  ? 'bg-[#151F32] border border-[#1E293B]'
                  : 'bg-white border border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold truncate pr-4">Live Stream - Job {currentStreamJobId}</h3>
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
                <div className="bg-black rounded-lg flex items-center justify-center min-h-[200px] sm:min-h-[300px] md:min-h-[360px]">
                  {streamFrame ? (
                    <img
                      src={`data:image/jpeg;base64,${streamFrame}`}
                      alt="Live stream"
                      className="max-w-full max-h-full h-auto rounded object-contain"
                    />
                  ) : (
                    <div className={`text-center text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {streamStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {uploadedVideos.length > 0 && (
            <div className={`rounded-xl p-6 ${
              isDark
                ? 'bg-[#151F32]'
                : 'bg-white shadow-lg border border-gray-200'
            }`}>
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Recently Uploaded Videos</h2>
              <div className="space-y-3">
                {uploadedVideos.map((video) => (
                  <div key={video.id} className={`flex items-center justify-between p-4 rounded-lg ${
                    isDark ? 'bg-[#1E293B]' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileVideo className="w-5 h-5 text-primary-500" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm sm:text-base truncate">{video.video_name}</h3>
                        <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {video.original_filename} • {video.file_size ? `${(video.file_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown size'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        video.status === 'uploaded' ? 'bg-blue-500/10 text-blue-400' :
                        video.status === 'processing' ? 'bg-yellow-500/10 text-yellow-400' :
                        video.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                        video.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                        isDark ? 'bg-gray-500/10 text-gray-400' : 'bg-gray-500/10 text-gray-600'
                      } whitespace-nowrap`}>
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
