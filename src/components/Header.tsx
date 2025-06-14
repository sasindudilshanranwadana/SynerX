import React from 'react';
import { Menu, X } from 'lucide-react';
<<<<<<< Updated upstream
import { getAuth } from 'firebase/auth';
=======
import { supabase } from '../lib/supabase';
>>>>>>> Stashed changes

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

function Header({ title, onToggleSidebar, isSidebarOpen }: HeaderProps) {
<<<<<<< Updated upstream
  const auth = getAuth();
=======
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);
>>>>>>> Stashed changes

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#151F32] border-b border-[#1E293B] p-4">
      <div className="flex items-center justify-between">
        <button onClick={onToggleSidebar} className="p-2">
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <span className="text-xl font-bold">{title}</span>
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
  );
}

export default Header;