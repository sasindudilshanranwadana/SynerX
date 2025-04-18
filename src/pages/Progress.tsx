import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Home, BarChart2, Activity, Upload, FileText,
  RefreshCw, Settings, LogOut, Search, Book,
  Calendar, Users, Code, FileQuestion, ChevronRight,
  Menu, X, ExternalLink, Clock, CheckCircle, PlusCircle,
  Save, Trash2, BarChart, ArrowRight
} from 'lucide-react';
import { fetchJiraTasks, subscribeToTasks } from '../lib/api';

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'to_do' | 'in_progress' | 'done';
  priority: 'high' | 'medium' | 'low';
  type: 'task' | 'epic' | 'bug' | 'story';
  labels?: string[];
  assignee: string | null;
  created_at: string;
  updated_at: string;
}

function Progress() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const auth = getAuth();

  const navItems = [
    { icon: <Home className="w-5 h-5" />, label: 'Home', path: '/' },
    { icon: <BarChart2 className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Upload className="w-5 h-5" />, label: 'Video Upload', path: '/upload' },
    { icon: <Activity className="w-5 h-5" />, label: 'Analytics', path: '/analytics' },
    { icon: <FileText className="w-5 h-5" />, label: 'Reports', path: '/reports' },
    { icon: <RefreshCw className="w-5 h-5" />, label: 'Progress', path: '/progress', active: true },
    { icon: <Settings className="w-5 h-5" />, label: 'Settings', path: '/settings' }
  ];

  const stats = [
    { 
      label: 'completed',
      value: tasks.filter(t => t.status === 'done').length.toString(),
      period: 'in the last 7 days',
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'text-green-400'
    },
    { 
      label: 'updated',
      value: tasks.filter(t => {
        const updatedDate = new Date(t.updated_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return updatedDate > sevenDaysAgo;
      }).length.toString(),
      period: 'in the last 7 days',
      icon: <Clock className="w-6 h-6" />,
      color: 'text-blue-400'
    },
    { 
      label: 'created',
      value: tasks.filter(t => {
        const createdDate = new Date(t.created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return createdDate > sevenDaysAgo;
      }).length.toString(),
      period: 'in the last 7 days',
      icon: <PlusCircle className="w-6 h-6" />,
      color: 'text-purple-400'
    },
    { 
      label: 'due soon',
      value: tasks.filter(t => t.priority === 'high' && t.status !== 'done').length.toString(),
      period: 'high priority tasks',
      icon: <Calendar className="w-6 h-6" />,
      color: 'text-yellow-400'
    }
  ];

  const statusData = [
    { label: 'To Do', value: tasks.filter(t => t.status === 'to_do').length, color: 'bg-blue-400' },
    { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: 'bg-yellow-400' },
    { label: 'Done', value: tasks.filter(t => t.status === 'done').length, color: 'bg-green-400' }
  ];

  const priorityData = [
    { label: 'High', value: tasks.filter(t => t.priority === 'high').length, color: 'bg-red-400' },
    { label: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: 'bg-yellow-400' },
    { label: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: 'bg-green-400' }
  ];

  const recentActivity = tasks
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)
    .map(task => ({
      id: task.project_id,
      title: task.title,
      date: new Date(task.updated_at).toLocaleDateString(),
      tag: task.assignee?.split(' ').map(n => n[0]).join('').toUpperCase()
    }));

  React.useEffect(() => {
    loadTasks();
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToTasks((updatedTasks) => {
      setTasks(updatedTasks);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const loadTasks = async () => {
    try {
      setError(null);
      const data = await fetchJiraTasks();
      console.log("Fetched tasks:", data);
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setError('Failed to load tasks. Please try again later.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#151F32] border-b border-[#1E293B] p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="text-xl font-bold">Project Progress</span>
          <img
            src={auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${auth.currentUser?.displayName || 'User'}&background=0B1121&color=fff`}
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
              src={auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${auth.currentUser?.displayName || 'User'}&background=0B1121&color=fff`}
              alt="Profile"
              className="w-12 h-12 rounded-full border-2 border-primary-400"
            />
            <div>
              <h2 className="font-semibold">{auth.currentUser?.displayName || 'User'}</h2>
              <p className="text-sm text-gray-400 truncate max-w-[150px]">{auth.currentUser?.email}</p>
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
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold">Project Progress</h1>
            <div className="flex items-center gap-4 mt-2">
              <Link to="/progress" className="text-primary-400">Summary</Link>
              <Link to="/progress/board" className="text-gray-400 hover:text-white">Board</Link>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 mt-10">
              {error}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              No tasks found. Check if your Supabase table has data.
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map((stat, index) => (
                  <div key={index} className="bg-[#151F32] p-6 rounded-xl border border-[#1E293B]">
                    <div className={`${stat.color} mb-2`}>{stat.icon}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{stat.value}</span>
                      <span className="text-sm text-gray-400">{stat.label}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{stat.period}</p>
                  </div>
                ))}
              </div>

              {/* Status Overview and Priority Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Status Overview */}
                <div className="bg-[#151F32] p-6 rounded-xl border border-[#1E293B]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Status overview</h2>
                    <Link to="/progress/board" className="text-primary-400 hover:text-primary-500 text-sm flex items-center gap-1">
                      View all issues
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="space-y-4">
                    {statusData.map((status, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-24 text-sm text-gray-400">{status.label}</div>
                        <div className="flex-1 h-2 bg-[#1E293B] rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${status.color}`} 
                            style={{ width: `${(status.value / Math.max(...statusData.map(s => s.value), 1)) * 100}%` }} 
                          />
                        </div>
                        <div className="w-8 text-right text-sm">{status.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority Breakdown */}
                <div className="bg-[#151F32] p-6 rounded-xl border border-[#1E293B]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Priority breakdown</h2>
                    <Link to="/progress/board" className="text-primary-400 hover:text-primary-500 text-sm flex items-center gap-1">
                      View all items
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="space-y-4">
                    {priorityData.map((priority, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-24 text-sm text-gray-400">{priority.label}</div>
                        <div className="flex-1 h-2 bg-[#1E293B] rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${priority.color}`} 
                            style={{ width: `${(priority.value / Math.max(...priorityData.map(p => p.value), 1)) * 100}%` }} 
                          />
                        </div>
                        <div className="w-8 text-right text-sm">{priority.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-[#151F32] p-6 rounded-xl border border-[#1E293B]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Recent activity</h2>
                  <Link to="/progress/board" className="text-primary-400 hover:text-primary-500 text-sm flex items-center gap-1">
                    View all activity
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-[#1E293B] rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-primary-400">{activity.id}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-400">{activity.date}</span>
                        </div>
                        <h3 className="font-medium">{activity.title}</h3>
                      </div>
                      {activity.tag && (
                        <span className="px-2 py-1 text-xs font-medium bg-primary-500/10 text-primary-400 rounded">
                          {activity.tag}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default Progress;