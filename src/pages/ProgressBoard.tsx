import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import {
  Home, BarChart2, Activity, Upload, FileText,
  RefreshCw, Settings, LogOut, Menu, X,
  Clock, CheckCircle, AlertCircle, User
} from 'lucide-react';
import { fetchJiraTasks, subscribeToTasks } from '../lib/api';
import { Task } from '../lib/types';

function ProgressBoard() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [tasks, setTasks] = React.useState<{
    todo: Task[];
    inProgress: Task[];
    done: Task[];
  }>({
    todo: [],
    inProgress: [],
    done: []
  });
  const [loading, setLoading] = React.useState(true);
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

  React.useEffect(() => {
    loadTasks();
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToTasks((updatedTasks) => {
      const groupedTasks = {
        todo: updatedTasks.filter(task => task.status === 'to_do'),
        inProgress: updatedTasks.filter(task => task.status === 'in_progress'),
        done: updatedTasks.filter(task => task.status === 'done')
      };
      setTasks(groupedTasks);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const loadTasks = async () => {
    try {
      const data = await fetchJiraTasks();
      const groupedTasks = {
        todo: data.filter(task => task.status === 'to_do'),
        inProgress: data.filter(task => task.status === 'in_progress'),
        done: data.filter(task => task.status === 'done')
      };
      setTasks(groupedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
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

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'technical':
      case 'development':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'documentation':
      case 'coordination':
        return 'bg-red-500/10 text-red-400';
      case 'planning':
      case 'setup':
        return 'bg-purple-500/10 text-purple-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getAssigneeInitials = (assignee: string | null) => {
    if (!assignee) return 'UN';
    return assignee.split(' ').map(name => name[0]).join('').toUpperCase();
  };

  const getAssigneeColor = (initials: string) => {
    const colors: { [key: string]: string } = {
      'SR': 'bg-cyan-500',
      'QV': 'bg-gray-500',
      'FP': 'bg-purple-500',
      'JA': 'bg-blue-500',
      'TT': 'bg-teal-500',
      'RC': 'bg-indigo-500',
      'UN': 'bg-gray-500'
    };
    return colors[initials] || 'bg-gray-500';
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
              <Link to="/progress" className="text-gray-400 hover:text-white">Summary</Link>
              <Link to="/progress/board" className="text-primary-400">Board</Link>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
            </div>
          ) : (
            /* Board */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* To Do Column */}
              <div className="bg-[#151F32] rounded-xl border border-[#1E293B] p-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                  <h2 className="font-semibold">TO DO ({tasks.todo.length})</h2>
                </div>
                <div className="space-y-3">
                  {tasks.todo.map(task => (
                    <div key={task.id} className="bg-[#1E293B] p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-primary-400">{task.project_id}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getAssigneeColor(getAssigneeInitials(task.assignee))}`}>
                          {getAssigneeInitials(task.assignee)}
                        </div>
                      </div>
                      <h3 className="font-medium mb-3">{task.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        {task.labels?.map((label, index) => (
                          <span key={index} className={`inline-block px-2 py-1 rounded text-xs ${getLabelColor(label)}`}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* In Progress Column */}
              <div className="bg-[#151F32] rounded-xl border border-[#1E293B] p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <h2 className="font-semibold">IN PROGRESS ({tasks.inProgress.length})</h2>
                </div>
                <div className="space-y-3">
                  {tasks.inProgress.map(task => (
                    <div key={task.id} className="bg-[#1E293B] p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-primary-400">{task.project_id}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getAssigneeColor(getAssigneeInitials(task.assignee))}`}>
                          {getAssigneeInitials(task.assignee)}
                        </div>
                      </div>
                      <h3 className="font-medium mb-3">{task.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        {task.labels?.map((label, index) => (
                          <span key={index} className={`inline-block px-2 py-1 rounded text-xs ${getLabelColor(label)}`}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Done Column */}
              <div className="bg-[#151F32] rounded-xl border border-[#1E293B] p-4">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <h2 className="font-semibold">DONE ({tasks.done.length})</h2>
                </div>
                <div className="space-y-3">
                  {tasks.done.map(task => (
                    <div key={task.id} className="bg-[#1E293B] p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-primary-400">{task.project_id}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getAssigneeColor(getAssigneeInitials(task.assignee))}`}>
                          {getAssigneeInitials(task.assignee)}
                        </div>
                      </div>
                      <h3 className="font-medium mb-3">{task.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        {task.labels?.map((label, index) => (
                          <span key={index} className={`inline-block px-2 py-1 rounded text-xs ${getLabelColor(label)}`}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ProgressBoard;