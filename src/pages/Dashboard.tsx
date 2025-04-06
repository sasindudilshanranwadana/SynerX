import React from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Upload, 
  BarChart2, 
  FileText, 
  LogOut,
  Camera,
  AlertTriangle,
  CheckCircle,
  Cpu,
  Activity,
  Clock,
  ArrowUpRight,
  Loader2,
  Settings as SettingsIcon,
  Home,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import VideoUpload from './VideoUpload';
import Analytics from './Analytics';
import Monitoring from './Monitoring';
import Reports from './Reports';
import Incidents from './Incidents';
import Settings from './Settings';
import TeamLogs from './TeamLogs';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '' },
    { icon: Camera, label: 'Monitoring', path: 'monitoring' },
    { icon: Upload, label: 'Video Upload', path: 'upload' },
    { icon: BarChart2, label: 'Analytics', path: 'analytics' },
    { icon: AlertTriangle, label: 'Incidents', path: 'incidents' },
    { icon: FileText, label: 'Reports', path: 'reports' },
    { icon: ClipboardList, label: 'Team Logs', path: 'team-logs' },
    { icon: SettingsIcon, label: 'Settings', path: 'settings' }
  ];

  const stats = [
    { 
      icon: Camera, 
      label: 'Videos Processed', 
      value: '247',
      trend: '+12% this week',
      color: 'cyan'
    },
    { 
      icon: AlertTriangle, 
      label: 'Violations Detected', 
      value: '23',
      trend: '-5% from last week',
      color: 'yellow'
    },
    { 
      icon: CheckCircle, 
      label: 'Compliance Rate', 
      value: '94%',
      trend: 'Stable',
      color: 'green'
    },
    { 
      icon: Clock, 
      label: 'Processing Time', 
      value: '1.2s',
      trend: 'per frame',
      color: 'purple'
    }
  ];

  const systemStatus = [
    { label: 'YOLOv8 Model', status: 'Operational', icon: Cpu },
    { label: 'Video Processing', status: 'Active', icon: Activity },
    { label: 'Database Sync', status: 'Connected', icon: Loader2 }
  ];

  const recentActivity = [
    {
      time: '2 minutes ago',
      event: 'New violation detected at Crossing B-15',
      type: 'alert'
    },
    {
      time: '15 minutes ago',
      event: 'System performance optimization completed',
      type: 'system'
    },
    {
      time: '1 hour ago',
      event: 'Daily compliance report generated',
      type: 'report'
    },
    {
      time: '2 hours ago',
      event: 'Model accuracy improved by 2.3%',
      type: 'model'
    },
    {
      time: '3 hours ago',
      event: 'New video footage uploaded from Location A',
      type: 'upload'
    }
  ];

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-[#0B1121] text-gray-900 dark:text-white transition-colors duration-200">
      {/* Sidebar */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-64 bg-white dark:bg-[#0F172A] border-r border-gray-200 dark:border-gray-800 transition-colors duration-200"
      >
        <div className="p-4">
          <div className="flex items-center space-x-4 mb-8 p-2 bg-gray-50 dark:bg-white/5 rounded-lg">
            <img
              src={user?.photoURL || 'https://via.placeholder.com/40'}
              alt="Profile"
              className="w-10 h-10 rounded-full ring-2 ring-cyan-500/30"
            />
            <div>
              <p className="font-semibold">{user?.displayName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
          </div>

          <nav className="space-y-2">
            <Link
              to="/"
              className="flex items-center space-x-3 w-full p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-cyan-500/10 hover:text-cyan-500 transition-all duration-300"
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </Link>

            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex items-center space-x-3 w-full p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-cyan-500/10 hover:text-cyan-500 transition-all duration-300"
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-3 w-full p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-all duration-300"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </nav>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <Routes>
            <Route path="" element={
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">
                      Welcome back, {user?.displayName?.split(' ')[0]}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                      Here's what's happening with your monitoring system
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {stats.map((stat, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white dark:bg-[#0F172A] p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-cyan-500/50 transition-all duration-300"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <stat.icon className={`w-8 h-8 text-${stat.color}-500`} />
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            {stat.trend} <ArrowUpRight className="w-3 h-3 ml-1" />
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">{stat.label}</p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* System Status */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-white dark:bg-[#0F172A] p-6 rounded-xl border border-gray-200 dark:border-gray-800"
                    >
                      <h2 className="text-xl font-semibold mb-4">System Status</h2>
                      <div className="space-y-4">
                        {systemStatus.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <item.icon className="w-5 h-5 text-cyan-500" />
                              <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                            </div>
                            <span className="text-green-500 text-sm">{item.status}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Recent Activity */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="lg:col-span-2 bg-white dark:bg-[#0F172A] p-6 rounded-xl border border-gray-200 dark:border-gray-800"
                    >
                      <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                      <div className="space-y-4">
                        {recentActivity.map((activity, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg"
                          >
                            <div className="w-2 h-2 rounded-full bg-cyan-500" />
                            <div className="flex-1">
                              <p className="text-gray-700 dark:text-gray-300">{activity.event}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-500">{activity.time}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            } />
            <Route path="monitoring" element={<Monitoring />} />
            <Route path="upload" element={<VideoUpload />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="reports" element={<Reports />} />
            <Route path="team-logs" element={<TeamLogs />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;