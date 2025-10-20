import React from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, X, RefreshCw, Info, Clock, FileVideo, Activity, Trash2, BarChart3, Calendar, Filter, Search, Eye, Download, AlertTriangle } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ServerStatusIndicator from '../components/ServerStatusIndicator';
import { getStoredTheme } from '../lib/theme';
import { fetchFilteredVideos, fetchVideoSummary, deleteVideoFromRunPod, getStreamingVideoUrl, getSignedStreamingUrl } from '../lib/api';
import { supabase } from '../lib/supabase';
import { formatDateTime, formatDateTimeCompact, formatRelativeTime, getLocalTimezoneAbbreviation } from '../lib/dateUtils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface Video {
  id: number;
  video_name: string;
  status: string;
  duration_seconds?: number;
  created_at: string;
  total_vehicles?: number;
  compliance_rate?: number;
  processed_url?: string;
}

interface TrackingData {
  tracker_id: number;
  vehicle_type: string;
  status: string;
  compliance: number;
  reaction_time?: number;
  weather_condition?: string;
}

interface VehicleCount {
  vehicle_type: string;
  count: number;
  date: string;
}

interface VideoSummary {
  video: Video;
  tracking_data: TrackingData[];
  vehicle_counts: VehicleCount[];
}

interface NotificationState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// User-friendly error messages
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
  
  return 'Something went wrong. Please try again or contact support if the problem continues.';
};

