import React from 'react';
<<<<<<< Updated upstream
import { Link, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { 
  Activity, Camera, Clock, 
  Home, LogOut, Settings, Upload, 
  BarChart2, FileText, RefreshCw,
  Database, Brain, Menu, X
} from 'lucide-react';

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  const stats = [
    { 
      title: 'Videos Processed',
      value: '247',
      trend: '+12% this week',
      icon: <Camera className="w-6 h-6" />,
      trendUp: true 
    },
    { 
      title: 'Violations Detected',
      value: '23',
      trend: '-5% from last week',
      icon: <Activity className="w-6 h-6" />,
      trendUp: false
    },
    { 
      title: 'Compliance Rate',
      value: '94%',
      trend: 'Stable',
      icon: <Activity className="w-6 h-6" />,
      trendUp: null
    },
    { 
      title: 'Processing Time',
      value: '1.2s',
      trend: 'per frame',
      icon: <Clock className="w-6 h-6" />,
      trendUp: null
    }
  ];

=======
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Activity, Camera, Clock, 
  Home, LogOut, Settings, Upload, 
  BarChart2, RefreshCw,
  Database, Brain, Menu, X
} from 'lucide-react';
import Papa from 'papaparse';

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);
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

  const loadAnalytics = async () => {
    try {
      // Load tracking results
      const trackingResponse = await fetch('/tracking_results.csv');
      const trackingText = await trackingResponse.text();
      
      Papa.parse(trackingText, {
        complete: (results) => {
          const data = results.data.slice(1) as any[];
          
          // Calculate statistics
          const totalVehicles = data.length;
          const violations = data.filter(row => row[3] === '0').length;
          const compliantVehicles = data.filter(row => row[3] === '1');
          const complianceRate = (compliantVehicles.length / totalVehicles) * 100;
          
          // Calculate average reaction time for compliant vehicles
          const reactionTimes = compliantVehicles
            .map(row => parseFloat(row[4]))
            .filter(time => !isNaN(time));
          const avgReactionTime = reactionTimes.length > 0
            ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
            : 0;

          setStats({
            videosProcessed: 1, // Assuming one video for now
            violations,
            complianceRate,
            avgReactionTime
          });
        },
        header: false
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
    { icon: <RefreshCw className="w-5 h-5" />, label: 'Progress', path: '/progress' },
    { icon: <Settings className="w-5 h-5" />, label: 'Settings', path: '/settings' }
  ];

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
  const navItems = [
    { icon: <Home className="w-5 h-5" />, label: 'Home', path: '/' },
    { icon: <BarChart2 className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard', active: true },
    { icon: <Upload className="w-5 h-5" />, label: 'Video Upload', path: '/upload' },
    { icon: <Activity className="w-5 h-5" />, label: 'Analytics', path: '/analytics' },
    { icon: <FileText className="w-5 h-5" />, label: 'Reports', path: '/reports' },
    { icon: <RefreshCw className="w-5 h-5" />, label: 'Progress', path: '/progress' },
    { icon: <Settings className="w-5 h-5" />, label: 'Settings', path: '/settings' }
  ];

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

=======
>>>>>>> Stashed changes
  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#151F32] border-b border-[#1E293B] p-4">
        <div className="flex items-center justify-between">
<<<<<<< Updated upstream
          <button onClick={toggleSidebar} className="p-2">
=======
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
>>>>>>> Stashed changes
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="text-xl font-bold">Project 49</span>
          <img
<<<<<<< Updated upstream
            src={auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${auth.currentUser?.displayName || 'User'}&background=0B1121&color=fff`}
=======
            src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=0B1121&color=fff`}
>>>>>>> Stashed changes
            alt="Profile"
            className="w-8 h-8 rounded-full border-2 border-primary-400"
          />
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-[#151F32] border-r border-[#1E293B] transform transition-transform duration-300 ease-in-out z-40 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* User Profile */}
        <div className="p-6 border-b border-[#1E293B] mt-14 lg:mt-0">
          <div className="flex items-center gap-3">
            <img
<<<<<<< Updated upstream
              src={auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${auth.currentUser?.displayName || 'User'}&background=0B1121&color=fff`}
=======
              src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=0B1121&color=fff`}
>>>>>>> Stashed changes
              alt="Profile"
              className="w-12 h-12 rounded-full border-2 border-primary-400"
            />
            <div>
<<<<<<< Updated upstream
              <h2 className="font-semibold">{auth.currentUser?.displayName || 'User'}</h2>
              <p className="text-sm text-gray-400 truncate max-w-[150px]">{auth.currentUser?.email}</p>
=======
              <h2 className="font-semibold">{user?.user_metadata?.full_name || 'User'}</h2>
              <p className="text-sm text-gray-400 truncate max-w-[150px]">{user?.email}</p>
>>>>>>> Stashed changes
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
                  ? 'bg-primary-500/20 text-primary-400' 
                  : 'hover:bg-[#1E293B] text-gray-400 hover:text-white'
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
            className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
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
<<<<<<< Updated upstream
          <h1 className="text-2xl lg:text-3xl font-bold mb-2">Welcome back, {auth.currentUser?.displayName?.split(' ')[0] || 'User'}</h1>
=======
          <h1 className="text-2xl lg:text-3xl font-bold mb-2">Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'User'}</h1>
>>>>>>> Stashed changes
          <p className="text-gray-400 text-sm lg:text-base">Here's what's happening with your monitoring system</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
<<<<<<< Updated upstream
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-[#151F32] p-4 lg:p-6 rounded-xl border border-[#1E293B]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-400">
                  {stat.icon}
                </div>
                <span className={`text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full ${
                  stat.trendUp === true
                    ? 'bg-green-500/10 text-green-400'
                    : stat.trendUp === false
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-primary-500/10 text-primary-400'
                }`}>
                  {stat.trend}
                </span>
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold mb-1">{stat.value}</h3>
              <p className="text-gray-400 text-sm">{stat.title}</p>
            </div>
          ))}
=======
          {loading ? (
            Array(4).fill(null).map((_, index) => (
              <div key={index} className="bg-[#151F32] p-6 rounded-xl border border-[#1E293B] animate-pulse">
                <div className="h-10 w-10 bg-primary-500/10 rounded-lg mb-4"></div>
                <div className="h-8 w-24 bg-gray-700 rounded mb-2"></div>
                <div className="h-4 w-32 bg-gray-700 rounded"></div>
              </div>
            ))
          ) : (
            <>
              <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl border border-[#1E293B]">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-400">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-green-500/10 text-green-400">
                    Active
                  </span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-1">{stats.videosProcessed}</h3>
                <p className="text-gray-400 text-sm">Videos Processed</p>
              </div>

              <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl border border-[#1E293B]">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-400">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-red-500/10 text-red-400">
                    Alert
                  </span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-1">{stats.violations}</h3>
                <p className="text-gray-400 text-sm">Violations Detected</p>
              </div>

              <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl border border-[#1E293B]">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-400">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-primary-500/10 text-primary-400">
                    Stable
                  </span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-1">{stats.complianceRate.toFixed(1)}%</h3>
                <p className="text-gray-400 text-sm">Compliance Rate</p>
              </div>

              <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl border border-[#1E293B]">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <span className="text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full bg-primary-500/10 text-primary-400">
                    per vehicle
                  </span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-1">{stats.avgReactionTime.toFixed(2)}s</h3>
                <p className="text-gray-400 text-sm">Avg. Reaction Time</p>
              </div>
            </>
          )}
>>>>>>> Stashed changes
        </div>

        {/* System Status and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* System Status */}
          <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl border border-[#1E293B]">
            <h2 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6">System Status</h2>
            <div className="space-y-3 lg:space-y-4">
              {systemStatus.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 lg:p-4 bg-[#1E293B] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-primary-400">
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
          <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl border border-[#1E293B]">
            <h2 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6">Recent Activity</h2>
            <div className="space-y-3 lg:space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 bg-[#1E293B] rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <p className="text-sm lg:text-base truncate">{activity.event}</p>
                    <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
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