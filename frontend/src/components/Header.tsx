import React from 'react';
import { Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getStoredTheme } from '../lib/theme';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

function Header({ title, onToggleSidebar, isSidebarOpen }: HeaderProps) {
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

  return (
    <div className={`lg:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3 border-b ${
      isDark 
        ? 'bg-[#151F32] border-[#1E293B]' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <button onClick={onToggleSidebar} className="p-1 sm:p-2">
          {isSidebarOpen ? <X data-testid="x-icon" className="w-6 h-6" /> : <Menu data-testid="menu-icon" className="w-6 h-6" />}
        </button>
        <span className="text-lg sm:text-xl font-bold truncate px-4">{title}</span>
        <img
          src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=0B1121&color=fff`}
          alt="Profile"
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-primary-500 flex-shrink-0"
        />
      </div>
    </div>
  );
}

export default Header;