function Playback() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');
  
  // Video data and filters
  const [videos, setVideos] = React.useState<Video[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState('');
  const [videoCount, setVideoCount] = React.useState(0);
  // Pagination state
  const [limit, setLimit] = React.useState<number>(25);
  const [offset, setOffset] = React.useState<number>(0);
  
  // Filter states
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [orderBy, setOrderBy] = React.useState('created_at');
  const [orderDesc, setOrderDesc] = React.useState('true');
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // Summary modal states
  const [summaryModalOpen, setSummaryModalOpen] = React.useState(false);
  const [summaryData, setSummaryData] = React.useState<VideoSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [currentVideoName, setCurrentVideoName] = React.useState('');
  
  // Video playback modal states
  const [videoModalOpen, setVideoModalOpen] = React.useState(false);
  const [currentVideoId, setCurrentVideoId] = React.useState<number | null>(null);
  const [videoInfo, setVideoInfo] = React.useState('');

  // Custom Delete Confirmation Modal states
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = React.useState(false);
  const [videoToDelete, setVideoToDelete] = React.useState<{ id: number | null, name: string | null }>({ id: null, name: null });
  
  // Chart refs
  const vcChartRef = React.useRef<Chart | null>(null);
  const complianceChartRef = React.useRef<Chart | null>(null);
  const weatherCountsChartRef = React.useRef<Chart | null>(null);
  const weatherReactionChartRef = React.useRef<Chart | null>(null);
  const weatherComplianceRateChartRef = React.useRef<Chart | null>(null);
  
  // Video refs
  const summaryVideoRef = React.useRef<HTMLVideoElement>(null);
  const modalVideoRef = React.useRef<HTMLVideoElement>(null);
  const summaryObjectUrlRef = React.useRef<string | null>(null);
  const modalObjectUrlRef = React.useRef<string | null>(null);
  
  // Notification
  const [notification, setNotification] = React.useState<NotificationState>({
    show: false,
    message: '',
    type: 'info'
  });
  
  const notificationTimeoutRef = React.useRef<NodeJS.Timeout>();
  const pagesCacheRef = React.useRef<Map<string, { data: Video[]; count: number }>>(new Map());

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    
    // Load first page without applying default date filters
    fetchAndSetPage(0);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      clearNotificationTimeout();
      destroyAllCharts();
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

  const setDefaultDateRange = (days: number) => {
    const now = new Date();
    const toStr = now.toISOString().slice(0, 10);
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const fromStr = past.toISOString().slice(0, 10);
    setDateTo(toStr);
    setDateFrom(fromStr);
  };

  const buildPageKey = (targetOffset: number) =>
    JSON.stringify({ dateFrom, dateTo, orderBy, orderDesc, limit, offset: targetOffset });

  const fetchAndSetPage = async (targetOffset: number, withSuccessToast: boolean = false) => {
    const key = buildPageKey(targetOffset);
    const cached = pagesCacheRef.current.get(key);
    if (cached) {
      setVideos(cached.data || []);
      setVideoCount(cached.count || 0);
    }

    setLoading(true);
    setStatusMessage('Loading videos...');
    try {
      const data = await fetchFilteredVideos({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        orderBy,
        orderDesc,
        limit,
        offset: targetOffset
      });
      if (data.status !== 'success') {
        throw new Error(data.error || 'Failed to load videos');
      }
      setVideos(data.data || []);
      setVideoCount(data.count || 0);
      setOffset(targetOffset);
      pagesCacheRef.current.set(key, { data: data.data || [], count: data.count || 0 });
      setStatusMessage('');
      if (withSuccessToast) {
        showNotification('Filters applied successfully', 'success', 3000);
      }
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      setStatusMessage(`Error: ${errorMsg}`);
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    // Reset pagination and cache when filters are (re)applied
    pagesCacheRef.current.clear();
    await fetchAndSetPage(0, true);
  };

  const totalPages = Math.max(1, Math.ceil((videoCount || 0) / (limit || 1)));
  const currentPage = Math.min(totalPages, Math.floor((offset || 0) / (limit || 1)) + 1);
  const goToPage = async (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    const newOffset = (clamped - 1) * limit;
    await fetchAndSetPage(newOffset);
  };

  const pageWindow = React.useMemo(() => {
    const windowSize = 5;
    const pages: number[] = [];
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    // Adjust start if near the end
    start = Math.max(1, Math.min(start, Math.max(1, end - windowSize + 1)));
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }, [currentPage, totalPages]);

  const openSummary = async (videoId: number, name: string) => {
    setSummaryModalOpen(true);
    setSummaryLoading(true);
    setCurrentVideoName(name);
    setSummaryData(null);
    
    try {
      const data = await fetchVideoSummary(videoId);
      if (data.status !== 'success') {
        throw new Error(data.error || 'Failed to load video summary');
      }
      setSummaryData(data);
      
      // Prefer signed URL for progressive streaming
      setTimeout(async () => {
        try {
          const signed = await getSignedStreamingUrl(videoId);
          if (summaryVideoRef.current) summaryVideoRef.current.src = signed;
        } catch {
          // Fallback to auth fetch if signed URL fails
          loadVideoWithAuth(videoId, 'summary');
        }
      }, 100);
      
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      showNotification(errorMsg, 'error');
    } finally {
      setSummaryLoading(false);
    }
  };

  const closeSummary = () => {
    setSummaryModalOpen(false);
    setSummaryData(null);
    setCurrentVideoName('');
    destroyAllCharts();
    
    if (summaryVideoRef.current) {
      summaryVideoRef.current.pause();
      summaryVideoRef.current.src = '';
    }
    if (summaryObjectUrlRef.current) {
      URL.revokeObjectURL(summaryObjectUrlRef.current);
      summaryObjectUrlRef.current = null;
    }
  };

  const playVideo = (videoId: number, videoName: string) => {
    setCurrentVideoId(videoId);
    setCurrentVideoName(videoName);
    setVideoModalOpen(true);
    setVideoInfo('Loading video...');
    
    // Prefer signed URL for progressive streaming
    (async () => {
      try {
        const signed = await getSignedStreamingUrl(videoId);
        if (modalVideoRef.current) modalVideoRef.current.src = signed;
      } catch {
        loadVideoWithAuth(videoId, 'modal');
      }
    })();
  };

  const closeVideoModal = () => {
    setVideoModalOpen(false);
    setCurrentVideoId(null);
    setCurrentVideoName('');
    setVideoInfo('');
    
    if (modalVideoRef.current) {
      modalVideoRef.current.pause();
      modalVideoRef.current.src = '';
    }
    if (modalObjectUrlRef.current) {
      URL.revokeObjectURL(modalObjectUrlRef.current);
      modalObjectUrlRef.current = null;
    }
  };

  const openDeleteConfirm = (videoId: number, name: string) => {
    setVideoToDelete({ id: videoId, name: name });
    setShowDeleteConfirmModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (videoToDelete.id === null) return;

    setStatusMessage('Deleting...');
    setShowDeleteConfirmModal(false); // Close the custom modal
    try {
      const res = await deleteVideoFromRunPod(videoToDelete.id);
      if (res.status !== 'success') {
        throw new Error(res.error || 'Failed to delete video');
      }
      setStatusMessage('Video deleted successfully');
      showNotification('Video deleted successfully', 'success');
      await applyFilters();
      setTimeout(() => {
        setStatusMessage('');
      }, 2000);
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
      console.error('Error deleting video:', e);
    } finally {
      setVideoToDelete({ id: null, name: null }); // Clear video to delete
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirmModal(false);
    setVideoToDelete({ id: null, name: null });
  };

  // Chart building functions
  const destroyAllCharts = () => {
    if (vcChartRef.current) {
      vcChartRef.current.destroy();
      vcChartRef.current = null;
    }
    if (complianceChartRef.current) {
      complianceChartRef.current.destroy();
      complianceChartRef.current = null;
    }
    if (weatherCountsChartRef.current) {
      weatherCountsChartRef.current.destroy();
      weatherCountsChartRef.current = null;
    }
    if (weatherReactionChartRef.current) {
      weatherReactionChartRef.current.destroy();
      weatherReactionChartRef.current = null;
    }
    if (weatherComplianceRateChartRef.current) {
      weatherComplianceRateChartRef.current.destroy();
      weatherComplianceRateChartRef.current = null;
    }
  };

  const buildAuthHeaders = async (): Promise<Headers> => {
    const headers = new Headers();
    if (import.meta.env.VITE_RUNPOD_API_KEY) {
      headers.set('Authorization', `Bearer ${import.meta.env.VITE_RUNPOD_API_KEY}`);
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = (session as any)?.access_token as string | undefined;
      if (userToken) {
        headers.set('Authorization', `Bearer ${userToken}`);
      }
    } catch {}
    return headers;
  };

  const loadVideoWithAuth = async (videoId: number, target: 'summary' | 'modal') => {
    try {
      const url = getStreamingVideoUrl(videoId);
      const headers = await buildAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (target === 'summary') {
        if (summaryObjectUrlRef.current) URL.revokeObjectURL(summaryObjectUrlRef.current);
        summaryObjectUrlRef.current = objectUrl;
        if (summaryVideoRef.current) summaryVideoRef.current.src = objectUrl;
      } else {
        if (modalObjectUrlRef.current) URL.revokeObjectURL(modalObjectUrlRef.current);
        modalObjectUrlRef.current = objectUrl;
        if (modalVideoRef.current) modalVideoRef.current.src = objectUrl;
      }
    } catch (e) {
      setVideoInfo('Error loading video. Please check the URL.');
      console.error('Error loading video with auth:', e);
    }
  };

  const buildCharts = (tracking: TrackingData[], counts: VehicleCount[]) => {
    if (!counts || counts.length === 0) return;

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: isDark ? '#E5E7EB' : '#374151',
            font: {
              family: 'Inter, system-ui, sans-serif'
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: isDark ? '#9CA3AF' : '#6B7280'
          },
          grid: {
            color: isDark ? '#374151' : '#E5E7EB'
          }
        },
        y: {
          ticks: {
            color: isDark ? '#9CA3AF' : '#6B7280'
          },
          grid: {
            color: isDark ? '#374151' : '#E5E7EB'
          }
        }
      }
    };

    // Vehicle counts by type
    const grouped: { [key: string]: number } = {};
    for (const item of counts) {
      const key = item.vehicle_type || 'unknown';
      grouped[key] = (grouped[key] || 0) + (item.count || 0);
    }
    const labels = Object.keys(grouped);
    const data = labels.map(k => grouped[k]);

    const vcCanvas = document.getElementById('vcChart') as HTMLCanvasElement;
    if (vcCanvas && vcChartRef.current) {
      vcChartRef.current.destroy();
    }
    if (vcCanvas) {
      vcChartRef.current = new Chart(vcCanvas.getContext('2d')!, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ 
            label: 'Vehicle Count', 
            data, 
            backgroundColor: '#06B6D4',
            borderColor: '#0891B2',
            borderWidth: 1,
            borderRadius: 4
          }],
        },
        options: {
          ...chartOptions,
          plugins: {
            ...chartOptions.plugins,
            legend: { display: false }
          }
        }
      });
    }

    // Compliance breakdown
    let compYes = 0, compNo = 0;
    for (const item of tracking || []) {
      if (item.compliance === 1) compYes++;
      else compNo++;
    }

    const compCanvas = document.getElementById('complianceChart') as HTMLCanvasElement;
    if (compCanvas && complianceChartRef.current) {
      complianceChartRef.current.destroy();
    }
    if (compCanvas) {
      complianceChartRef.current = new Chart(compCanvas.getContext('2d')!, {
        type: 'doughnut',
        data: {
          labels: ['Compliant', 'Non-Compliant'],
          datasets: [
            {
              data: [compYes, compNo],
              backgroundColor: ['#10B981', '#EF4444'],
              borderWidth: 2,
              borderColor: isDark ? '#1F2937' : '#FFFFFF'
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: isDark ? '#E5E7EB' : '#374151',
                font: {
                  family: 'Inter, system-ui, sans-serif'
                },
                padding: 20
              }
            }
          }
        }
      });
    }
  };

  const buildWeatherCharts = (tracking: TrackingData[]) => {
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: isDark ? '#9CA3AF' : '#6B7280'
          },
          grid: {
            color: isDark ? '#374151' : '#E5E7EB'
          }
        },
        y: {
          ticks: {
            color: isDark ? '#9CA3AF' : '#6B7280'
          },
          grid: {
            color: isDark ? '#374151' : '#E5E7EB'
          }
        }
      }
    };

    const byWeather: { [key: string]: { count: number; compliant: number; non: number } } = {};
    for (const item of tracking || []) {
      const w = (item.weather_condition || 'unknown').toLowerCase();
      if (!byWeather[w]) byWeather[w] = { count: 0, compliant: 0, non: 0 };
      byWeather[w].count += 1;
      if (item.compliance === 1) byWeather[w].compliant += 1;
      else byWeather[w].non += 1;
    }

    const labels = Object.keys(byWeather);
    if (labels.length === 0) return;

    const counts = labels.map(k => byWeather[k].count);

    // Weather counts chart
    const wCountCanvas = document.getElementById('weatherCountsChart') as HTMLCanvasElement;
    if (wCountCanvas && weatherCountsChartRef.current) {
      weatherCountsChartRef.current.destroy();
    }
    if (wCountCanvas) {
      weatherCountsChartRef.current = new Chart(wCountCanvas.getContext('2d')!, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Detections',
              data: counts,
              backgroundColor: '#38BDF8',
              borderColor: '#0EA5E9',
              borderWidth: 1,
              borderRadius: 4
            },
          ],
        },
        options: chartOptions
      });
    }

    // Reaction time by weather
    const react: { [key: string]: { sum: number; n: number } } = {};
    for (const item of tracking || []) {
      const w = (item.weather_condition || 'unknown').toLowerCase();
      const rt = parseFloat(item.reaction_time?.toString() || '0');
      if (!isNaN(rt) && rt > 0) {
        if (!react[w]) react[w] = { sum: 0, n: 0 };
        react[w].sum += rt;
        react[w].n += 1;
      }
    }

    const rLabels = Object.keys(react);
    const rData = rLabels.map(k => react[k].n > 0 ? react[k].sum / react[k].n : 0);

    const wReactCanvas = document.getElementById('weatherReactionChart') as HTMLCanvasElement;
    if (wReactCanvas && weatherReactionChartRef.current) {
      weatherReactionChartRef.current.destroy();
    }
    if (wReactCanvas) {
      weatherReactionChartRef.current = new Chart(wReactCanvas.getContext('2d')!, {
        type: 'bar',
        data: {
          labels: rLabels,
          datasets: [
            {
              label: 'Avg Reaction Time (s)',
              data: rData,
              backgroundColor: '#F59E0B',
              borderColor: '#D97706',
              borderWidth: 1,
              borderRadius: 4
            },
          ],
        },
        options: chartOptions
      });
    }

    // Weather compliance rate
    const rates = labels.map(k =>
      byWeather[k].count > 0 ? (byWeather[k].compliant / byWeather[k].count) * 100 : 0
    );

    const wCompRateCanvas = document.getElementById('weatherComplianceRateChart') as HTMLCanvasElement;
    if (wCompRateCanvas && weatherComplianceRateChartRef.current) {
      weatherComplianceRateChartRef.current.destroy();
    }
    if (wCompRateCanvas) {
      weatherComplianceRateChartRef.current = new Chart(wCompRateCanvas.getContext('2d')!, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Compliance Rate (%)',
              data: rates,
              backgroundColor: '#10B981',
              borderColor: '#059669',
              borderWidth: 1,
              borderRadius: 4
            },
          ],
        },
        options: {
          ...chartOptions,
          scales: {
            ...chartOptions.scales,
            y: { 
              ...chartOptions.scales.y,
              beginAtZero: true, 
              max: 100 
            }
          }
        }
      });
    }
  };

  // Build charts when summary data changes
  React.useEffect(() => {
    if (summaryData && summaryModalOpen) {
      setTimeout(() => {
        try {
          buildCharts(summaryData.tracking_data, summaryData.vehicle_counts);
          buildWeatherCharts(summaryData.tracking_data);
        } catch (error) {
          console.error('Error building charts:', error);
        }
      }, 100);
    }
  }, [summaryData, summaryModalOpen, isDark]);

  // Utility functions
  const truncate = (str: string, n: number): string => {
    return str && str.length > n ? str.slice(0, n - 1) + '…' : str || '';
  };

  const formatDuration = (sec: number): string => {
    const s = Math.floor(sec % 60);
    const m = Math.floor(sec / 60) % 60;
    const h = Math.floor(sec / 3600);
    return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getPillClass = (status: string): string => {
    const classes = {
      uploaded: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      processing: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
      completed: 'bg-green-500/10 text-green-400 border border-green-500/20',
      failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
      cancelled: 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
    };
    return classes[status as keyof typeof classes] || classes.uploaded;
  };

  // Filter videos based on search term
  const filteredVideos = videos.filter(video =>
    video.video_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0B1121] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <ServerStatusIndicator />

      {/* Enhanced Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-start space-x-3 max-w-md backdrop-blur-sm border ${
          notification.type === 'success' ? 'bg-green-500/90 border-green-400/20' : 
          notification.type === 'error' ? 'bg-red-500/90 border-red-400/20' : 
          notification.type === 'warning' ? 'bg-yellow-500/90 border-yellow-400/20' : 
          'bg-blue-500/90 border-blue-400/20'
        }`}>
          <div className="flex-shrink-0 mt-0.5">
            {notification.type === 'success' ? <Activity className="w-5 h-5" /> : 
             notification.type === 'error' ? <X className="w-5 h-5" /> : 
             notification.type === 'warning' ? <Info className="w-5 h-5" /> : 
             <Info className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <span className="text-white text-sm leading-relaxed font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(prev => ({ ...prev, show: false }))}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Header title="Video Playback" onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isSidebarOpen={sidebarOpen} />
      <Sidebar activePath="/playback" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2 text-white">Video Playback & Analytics</h1>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Browse and analyze your processed videos
            </p>
          </div>

          {/* Advanced Filters */}
          <div className={`rounded-2xl p-6 mb-8 backdrop-blur-sm border ${
            isDark 
              ? 'bg-[#151F32]/80 border-[#1E293B]' 
              : 'bg-white/80 shadow-xl border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                  <Filter className="w-5 h-5 text-primary-500" />
                </div>
                <h2 className="text-xl font-semibold">Advanced Filters</h2>
              </div>
              <div className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-[#1E293B] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                <Clock className="w-3 h-3 inline mr-1" />
                Timezone: {getLocalTimezoneAbbreviation()}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
              <div className="lg:col-span-2">
                <label htmlFor="video-search" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Search className="w-4 h-4 inline mr-2" />
                  Search Videos
                </label>
                <input
                  id="video-search" // Add ID for accessibility
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by video name..."
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    isDark 
                      ? 'bg-[#1E293B] border-[#2D3B4E] text-white placeholder-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20' 
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                  }`}
                />
              </div>
              <div>
                <label htmlFor="date-from" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Calendar className="w-4 h-4 inline mr-2" />
                  From Date
                </label>
                <input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    isDark 
                      ? 'bg-[#1E293B] border-[#2D3B4E] text-white focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20' 
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                  }`}
                />
              </div>
              <div>
                <label htmlFor="date-to" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Calendar className="w-4 h-4 inline mr-2" />
                  To Date
                </label>
                <input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    isDark 
                      ? 'bg-[#1E293B] border-[#2D3B4E] text-white focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20' 
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                  }`}
                />
              </div>
              <div>
                <label htmlFor="sort-by" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Sort By
                </label>
                <select
                  id="sort-by"
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    isDark 
                      ? 'bg-[#1E293B] border-[#2D3B4E] text-white focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20' 
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                  }`}
                >
                  <option value="created_at">Created Date</option>
                  <option value="upload_date">Upload Date</option>
                  <option value="duration_seconds">Duration</option>
                </select>
              </div>
              <div>
                <label htmlFor="order" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Order
                </label>
                <select
                  id="order"
                  value={orderDesc}
                  onChange={(e) => setOrderDesc(e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    isDark 
                      ? 'bg-[#1E293B] border-[#2D3B4E] text-white focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20' 
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                  }`}
                >
                  <option value="true">Newest First</option>
                  <option value="false">Oldest First</option>
                </select>
              </div>
            </div>
            
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={applyFilters}
                  disabled={loading}
                  className="px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium shadow-lg hover:shadow-xl"
                >
                  <Filter className="w-4 h-4" />
                  Apply Filters
                </button>
                <button
                  onClick={() => { pagesCacheRef.current.clear(); fetchAndSetPage(0); }}
                  disabled={loading}
                  className={`px-6 py-3 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium ${
                    isDark 
                      ? 'bg-[#1E293B] hover:bg-[#2D3B4E] text-gray-300 border border-[#2D3B4E]' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              <div className="flex items-center gap-4">
                {/* Numbered pagination */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(1)}
                    disabled={currentPage <= 1 || loading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-[#1E293B] text-gray-300 border border-[#2D3B4E]' : 'bg-gray-100 text-gray-700 border border-gray-300'} disabled:opacity-50`}
                  >
                    First
                  </button>
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-[#1E293B] text-gray-300 border border-[#2D3B4E]' : 'bg-gray-100 text-gray-700 border border-gray-300'} disabled:opacity-50`}
                  >
                    Prev
                  </button>
                  {pageWindow.map(p => (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      disabled={loading}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                        p === currentPage
                          ? 'bg-primary-500 text-white border-primary-500'
                          : isDark
                            ? 'bg-[#1E293B] text-gray-300 border-[#2D3B4E]'
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-[#1E293B] text-gray-300 border border-[#2D3B4E]' : 'bg-gray-100 text-gray-700 border border-gray-300'} disabled:opacity-50`}
                  >
                    Next
                  </button>
                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage >= totalPages || loading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-[#1E293B] text-gray-300 border border-[#2D3B4E]' : 'bg-gray-100 text-gray-700 border border-gray-300'} disabled:opacity-50`}
                  >
                    Last
                  </button>
                </div>
                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {videoCount > 0 ? `Page ${currentPage} of ${totalPages} • Showing ${Math.min(offset + 1, videoCount)}–${Math.min(offset + (videos?.length || 0), videoCount)} of ${videoCount}` : ''}
                </div>
              </div>
              {statusMessage && (
                <div className={`text-sm font-medium ${
                  statusMessage.includes('Error') ? 'text-red-400' : 
                  statusMessage.includes('success') ? 'text-green-400' : 
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {statusMessage}
                </div>
              )}
            </div>
          </div>

          {/* Videos Table */}
          <div className={`rounded-2xl backdrop-blur-sm border overflow-hidden ${
            isDark 
              ? 'bg-[#151F32]/80 border-[#1E293B]' 
              : 'bg-white/80 shadow-xl border-gray-200'
          }`}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-500/10 rounded-lg">
                    <FileVideo className="w-5 h-5 text-primary-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Video Library</h2>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {Math.min(offset + (filteredVideos?.length || 0), videoCount)} of {videoCount} videos {searchTerm && `matching "${searchTerm}"`}
                    </p>
                  </div>
                </div>
                {loading && (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Loading...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${isDark ? 'bg-[#1E293B]' : 'bg-gray-50'}`}>
                  <tr>
                    <th className={`text-left py-4 px-6 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Video Details
                    </th>
                    <th className={`text-left py-4 px-6 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Status
                    </th>
                    <th className={`text-left py-4 px-6 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Duration
                    </th>
                    <th className={`text-left py-4 px-6 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Analytics
                    </th>
                    <th className={`text-left py-4 px-6 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Created
                    </th>
                    <th className={`text-left py-4 px-6 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVideos.map((video, index) => (
                    <tr key={video.id} className={`border-b transition-colors hover:bg-opacity-50 ${
                      isDark 
                        ? 'border-gray-700 hover:bg-[#1E293B]' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            isDark ? 'bg-[#1E293B]' : 'bg-gray-100'
                          }`}>
                            <FileVideo className="w-6 h-6 text-primary-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold" title={video.video_name}>
                              {truncate(video.video_name || 'Untitled Video', 40)}
                            </h3>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              ID: {video.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPillClass(video.status)}`}>
                          {video.status?.charAt(0).toUpperCase() + video.status?.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {video.duration_seconds != null ? formatDuration(video.duration_seconds) : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {video.total_vehicles != null && (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Vehicles: <span className="font-medium text-primary-500">{video.total_vehicles}</span>
                              </span>
                            </div>
                          )}
                          {video.compliance_rate != null && (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Compliance: <span className={`font-medium ${
                                  video.compliance_rate >= 80 ? 'text-green-400' :
                                  video.compliance_rate >= 60 ? 'text-yellow-400' : 'text-red-400'
                                }`}>{video.compliance_rate}%</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {formatDateTimeCompact(video.created_at)}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            {formatRelativeTime(video.created_at)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openSummary(video.id, video.video_name)}
                            className="px-3 py-2 text-xs bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all duration-200 flex items-center gap-1 font-medium shadow-sm hover:shadow-md"
                          >
                            <BarChart3 className="w-3 h-3" />
                            Analytics
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(video.id, video.video_name)}
                            className="px-3 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-200 flex items-center gap-1 font-medium shadow-sm hover:shadow-md"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredVideos.length === 0 && !loading && (
                <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <FileVideo className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No videos found</h3>
                  <p className="text-sm">
                    {searchTerm ? `No videos match "${searchTerm}"` : 'Upload a video to get started'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Enhanced Summary Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-7xl mx-auto max-h-[95vh] overflow-auto border shadow-2xl ${
            isDark ? 'bg-[#151F32] border-[#1E293B]' : 'bg-white border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b sticky top-0 backdrop-blur-sm ${
              isDark ? 'border-[#1E293B] bg-[#151F32]/95' : 'border-gray-200 bg-white/95'
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Video Analytics Dashboard</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {currentVideoName}
                  </p>
                </div>
              </div>
              <button
                onClick={closeSummary}
                aria-label="Close summary modal"
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-[#1E293B] text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {summaryLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                  <p className="text-lg font-medium">Loading analytics...</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Processing video data and generating insights
                  </p>
                </div>
              ) : summaryData ? (
                <>
                  {/* Video Player Section */}
                  <div className="mb-8">
                    <div className={`rounded-xl p-6 ${isDark ? 'bg-[#1E293B]' : 'bg-gray-50'}`}>
                      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Play className="w-5 h-5 text-primary-500" />
                        Video Playback
                      </h4>
                      <div className="text-center">
                        <video
                          ref={summaryVideoRef}
                          controls
                          autoPlay
                          className="w-full max-w-4xl h-auto rounded-xl bg-black shadow-2xl"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  </div>

                  {/* Video Info Section */}
                  <div className={`mb-8 p-6 rounded-xl ${isDark ? 'bg-[#1E293B]' : 'bg-gray-50'}`}>
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Info className="w-5 h-5 text-primary-500" />
                      Video Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-[#0B1220]' : 'bg-white'} border ${isDark ? 'border-[#2D3B4E]' : 'border-gray-200'}`}>
                        <div className={`text-xs font-medium mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Status
                        </div>
                        <div className="font-semibold text-lg">
                          <span className={`px-3 py-1 rounded-full text-sm ${getPillClass(summaryData.video.status || 'unknown')}`}>
                            {summaryData.video.status || '-'}
                          </span>
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-[#0B1220]' : 'bg-white'} border ${isDark ? 'border-[#2D3B4E]' : 'border-gray-200'}`}>
                        <div className={`text-xs font-medium mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Duration
                        </div>
                        <div className="font-semibold text-lg">
                          {summaryData.video.duration_seconds != null ? formatDuration(summaryData.video.duration_seconds) : '-'}
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-[#0B1220]' : 'bg-white'} border ${isDark ? 'border-[#2D3B4E]' : 'border-gray-200'}`}>
                        <div className={`text-xs font-medium mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Total Vehicles
                        </div>
                        <div className="font-semibold text-lg text-primary-500">
                          {summaryData.video.total_vehicles || '-'}
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-[#0B1220]' : 'bg-white'} border ${isDark ? 'border-[#2D3B4E]' : 'border-gray-200'}`}>
                        <div className={`text-xs font-medium mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Compliance Rate
                        </div>
                        <div className={`font-semibold text-lg ${
                          (summaryData.video.compliance_rate || 0) >= 80 ? 'text-green-400' :
                          (summaryData.video.compliance_rate || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {summaryData.video.compliance_rate != null ? summaryData.video.compliance_rate + '%' : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Data Tables Section */}
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary-500" />
                      Raw Data Analysis
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className={`rounded-xl border ${isDark ? 'bg-[#1E293B] border-[#2D3B4E]' : 'bg-white border-gray-200'}`}>
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                          <h5 className="font-semibold flex items-center gap-2">
                            Tracking Data ({summaryData.tracking_data.length})
                          </h5>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className={`sticky top-0 ${isDark ? 'bg-[#1E293B]' : 'bg-gray-50'}`}>
                              <tr>
                                <th className="p-3 text-left font-medium">ID</th>
                                <th className="p-3 text-left font-medium">Type</th>
                                <th className="p-3 text-left font-medium">Status</th>
                                <th className="p-3 text-left font-medium">Compliance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summaryData.tracking_data.slice(0, 100).map((item, index) => (
                                <tr key={index} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                  <td className="p-3 font-mono text-xs">{item.tracker_id}</td>
                                  <td className="p-3">{item.vehicle_type}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      item.status === 'moving' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'
                                    }`}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`text-lg ${item.compliance === 1 ? 'text-green-400' : 'text-red-400'}`}>
                                      {item.compliance === 1 ? '✅' : '❌'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {summaryData.tracking_data.length > 100 && (
                            <div className={`p-3 text-center text-xs border-t ${isDark ? 'bg-[#1E293B] text-gray-400 border-gray-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              Showing first 100 of {summaryData.tracking_data.length} records
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className={`rounded-xl border ${isDark ? 'bg-[#1E293B] border-[#2D3B4E]' : 'bg-white border-gray-200'}`}>
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                          <h5 className="font-semibold flex items-center gap-2">
                            Vehicle Counts ({summaryData.vehicle_counts.length})
                          </h5>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className={`sticky top-0 ${isDark ? 'bg-[#1E293B]' : 'bg-gray-50'}`}>
                              <tr>
                                <th className="p-3 text-left font-medium">Type</th>
                                <th className="p-3 text-left font-medium">Count</th>
                                <th className="p-3 text-left font-medium">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summaryData.vehicle_counts.slice(0, 100).map((item, index) => (
                                <tr key={index} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                  <td className="p-3 font-medium">{item.vehicle_type}</td>
                                  <td className="p-3">
                                    <span className="px-2 py-1 bg-primary-500/10 text-primary-400 rounded text-xs font-medium">
                                      {item.count}
                                    </span>
                                  </td>
                                  <td className="p-3 text-xs font-mono">{item.date}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {summaryData.vehicle_counts.length > 100 && (
                            <div className={`p-3 text-center text-xs border-t ${isDark ? 'bg-[#1E293B] text-gray-400 border-gray-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              Showing first 100 of {summaryData.vehicle_counts.length} records
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Charts Section */}
                  {summaryData.vehicle_counts.length > 0 && (
                    <div className="space-y-8">
                      <div>
                        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-primary-500" />
                          Visual Analytics
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                          <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#0B1220] border-[#1E293B]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Vehicle Distribution
                            </div>
                            <div className="h-64">
                              <canvas id="vcChart"></canvas>
                            </div>
                          </div>
                          <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#0B1220] border-[#1E293B]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Compliance Overview
                            </div>
                            <div className="h-64">
                              <canvas id="complianceChart"></canvas>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                          <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#0B1220] border-[#1E293B]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Weather Impact - Detection Count
                            </div>
                            <div className="h-64">
                              <canvas id="weatherCountsChart"></canvas>
                            </div>
                          </div>
                          <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#0B1220] border-[#1E293B]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Weather Impact - Reaction Time
                            </div>
                            <div className="h-64">
                              <canvas id="weatherReactionChart"></canvas>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                          <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#0B1220] border-[#1E293B]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Weather Impact - Compliance Rate
                            </div>
                            <div className="h-64">
                              <canvas id="weatherComplianceRateChart"></canvas>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Failed to load analytics</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Unable to retrieve video analytics data
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Video Playback Modal */}
      {videoModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-6xl mx-auto max-h-[95vh] overflow-auto border shadow-2xl ${
            isDark ? 'bg-[#151F32] border-[#1E293B]' : 'bg-white border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                  <Play className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Video Player</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {currentVideoName}
                  </p>
                </div>
              </div>
              <button
                onClick={closeVideoModal}
                aria-label="Close video player"
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-[#1E293B] text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="text-center">
                <video
                  ref={modalVideoRef}
                  controls
                  className="w-full max-w-5xl h-auto rounded-xl bg-black shadow-2xl"
                  onLoadStart={() => setVideoInfo('Loading video...')}
                  onCanPlay={() => setVideoInfo(`Ready to play: ${currentVideoName}`)}
                  onError={() => setVideoInfo('Error loading video. Please check the URL.')}
                >
                  Your browser does not support the video tag.
                </video>
                <div className={`mt-4 text-sm font-medium ${
                  videoInfo.includes('Error') ? 'text-red-400' : 
                  videoInfo.includes('Ready') ? 'text-green-400' : 
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {videoInfo}
                </div>
                <div className={`mt-2 text-xs ${isDark ? 'text-yellow-300/90' : 'text-yellow-700'} flex items-center justify-center gap-2`}>
                  <Info className={`w-4 h-4 ${isDark ? 'text-yellow-300/90' : 'text-yellow-600'}`} />
                  <span>
                    Large videos may take a few seconds to start buffering on first play.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirmModal && videoToDelete.id && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className={`relative rounded-xl w-full max-w-md backdrop-blur-sm ${
            isDark 
              ? 'bg-[#151F32]/95 border border-[#1E293B]' 
              : 'bg-white/95 shadow-2xl border border-gray-200'
          }`}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-full bg-red-500/10">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Confirm Deletion</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    This action cannot be undone
                  </p>
                </div>
              </div>
              
              <div className={`p-4 rounded-lg mb-6 ${isDark ? 'bg-[#1E293B]' : 'bg-gray-50'}`}>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Are you sure you want to delete <strong>"{videoToDelete.name}"</strong>?
                </p>
                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  This will permanently delete the video and all associated tracking data and vehicle counts.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteCancel}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                    isDark 
                      ? 'bg-[#1E293B] hover:bg-[#2D3B4E] text-gray-300 border border-[#334155]' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Playback;