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

  React.useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
    loadAnalytics();
  }, []);

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, []);

  const loadAnalytics = async () => {
    try {
      const analytics = await getOverallAnalytics();

      setStats({
        videosProcessed: analytics.processedVideos,
        violations: analytics.violations,
        complianceRate: analytics.complianceRate,
        avgReactionTime: analytics.avgReactionTime
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
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

  const systemStatus = [
    { name: 'YOLOv8 Model', status: 'Operational', icon: <Brain className="w-5 h-5" /> },
    { name: 'Video Processing', status: 'Active', icon: <Activity className="w-5 h-5" /> },
    { name: 'Database Sync', status: 'Connected', icon: <Database className="w-5 h-5" /> }
  ];

  const recentActivity = [
    { event: 'New violation detected at Crossing B-15', time: '2 minutes ago' },
    { event: 'System performance optimization completed', time: '15 minutes ago' },
    { event: 'Daily compliance report generated', time: '1 hour ago' },
    { event: 'Model accuracy improved by 2.3%', time: '2 hours ago' },
    { event: 'New video footage uploaded from Location A', time: '3 hours ago' }
  ];

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
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-green-500/10 text-green-400">
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
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-red-500/10 text-red-400">
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
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-primary-500/10 text-primary-500">
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
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-primary-500/10 text-primary-500">
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
                  <span className="text-green-400 text-sm lg:text-base">{item.status}</span>
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
                  <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></div>
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