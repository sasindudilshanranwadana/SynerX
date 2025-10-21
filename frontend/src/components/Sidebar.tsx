import React from 'react';
import Navigation from './Navigation';
import { getStoredTheme } from '../lib/theme';

interface SidebarProps {
  activePath: string;
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ activePath, isOpen, onClose }: SidebarProps) {
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, []);

  return (
    <>
      <aside className={`fixed top-0 left-0 h-full w-64 z-40 border-r ${
        isDark 
          ? 'bg-[#151F32] border-[#1E293B]' 
          : 'bg-white border-gray-200'
      } ${
        isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:block`}
      style={{ 
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        transform: 'translateX(0)'
      }}>
        <Navigation activePath={activePath} onCloseSidebar={onClose} />
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onClose}
          role="dialog"
        />
      )}
    </>
  );
}

export default Sidebar;