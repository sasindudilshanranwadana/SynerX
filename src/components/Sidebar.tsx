import React from 'react';
import Navigation from './Navigation';

interface SidebarProps {
  activePath: string;
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ activePath, isOpen, onClose }: SidebarProps) {
  return (
    <>
      <aside className={`fixed top-0 left-0 h-full w-64 bg-[#151F32] border-r border-[#1E293B] transform transition-transform duration-300 ease-in-out z-40 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <Navigation activePath={activePath} onCloseSidebar={onClose} />
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}

export default Sidebar;