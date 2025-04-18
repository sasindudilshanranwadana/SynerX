import React from 'react';
import { Menu, X } from 'lucide-react';
import { getAuth } from 'firebase/auth';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

function Header({ title, onToggleSidebar, isSidebarOpen }: HeaderProps) {
  const auth = getAuth();

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#151F32] border-b border-[#1E293B] p-4">
      <div className="flex items-center justify-between">
        <button onClick={onToggleSidebar} className="p-2">
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <span className="text-xl font-bold">{title}</span>
        <img
          src={auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${auth.currentUser?.displayName || 'User'}&background=0B1121&color=fff`}
          alt="Profile"
          className="w-8 h-8 rounded-full border-2 border-primary-400"
        />
      </div>
    </div>
  );
}

export default Header;