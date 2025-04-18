import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Home, 
  BarChart2, 
  Upload, 
  Activity, 
  FileText, 
  RefreshCw,
  Settings, 
  LogOut 
} from 'lucide-react';
import { getAuth } from 'firebase/auth';

interface NavigationProps {
  activePath: string;
  onCloseSidebar?: () => void;
}

export const navItems = [
  { icon: <Home className="w-5 h-5" />, label: 'Home', path: '/' },
  { icon: <BarChart2 className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard' },
  { icon: <Upload className="w-5 h-5" />, label: 'Video Upload', path: '/upload' },
  { icon: <Activity className="w-5 h-5" />, label: 'Analytics', path: '/analytics' },
  { icon: <FileText className="w-5 h-5" />, label: 'Reports', path: '/reports' },
  { icon: <RefreshCw className="w-5 h-5" />, label: 'Progress', path: '/progress' },
  { icon: <Settings className="w-5 h-5" />, label: 'Settings', path: '/settings' }
];

function Navigation({ activePath, onCloseSidebar }: NavigationProps) {
  const auth = getAuth();

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
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
            onClick={onCloseSidebar}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
              item.path === activePath
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
    </>
  );
}

export default Navigation;