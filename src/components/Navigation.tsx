import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Home, 
  BarChart2, 
  Upload, 
  Activity, 
  Play,
  Settings, 
  LogOut 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getStoredTheme } from '../lib/theme';

interface NavigationProps {
  activePath: string;
  onCloseSidebar?: () => void;
}

export const navItems = [
  { icon: <Home className="w-5 h-5" />, label: 'Home', path: '/' },
  { icon: <BarChart2 className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard' },
  { icon: <Upload className="w-5 h-5" />, label: 'Video Upload', path: '/upload' },
  { icon: <Activity className="w-5 h-5" />, label: 'Analytics', path: '/analytics' },
  { icon: <Play className="w-5 h-5" />, label: 'Video Playback', path: '/playback' },
  { icon: <Settings className="w-5 h-5" />, label: 'Settings', path: '/settings' }
];

function Navigation({ activePath, onCloseSidebar }: NavigationProps) {
  const [user, setUser] = React.useState<any>(null);
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      {/* User Profile */}
      <div className={`p-4 sm:p-6 mt-14 lg:mt-0 border-b ${
        isDark ? 'border-[#1E293B]' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <img
            src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=0B1121&color=fff`}
            alt="Profile"
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-primary-500 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm sm:text-base truncate">{user?.user_metadata?.full_name || 'User'}</h2>
            <p className={`text-xs sm:text-sm truncate ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 sm:p-4 overflow-y-auto h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)]">
        {navItems.map((item, index) => (
          <Link
            key={index}
            to={item.path}
            onClick={onCloseSidebar}
            className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-1 transition-colors text-sm sm:text-base ${
              item.path === activePath
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
      <div className="absolute bottom-0 w-full p-3 sm:p-4">
        <button
          onClick={handleSignOut}
          className={`flex items-center gap-2 w-full px-3 sm:px-4 py-2 rounded-lg text-red-500 transition-colors text-sm sm:text-base ${
            isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
          }`}
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </>
  );
}

export default Navigation;