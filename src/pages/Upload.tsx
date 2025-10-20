import React from 'react';
import {
  FileVideo, AlertCircle, CheckCircle,
  Clock, Download, Trash2, Activity,
  Info, Timer, FileCheck, RefreshCw, X,
  Play, Video as VideoIcon, Copy, ExternalLink
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

const toUploadError = (err: unknown): string => {
  const msg = (err as any)?.message?.toString().toLowerCase() ?? '';

  if (msg.includes('network')) return 'Network error during upload';
  if (msg.includes('timeout')) return 'Upload timed out. Please try again.';
  if (msg.includes('abort')) return 'Upload was cancelled';

  return 'Failed to upload the file. Please check the file format and try again.';
};

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
  const [uploadStatus, setUploadStatus] = React.useState<'idle' | 'uploading' | 'failed' | 'cancelled' | 'success'>('idle');
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [wsError, setWsError] = React.useState(false);

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
  const [currentUploadFileName, setCurrentUploadFileName] = React.useState('');
  const [currentUploadFileSize, setCurrentUploadFileSize] = React.useState(0);

  const [streamModalOpen, setStreamModalOpen] = React.useState(false);
  const [currentStreamJobId, setCurrentStreamJobId] = React.useState<string | null>(null);
  const [streamFrame, setStreamFrame] = React.useState<string | null>(null);
  const [streamStatus, setStreamStatus] = React.useState('Connecting...');

  const [videoModalOpen, setVideoModalOpen] = React.useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = React.useState('');
  const [currentVideoJobId, setCurrentVideoJobId] = React.useState<string | null>(null);
  const [videoLoading, setVideoLoading] = React.useState(false);
  const [videoError, setVideoError] = React.useState<string | null>(null);
  const [playbackVideoModalOpen, setPlaybackVideoModalOpen] = React.useState(false);
  const [playbackVideoUrl, setPlaybackVideoUrl] = React.useState('');
  const [playbackVideoJobId, setPlaybackVideoJobId] = React.useState<string | null>(null);
  const [playbackVideoLoading, setPlaybackVideoLoading] = React.useState(false);
  const [playbackVideoError, setPlaybackVideoError] = React.useState<string | null>(null);

  const [runpodConnected, setRunpodConnected] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [connectionError, setConnectionError] = React.useState<string>('');

  const jobsWSRef = React.useRef<WebSocket | null>(null);
  const streamWSRef = React.useRef<WebSocket | null>(null);
  const shouldReconnectRef = React.useRef<boolean>(true);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoPlayerRef = React.useRef<HTMLVideoElement>(null);
  const playbackVideoPlayerRef = React.useRef<HTMLVideoElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;

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

    startJobsSocket();

    return () => {
      mountedRef.current = false;
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      shouldReconnectRef.current = false;
      clearNotificationTimeout();
      if (jobsWSRef.current) {
        try {
          jobsWSRef.current.close();
        } catch (e) {
          console.error('Error closing WebSocket:', e);
        }
      }
      if (streamWSRef.current) {
        try {
          streamWSRef.current.close();
        } catch (e) {
          console.error('Error closing stream WebSocket:', e);
        }
      }
    };
  }, [uploading]);

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

    const runpodUrl = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
    const wsUrl = runpodUrl.replace(/^http/, 'ws') + '/ws/jobs';
    jobsWSRef.current = new WebSocket(wsUrl);

    jobsWSRef.current.onopen = () => {
      console.log('Jobs WebSocket connected');
      if (!mountedRef.current) return;
      setConnectionStatus('connected');
      setRunpodConnected(true);
      setConnectionError('');
      setWsError(false);
      showNotification('Successfully connected to processing server', 'success', 3000);
    };

    jobsWSRef.current.onmessage = (evt) => {
      if (!mountedRef.current) return;
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
      if (!mountedRef.current) return;
      const errorMsg = getErrorMessage(error);
      setConnectionStatus('error');
      setRunpodConnected(false);
      setConnectionError(errorMsg);
      setWsError(true);

      if (shouldReconnectRef.current) {
        setTimeout(() => {
          if (shouldReconnectRef.current && mountedRef.current) {
            console.log('Attempting to reconnect to jobs WebSocket...');
            startJobsSocket();
          }
        }, 3000);
      }
    };

    jobsWSRef.current.onclose = () => {
      console.log('Jobs WebSocket closed');
      if (!mountedRef.current) return;
      setConnectionStatus('disconnected');
      setRunpodConnected(false);

      if (shouldReconnectRef.current) {
        setConnectionError('Connection lost. Attempting to reconnect...');
      }

      if (shouldReconnectRef.current) {
        setTimeout(() => {
          if (shouldReconnectRef.current && mountedRef.current) {
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
      if (!mountedRef.current) return;
      setStreamStatus('Connected. Waiting for frames...');
    };

    streamWSRef.current.onmessage = (evt) => {
      if (!mountedRef.current) return;
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
      if (!mountedRef.current) return;
      setStreamStatus('WebSocket error.');
    };

    streamWSRef.current.onclose = () => {
      if (!mountedRef.current) return;
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

  const playVideo = (jobId: string) => {
    const runpodUrl = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
    const videoUrl = `${runpodUrl}/video/stream/${jobId}`;
    setCurrentVideoUrl(videoUrl);
    setCurrentVideoJobId(jobId);
    setVideoModalOpen(true);
    setVideoLoading(true);
    setVideoError(null);

    setTimeout(() => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.src = videoUrl;
      }
    }, 100);
  };

  const closeVideo = () => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.pause();
      videoPlayerRef.current.src = '';
    }
    setVideoModalOpen(false);
    setCurrentVideoUrl('');
    setCurrentVideoJobId(null);
    setVideoLoading(false);
    setVideoError(null);
  };

  const playCompletedVideo = (jobId: string) => {
    const runpodUrl = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
    const videoUrl = `${runpodUrl}/video/stream/${jobId}`;
    setPlaybackVideoUrl(videoUrl);
    setPlaybackVideoJobId(jobId);
    setPlaybackVideoModalOpen(true);
    setPlaybackVideoLoading(true);
    setPlaybackVideoError(null);

    setTimeout(() => {
      if (playbackVideoPlayerRef.current) {
        playbackVideoPlayerRef.current.src = videoUrl;
      }
    }, 100);
  };

  const closePlaybackVideo = () => {
    if (playbackVideoPlayerRef.current) {
      playbackVideoPlayerRef.current.pause();
      playbackVideoPlayerRef.current.src = '';
    }
    setPlaybackVideoModalOpen(false);
    setPlaybackVideoUrl('');
    setPlaybackVideoJobId(null);
    setPlaybackVideoLoading(false);
    setPlaybackVideoError(null);
  };

  const copyPlaybackVideoUrl = () => {
    if (playbackVideoUrl) {
      navigator.clipboard.writeText(playbackVideoUrl).then(() => {
        showNotification('Video URL copied to clipboard', 'success', 2000);
      }).catch(() => {
        showNotification('Failed to copy URL', 'error');
      });
    }
  };

  const openPlaybackVideoUrl = () => {
    if (playbackVideoUrl) {
      window.open(playbackVideoUrl, '_blank');
    }
  };

  const copyVideoUrl = () => {
    if (currentVideoUrl) {
      navigator.clipboard.writeText(currentVideoUrl).then(() => {
        showNotification('Video URL copied to clipboard', 'success', 2000);
      }).catch(() => {
        showNotification('Failed to copy URL', 'error');
      });
    }
  };

  const openVideoUrl = () => {
    if (currentVideoUrl) {
      window.open(currentVideoUrl, '_blank');
    }
  };

  const startProcessing = async (jobId: string) => {
    try {
      const runpodUrl = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
      const response = await fetch(`${runpodUrl}/video/process/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showNotification(`Processing started for job ${jobId}`, 'success');
      } else {
        throw new Error('Failed to start processing');
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      console.error('Error starting processing:', errorMsg);
      showNotification(errorMsg, 'error');
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
    setUploadStatus('uploading');
    setUploadError(null);
    setCurrentUploadFileName('');
    setCurrentUploadFileSize(0);

    abortControllerRef.current = new AbortController();

    try {
      for (const file of files) {
        if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
          const errorMsg = `The file "${file.name}" is not a supported video format. Please use MP4, MOV, AVI, MKV, or WebM files.`;
          showNotification(errorMsg, 'error');
          setUploadStatus('failed');
          setUploadError(errorMsg);
          continue;
        }

        const videoName = file.name.replace(/\.[^/.]+$/, '');
        setCurrentUploadFileName(file.name);
        setCurrentUploadFileSize(file.size);

        const result = await startRunPodProcessingDirect(
          file,
          videoName,
          () => {
            // Progress callback - keeping it for API compatibility but not using percentage
          },
          abortControllerRef.current.signal
        );

        const video = await createVideoMetadataRecord(file, videoName, result.original_url);

        setUploadedVideos(prev => [video, ...prev]);

        setUploadStatus('success');
        showNotification(`Successfully uploaded "${file.name}" and added to processing queue`, 'success', 5000);

        setCurrentUploadFileName('');
        setCurrentUploadFileSize(0);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setUploadStatus('cancelled');
        setUploadError('Upload was cancelled');
        showNotification('Upload cancelled', 'warning', 3000);
      } else {
        const errorMsg = toUploadError(error);
        console.error('Processing error:', errorMsg);
        setUploadStatus('failed');
        setUploadError(errorMsg);
        showNotification(`Upload failed: ${errorMsg}`, 'error', 8000);
      }
    } finally {
      setUploading(false);
      setCurrentUploadFileName('');
      setCurrentUploadFileSize(0);
      abortControllerRef.current = null;
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

      {wsError && (
        <div
          role="alert"
          data-testid="ws-error"
          className={`fixed top-20 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-start space-x-3 max-w-md bg-red-500`}
        >
          <div className="flex-shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <span className="text-white text-sm leading-relaxed">
              WebSocket connection error. Attempting to reconnect...
            </span>
          </div>
        </div>
      )}

      {uploadError && (
        <div
          role="alert"
          data-testid="upload-error"
          className={`fixed top-36 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-start space-x-3 max-w-md bg-red-500`}
        >
          <div className="flex-shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <span className="text-white text-sm leading-relaxed">
              {uploadError}
            </span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="flex-shrink-0 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      <div data-testid="upload-status" className="sr-only">{uploadStatus}</div>

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
                    !runpodConnected
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }`}
                  disabled={!runpodConnected}
                  title={!runpodConnected ? 'RunPod server not connected' : ''}
                >
                  {!runpodConnected ? 'Server Disconnected' : 'Select Video to Upload'}
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
                <div className="flex items-center gap-2 flex-wrap">
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
                  <button
                    onClick={shutdownAny}
                    className="px-2 sm:px-3 py-2 text-xs sm:text-sm rounded-lg transition-colors bg-red-500 hover:bg-red-600 text-white"
                  >
                    Shutdown Active/Queued
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
                    <th className={`text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Video</th>
                    <th className={`text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
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
                            {truncate(job.job_id, 8)}
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
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            {job.status === 'processing' ? (
                              <button
                                onClick={() => openStream(job.job_id)}
                                className={`px-2 sm:px-3 py-1 text-xs rounded-lg transition-colors ${
                                  isDark
                                    ? 'bg-primary-500/20 hover:bg-primary-500/30 text-primary-400'
                                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                                }`}
                                title="View live stream"
                              >
                                <span className="flex items-center gap-1">
                                  <Activity className="w-3 h-3" />
                                  <span className="hidden sm:inline">Live Stream</span>
                                </span>
                              </button>
                            ) : job.status === 'completed' ? (
                              <button
                                onClick={() => playCompletedVideo(job.job_id)}
                                className={`px-2 sm:px-3 py-1 text-xs rounded-lg transition-colors ${
                                  isDark
                                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                }`}
                                title="Play processed video"
                              >
                                <span className="flex items-center gap-1">
                                  <Play className="w-3 h-3" />
                                  <span className="hidden sm:inline">Play Video</span>
                                </span>
                              </button>
                            ) : (
                              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>-</span>
                            )}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <button
                                onClick={() => deleteJob(job.job_id)}
                                className="px-2 sm:px-3 py-1 text-xs rounded-lg transition-colors bg-red-500 hover:bg-red-600 text-white"
                                title="Shutdown job"
                              >
                                <span className="flex items-center gap-1">
                                  <Trash2 className="w-3 h-3" />
                                  <span className="hidden sm:inline">Shutdown</span>
                                </span>
                              </button>
                              {job.status === 'uploaded' && (
                                <button
                                  onClick={() => startProcessing(job.job_id)}
                                  className={`px-2 sm:px-3 py-1 text-xs rounded-lg transition-colors ${
                                    isDark
                                      ? 'bg-primary-500/20 hover:bg-primary-500/30 text-primary-400'
                                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                                  }`}
                                  title="Start processing"
                                >
                                  <span className="flex items-center gap-1">
                                    <Play className="w-3 h-3" />
                                    <span className="hidden sm:inline">Process</span>
                                  </span>
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

          {videoModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className={`rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-auto border shadow-2xl ${
                isDark ? 'bg-[#151F32] border-[#1E293B]' : 'bg-white border-gray-200'
              }`}>
                <div className={`flex items-center justify-between p-6 border-b ${
                  isDark ? 'border-[#1E293B]' : 'border-gray-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-500/10 rounded-lg">
                      <VideoIcon className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Video Player</h3>
                      <p className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Job ID: {currentVideoJobId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyVideoUrl}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                        isDark
                          ? 'bg-[#1E293B] hover:bg-[#2D3B4E] text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                      title="Copy video URL"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="hidden sm:inline">Copy URL</span>
                    </button>
                    <button
                      onClick={openVideoUrl}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                        isDark
                          ? 'bg-[#1E293B] hover:bg-[#2D3B4E] text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="hidden sm:inline">Open</span>
                    </button>
                    <button
                      onClick={closeVideo}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark ? 'hover:bg-[#1E293B] text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                      }`}
                      title="Close"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-center relative">
                    {videoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl z-10">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                          <p className="text-white font-medium">Loading video...</p>
                        </div>
                      </div>
                    )}
                    {videoError && (
                      <div className={`mb-4 p-4 rounded-lg border ${
                        isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
                      }`}>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">{videoError}</span>
                        </div>
                      </div>
                    )}
                    <video
                      ref={videoPlayerRef}
                      controls
                      autoPlay
                      className="w-full max-w-5xl h-auto rounded-xl bg-black shadow-2xl"
                      onLoadStart={() => setVideoLoading(true)}
                      onCanPlay={() => setVideoLoading(false)}
                      onError={() => {
                        setVideoLoading(false);
                        setVideoError('Failed to load video. The video may not be available yet.');
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  <div className={`mt-6 p-4 rounded-lg ${
                    isDark ? 'bg-[#1E293B]' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs font-medium mb-2 uppercase tracking-wide ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Streaming URL
                    </div>
                    <div className={`font-mono text-xs break-all ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {currentVideoUrl}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {playbackVideoModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className={`rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-auto border shadow-2xl ${
                isDark ? 'bg-[#151F32] border-[#1E293B]' : 'bg-white border-gray-200'
              }`}>
                <div className={`flex items-center justify-between p-6 border-b ${
                  isDark ? 'border-[#1E293B]' : 'border-gray-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-500/10 rounded-lg">
                      <VideoIcon className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Video Player</h3>
                      <p className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Job ID: {playbackVideoJobId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyPlaybackVideoUrl}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                        isDark
                          ? 'bg-[#1E293B] hover:bg-[#2D3B4E] text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                      title="Copy video URL"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="hidden sm:inline">Copy URL</span>
                    </button>
                    <button
                      onClick={openPlaybackVideoUrl}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                        isDark
                          ? 'bg-[#1E293B] hover:bg-[#2D3B4E] text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="hidden sm:inline">Open</span>
                    </button>
                    <button
                      onClick={closePlaybackVideo}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark ? 'hover:bg-[#1E293B] text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                      }`}
                      title="Close"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-center relative">
                    {playbackVideoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl z-10">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                          <p className="text-white font-medium">Loading video...</p>
                        </div>
                      </div>
                    )}
                    {playbackVideoError && (
                      <div className={`mb-4 p-4 rounded-lg border ${
                        isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
                      }`}>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">{playbackVideoError}</span>
                        </div>
                      </div>
                    )}
                    <video
                      ref={playbackVideoPlayerRef}
                      controls
                      autoPlay
                      className="w-full max-w-5xl h-auto rounded-xl bg-black shadow-2xl"
                      onLoadStart={() => setPlaybackVideoLoading(true)}
                      onCanPlay={() => setPlaybackVideoLoading(false)}
                      onError={() => {
                        setPlaybackVideoLoading(false);
                        setPlaybackVideoError('Failed to load video. The video may not be available yet.');
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  <div className={`mt-6 p-4 rounded-lg ${
                    isDark ? 'bg-[#1E293B]' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs font-medium mb-2 uppercase tracking-wide ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Streaming URL
                    </div>
                    <div className={`font-mono text-xs break-all ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {playbackVideoUrl}
                    </div>
                  </div>
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
