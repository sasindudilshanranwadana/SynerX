import React from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, X, RefreshCw, Info, Clock, FileVideo, Activity } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ServerStatusIndicator from '../components/ServerStatusIndicator';
import { getStoredTheme } from '../lib/theme';
import { getVideoById } from '../lib/database';
import { Video } from '../lib/types';

const RUNPOD_API_BASE = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';

interface RunPodJob {
  job_id: string;
  file_name: string;
  status: string;
  progress?: number;
  message?: string;
  elapsed_time?: number;
  video_id?: number;
  video_url?: string;
  created_at?: string;
  completed_at?: string;
  processing_time?: number;
}

interface NotificationState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// User-friendly error messages
const getErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected error occurred';
  
  return 'Unable to load video data. Please try again.';
};

function Playback() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');
  
  // Connection status
  const [runpodConnected, setRunpodConnected] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [connectionError, setConnectionError] = React.useState<string>('');
  
  // Jobs and video data
  const [availableJobs, setAvailableJobs] = React.useState<RunPodJob[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  // Video playback modal
  const [playbackModalOpen, setPlaybackModalOpen] = React.useState(false);
  const [selectedVideoForPlayback, setSelectedVideoForPlayback] = React.useState<RunPodJob | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  
  // Notification
  const [notification, setNotification] = React.useState<NotificationState>({
    show: false,
    message: '',
    type: 'info'
  });
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const notificationTimeoutRef = React.useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    
    // Check RunPod connection and load jobs
    checkRunPodConnection();
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      clearNotificationTimeout();
    };
  }, []);

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
      type
    });

    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, duration);
  };

  const checkRunPodConnection = async () => {
    setConnectionStatus('connecting');
    setRunpodConnected(false);
    setConnectionError('');
    
    try {
      const response = await fetch(`${RUNPOD_API_BASE}/ws/jobs`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus('connected');
        setRunpodConnected(true);
        // Get all jobs (not just completed ones)
        setAvailableJobs(data.all_jobs || []);
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      setConnectionStatus('error');
      setConnectionError('Unable to connect to server. Please try again.');
    }
  };

  const openPlaybackModal = (job: RunPodJob) => {
    if (!job.video_url) {
      showNotification('No video URL available for playback', 'error');
      return;
    }
    
    setSelectedVideoForPlayback(job);
    setPlaybackModalOpen(true);
  };

  const closePlaybackModal = () => {
    setPlaybackModalOpen(false);
    setSelectedVideoForPlayback(null);
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getVideoUrl = (): string => {
    return selectedVideoForPlayback?.video_url || '';
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

  const getPillClass = (status: string): string => {
    const classes = {
      queued: 'bg-blue-500/10 text-blue-400',
      processing: 'bg-yellow-500/10 text-yellow-400',
      completed: 'bg-green-500/10 text-green-400',
      failed: 'bg-red-500/10 text-red-400',
      cancelled: 'bg-gray-500/10 text-gray-400'
    };
    return classes[status as keyof typeof classes] || classes.queued;
  };

  return (
    <div className={`min-h-screen ${
      isDark ? 'bg-[#0B1121] text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <ServerStatusIndicator />

      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-start space-x-3 max-w-md ${
          notification.type === 'success' ? 'bg-green-500' : 
          notification.type === 'error' ? 'bg-red-500' : 
          notification.type === 'warning' ? 'bg-yellow-500' : 
          'bg-blue-500'
        }`}>
          <div className="flex-shrink-0 mt-0.5">
            {notification.type === 'success' ? <Activity className="w-5 h-5" /> : 
             notification.type === 'error' ? <X className="w-5 h-5" /> : 
             notification.type === 'warning' ? <Info className="w-5 h-5" /> : 
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

      <Header title="Video Playback" onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isSidebarOpen={sidebarOpen} />
      <Sidebar activePath="/playback" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">Video Playback</h1>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              View your uploaded videos and play back the processed results
            </p>
          </div>

          {/* Your Uploads */}
          <div className={`p-8 rounded-xl mb-8 ${
            isDark 
              ? 'bg-[#151F32]' 
              : 'bg-white shadow-lg border border-gray-200'
          }`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary-500/10 rounded-lg">
                <FileVideo className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Your Uploads</h2>
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  All your uploaded videos and their processing status
                </p>
              </div>
            </div>

            <div className="flex justify-end mb-6">
              <button
                onClick={checkRunPodConnection}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                disabled={loading}
              >
                <RefreshCw className="w-5 h-5" />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
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
                  {availableJobs
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
                            {job.elapsed_time ? formatElapsed(job.elapsed_time) : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {job.status === 'completed' && job.video_url && (
                                <button
                                  onClick={() => openPlaybackModal(job)}
                                  className="px-3 py-1 text-xs bg-primary-500 hover:bg-primary-600 text-white rounded transition-colors"
                                >
                                  Play
                                </button>
                              )}
                              {job.status !== 'completed' && (
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {job.status === 'processing' ? 'Processing...' : 
                                   job.status === 'queued' ? 'In Queue' : 
                                   job.status === 'failed' ? 'Failed' : 'N/A'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {availableJobs.length === 0 && (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {!runpodConnected ? 'Unable to connect to server.' : 'No uploads found. Upload a video to get started.'}
                </div>
              )}
              </div>
          </div>
        </div>
      </main>

      {/* Video Playback Modal */}
      {playbackModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl w-full max-w-6xl mx-auto ${
            isDark 
              ? 'bg-[#151F32] border border-[#1E293B]' 
              : 'bg-white border border-gray-200'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold">
                {selectedVideoForPlayback?.file_name || 'Video Playback'}
              </h3>
              <button
                onClick={closePlaybackModal}
                className={`p-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'hover:bg-[#1E293B] text-gray-300' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="p-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={getVideoUrl()}
                  className="w-full h-auto max-h-[70vh]"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />

                {/* Custom Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-300 mt-1">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={togglePlayPause}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6 text-white" />
                        ) : (
                          <Play className="w-6 h-6 text-white" />
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleMute}
                          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                          {isMuted ? (
                            <VolumeX className="w-5 h-5 text-white" />
                          ) : (
                            <Volume2 className="w-5 h-5 text-white" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          if (videoRef.current.requestFullscreen) {
                            videoRef.current.requestFullscreen();
                          }
                        }
                      }}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <Maximize className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Playback;