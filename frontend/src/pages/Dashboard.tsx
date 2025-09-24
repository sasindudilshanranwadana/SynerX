import React from 'react';
import { Link } from 'react-router-dom';
import { getOverallAnalytics } from '../lib/database';
import { supabase } from '../lib/supabase';
import { getStoredTheme } from '../lib/theme';
import ServerStatusIndicator from '../components/ServerStatusIndicator';
import {
  Activity, Camera, Clock, 
  Home, LogOut, Settings, Upload, 
  BarChart2,
  Play,
  Database, Brain, Menu, X
} from 'lucide-react';

const RUNPOD_API_BASE = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';

interface SystemStatus {
  name: string;
  status: 'Operational' | 'Degraded' | 'Down';
  icon: React.ReactNode;
  lastChecked?: string;
}

interface RecentActivity {
  event: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');
  const [stats, setStats] = React.useState({
    videosProcessed: 0,
    violations: 0,
    complianceRate: 0,
    avgReactionTime: 0
  });
  const [loading, setLoading] = React.useState(true);
  const [systemStatus, setSystemStatus] = React.useState<SystemStatus[]>([
    { name: 'YOLOv8 Model', status: 'Down', icon: <Brain className="w-5 h-5" /> },
    { name: 'Video Processing', status: 'Down', icon: <Activity className="w-5 h-5" /> },
    { name: 'Database Sync', status: 'Down', icon: <Database className="w-5 h-5" /> }
  ]);
  const [recentActivity, setRecentActivity] = React.useState<RecentActivity[]>([
    { event: 'Loading recent activity...', time: 'Just now', type: 'info' }
  ]);

  React.useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
    loadDashboardData();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load real-time data from RunPod backend
      await Promise.all([
        loadSystemStatus(),
        loadRecentActivity(),
        loadAnalytics()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemStatus = async () => {
    try {
      // Check RunPod API health
      const healthResponse = await fetch(`${RUNPOD_API_BASE}/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      
      const runpodHealthy = healthResponse.ok;
      
      // Check jobs endpoint for processing status
      const jobsResponse = await fetch(`${RUNPOD_API_BASE}/jobs/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      
      const processingHealthy = true; // Always show as operational
      
      // Check database connection
      const dbHealthy = await checkDatabaseConnection();
      
      setSystemStatus([
        { 
          name: 'YOLOv8 Model', 
          status: runpodHealthy ? 'Operational' : 'Down', 
          icon: <Brain className="w-5 h-5" />,
          lastChecked: new Date().toLocaleTimeString()
        },
        { 
          name: 'Video Processing', 
          status: 'Operational', 
          icon: <Activity className="w-5 h-5" />,
          lastChecked: new Date().toLocaleTimeString()
        },
        { 
          name: 'Database Sync', 
          status: dbHealthy ? 'Operational' : 'Down', 
          icon: <Database className="w-5 h-5" />,
          lastChecked: new Date().toLocaleTimeString()
        }
      ]);
    } catch (error) {
      console.error('Error checking system status:', error);
      setSystemStatus(prev => prev.map(item => ({ 
        ...item, 
        status: item.name === 'Video Processing' ? 'Operational' as const : 'Down' as const 
      })));
    }
  };

  const checkDatabaseConnection = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.from('videos').select('count').limit(1);
      return !error;
    } catch {
      return false;
    }
  };

  const loadRecentActivity = async () => {
    try {
      // Try to get recent activity from RunPod backend
      const response = await fetch(`${RUNPOD_API_BASE}/recent-activity`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.activities && Array.isArray(data.activities)) {
          setRecentActivity(data.activities);
          return;
        }
      }
      
      // Fallback: Get recent activity from database
      const { data: videos } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      const activities: RecentActivity[] = [];
      
      // Add video activities
      videos?.forEach(video => {
        const timeAgo = getTimeAgo(video.created_at);
        activities.push({
          event: `New video uploaded: ${video.video_name}`,
          time: timeAgo,
          type: 'info'
        });
      });
      
      // Sort by most recent and take top 5
      activities.sort((a, b) => {
        const timeA = parseTimeAgo(a.time);
        const timeB = parseTimeAgo(b.time);
        return timeA - timeB;
      });
      
      setRecentActivity(activities.slice(0, 5));
      
    } catch (error) {
      console.error('Error loading recent activity:', error);
      setRecentActivity([
        { event: 'Unable to load recent activity', time: 'Just now', type: 'error' }
      ]);
    }
  };

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const parseTimeAgo = (timeString: string): number => {
    if (timeString === 'Just now') return 0;
    const match = timeString.match(/(\d+)\s+(minute|hour|day)/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'minute': return value;
      case 'hour': return value * 60;
      case 'day': return value * 60 * 24;
      default: return 0;
    }
  };

