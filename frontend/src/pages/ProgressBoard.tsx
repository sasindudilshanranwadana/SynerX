import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Home, BarChart2, Activity, Upload, FileText,
  RefreshCw, Settings, LogOut, Menu, X,
  Clock, CheckCircle, AlertCircle
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
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  React.useEffect(() => {
    loadTasks();
    const unsubscribe = subscribeToTasks((updatedTasks) => {
      const groupedTasks = {
        todo: updatedTasks.filter(task => task.status === 'to_do'),
        inProgress: updatedTasks.filter(task => task.status === 'in_progress'),
        done: updatedTasks.filter(task => task.status === 'done')
      };
      setTasks(groupedTasks);
    });
    return () => unsubscribe();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await fetchJiraTasks();
      const groupedTasks = {
        todo: data.filter(t => t.status === 'to_do'),
        inProgress: data.filter(t => t.status === 'in_progress'),
        done: data.filter(t => t.status === 'done')
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
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'technical & development': return 'bg-yellow-500/10 text-yellow-400';
      case 'documentation':
      case 'coordination': return 'bg-red-500/10 text-red-400';
      case 'planning':
      case 'setup': return 'bg-purple-500/10 text-purple-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getAssigneeInitials = (assignee: string | null) => {
    if (!assignee) return 'UN';
    return assignee.split(' ').map(name => name[0]).join('').toUpperCase();
  };

  const getAssigneeColor = (initials: string) => {
    const colors: { [key: string]: string } = {
      'SR': 'bg-cyan-500', 'QV': 'bg-gray-500', 'FP': 'bg-purple-500',
      'JA': 'bg-blue-500', 'TT': 'bg-teal-500', 'RC': 'bg-indigo-500', 'UN': 'bg-gray-500'
    };
    return colors[initials] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      {/* Sidebar and Header omitted for brevity */}
      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold">Project Progress</h1>
            <div className="flex items-center gap-4 mt-2">
              <Link to="/progress" className="text-gray-400 hover:text-white">Summary</Link>
              <Link to="/progress/board" className="text-primary-400">Board</Link>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center h-64 items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['todo', 'inProgress', 'done'].map((key, idx) => {
                const col = key as keyof typeof tasks;
                const icon = col === 'todo' ? <AlertCircle className="w-5 h-5 text-gray-400" /> :
                              col === 'inProgress' ? <Clock className="w-5 h-5 text-blue-400" /> :
                              <CheckCircle className="w-5 h-5 text-green-400" />;
                const title = col === 'todo' ? 'TO DO' : col === 'inProgress' ? 'IN PROGRESS' : 'DONE';
                return (
                  <div key={idx} className="bg-[#151F32] rounded-xl border border-[#1E293B] p-4">
                    <div className="flex items-center gap-2 mb-4">
                      {icon}<h2 className="font-semibold">{title} ({tasks[col].length})</h2>
                    </div>
                    <div className="space-y-3">
                      {tasks[col].map(task => (
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
                              <span key={index} className={`inline-block px-2 py-1 rounded text-xs ${getLabelColor(label)}`}>{label}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ProgressBoard;