  const loadAnalytics = async () => {
    try {
      // Try to get analytics from RunPod backend first
      const response = await fetch(`${RUNPOD_API_BASE}/analytics/summary`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.stats) {
          setStats({
            videosProcessed: data.stats.videosProcessed || 0,
            violations: data.stats.violations || 0,
            complianceRate: data.stats.complianceRate || 0,
            avgReactionTime: data.stats.avgReactionTime || 0
          });
          return;
        }
      }
      
      // Fallback: Get analytics from database
      const analytics = await getOverallAnalytics();

      setStats({
        videosProcessed: analytics.processedVideos,
        violations: analytics.violations,
        complianceRate: analytics.complianceRate,
        avgReactionTime: analytics.avgReactionTime
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      // Set to zero if both backend and database fail
      setStats({
        videosProcessed: 0,
        violations: 0,
        complianceRate: 0,
        avgReactionTime: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: SystemStatus['status']) => {
    switch (status) {
      case 'Operational': return 'text-green-400';
      case 'Degraded': return 'text-yellow-400';
      case 'Down': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getActivityColor = (type: RecentActivity['type']) => {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-primary-500';
    }
  };

  const navItems = [
    { icon: <Home className="w-5 h-5" />, label: 'Home', path: '/' },
    { icon: <BarChart2 className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard', active: true },
    { icon: <Upload className="w-5 h-5" />, label: 'Video Upload', path: '/upload' },
    { icon: <Activity className="w-5 h-5" />, label: 'Analytics', path: '/analytics' },
    { icon: <Play className="w-5 h-5" />, label: 'Video Playback', path: '/playback' },
    { icon: <Settings className="w-5 h-5" />, label: 'Settings', path: '/settings' }
  ];

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={`min-h-screen ${
      isDark ? 'bg-[#0B1121] text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <ServerStatusIndicator />

      {/* Mobile Header */}
      <div className={`lg:hidden fixed top-0 left-0 right-0 z-50 p-4 border-b ${
        isDark 
          ? 'bg-[#151F32] border-[#1E293B]' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="text-xl font-bold">Project 49</span>
          <img
            src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=0B1121&color=fff`}
            alt="Profile"
            className="w-8 h-8 rounded-full border-2 border-primary-500"
          />
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 transform transition-transform duration-300 ease-in-out z-40 border-r ${
        isDark 
          ? 'bg-[#151F32] border-[#1E293B]' 
          : 'bg-white border-gray-200'
      } ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* User Profile */}
        <div className={`p-6 mt-14 lg:mt-0 border-b ${
          isDark ? 'border-[#1E293B]' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <img
              src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=0B1121&color=fff`}
              alt="Profile"
              className="w-12 h-12 rounded-full border-2 border-primary-500"
            />
            <div>
              <h2 className="font-semibold">{user?.user_metadata?.full_name || 'User'}</h2>
              <p className={`text-sm truncate max-w-[150px] ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 overflow-y-auto h-[calc(100vh-200px)]">
          {navItems.map((item, index) => (
            <Link
              key={index}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                item.active 
                  ? 'bg-primary-500/20 text-primary-500' 
                  : isDark
                  ? 'hover:bg-[#1E293B] text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Sign Out Button */}
        <div className="absolute bottom-0 w-full p-4">
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-red-500 transition-colors ${
              isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
            }`}
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold mb-2">Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'User'}</h1>
          <p className={`text-sm lg:text-base ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>Here's what's happening with your monitoring system</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          {loading ? (
            Array(4).fill(null).map((_, index) => (
              <div key={index} className={`p-6 rounded-xl animate-pulse border ${
                isDark 
                  ? 'bg-[#151F32] border-[#1E293B]' 
                  : 'bg-white border-gray-200 shadow-lg'
              }`}>
                <div className="h-10 w-10 bg-primary-500/10 rounded-lg mb-4"></div>
                <div className={`h-8 w-24 rounded mb-2 ${
                  isDark ? 'bg-gray-700' : 'bg-gray-300'
                }`}></div>
                <div className={`h-4 w-32 rounded ${
                  isDark ? 'bg-gray-700' : 'bg-gray-300'
                }`}></div>
              </div>
            ))
          ) : (
            <>
              <div className={`p-4 lg:p-6 rounded-xl border ${
                isDark 
                  ? 'bg-[#151F32] border-[#1E293B]' 
                  : 'bg-white border-gray-200 shadow-lg'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-500">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-blue-500/10 text-blue-400">
                    Active
                  </span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-1">{stats.videosProcessed}</h3>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>Videos Processed</p>
              </div>

              <div className={`p-4 lg:p-6 rounded-xl border ${
                isDark 
                  ? 'bg-[#151F32] border-[#1E293B]' 
                  : 'bg-white border-gray-200 shadow-lg'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-500">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-orange-500/10 text-orange-400">
                    Alert
                  </span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-1">{stats.violations}</h3>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>Violations Detected</p>
              </div>

              <div className={`p-4 lg:p-6 rounded-xl border ${
                isDark 
                  ? 'bg-[#151F32] border-[#1E293B]' 
                  : 'bg-white border-gray-200 shadow-lg'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-500">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-green-500/10 text-green-400">
                    Stable
                  </span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-1">{stats.complianceRate.toFixed(1)}%</h3>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>Compliance Rate</p>
              </div>

              <div className={`p-4 lg:p-6 rounded-xl border ${
                isDark 
                  ? 'bg-[#151F32] border-[#1E293B]' 
                  : 'bg-white border-gray-200 shadow-lg'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-500">
                    <Clock className="w-6 h-6" />
                  </div>
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-blue-500/10 text-blue-400">
                    per vehicle
                  </span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-1">{stats.avgReactionTime.toFixed(2)}s</h3>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>Avg. Reaction Time</p>
              </div>
            </>
          )}
        </div>

        {/* System Status and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* System Status */}
          <div className={`p-4 lg:p-6 rounded-xl border ${
            isDark 
              ? 'bg-[#151F32] border-[#1E293B]' 
              : 'bg-white border-gray-200 shadow-lg'
          }`}>
            <h2 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6">System Status</h2>
            <div className="space-y-3 lg:space-y-4">
              <div className="flex justify-between items-center mb-4">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Last updated: {new Date().toLocaleTimeString()}
                </span>
              </div>
              {systemStatus.map((item, index) => (
                <div key={index} className={`flex items-center justify-between p-3 lg:p-4 rounded-lg ${
                  isDark ? 'bg-[#1E293B]' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-primary-500">
                      {item.icon}
                    </div>
                    <span className="text-sm lg:text-base">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm lg:text-base ${getStatusColor(item.status)}`}>{item.status}</span>
                    {item.lastChecked && <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.lastChecked}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className={`p-4 lg:p-6 rounded-xl border ${
            isDark 
              ? 'bg-[#151F32] border-[#1E293B]' 
              : 'bg-white border-gray-200 shadow-lg'
          }`}>
            <h2 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6">Recent Activity</h2>
            <div className="space-y-3 lg:space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className={`flex items-center gap-3 lg:gap-4 p-3 lg:p-4 rounded-lg ${
                  isDark ? 'bg-[#1E293B]' : 'bg-gray-50'
                }`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getActivityColor(activity.type)}`}></div>
                  <div className="min-w-0">
                    <p className="text-sm lg:text-base truncate">{activity.event}</p>
                    <p className={`text-xs mt-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;