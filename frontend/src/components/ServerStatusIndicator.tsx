import React from 'react';
import { getStoredTheme } from '../lib/theme';

interface ServerStatusIndicatorProps {
  className?: string;
}

function ServerStatusIndicator({ className = '' }: ServerStatusIndicatorProps) {
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');
  const [runpodStatus, setRunpodStatus] = React.useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    
    // Check RunPod connection
    checkRunPodConnection();
    
    // Set up periodic health check every 30 seconds
    const interval = setInterval(checkRunPodConnection, 30000);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      clearInterval(interval);
    };
  }, []);

  const checkRunPodConnection = async () => {
    setRunpodStatus('connecting');
    
    try {
      const apiBase = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000');
      const response = await fetch(`${apiBase}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if the response matches the expected health check message
        if (data.message === "SynerX API is running!" && data.status === "ok") {
          setRunpodStatus('connected');
        } else {
          setRunpodStatus('error');
        }
      } else {
        setRunpodStatus('error');
      }
    } catch (error) {
      setRunpodStatus('error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'disconnected':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusAnimation = (status: string) => {
    switch (status) {
      case 'connected':
        return 'animate-ping';
      case 'connecting':
        return 'animate-pulse';
      default:
        return '';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'RunPod Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'RunPod Disconnected';
      case 'disconnected':
        return 'RunPod Disconnected';
      default:
        return 'Unknown Status';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-sm ${
      isDark 
        ? 'bg-[#151F32]/90 border border-[#1E293B]' 
        : 'bg-white/90 border border-gray-200'
    } ${className}`}>
      <div className="relative">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(runpodStatus)}`}></div>
        {runpodStatus === 'connected' && (
          <div className={`absolute inset-0 w-3 h-3 rounded-full ${getStatusColor(runpodStatus)} ${getStatusAnimation(runpodStatus)} opacity-75`}></div>
        )}
        {runpodStatus === 'connecting' && (
          <div className={`absolute inset-0 w-3 h-3 rounded-full ${getStatusColor(runpodStatus)} ${getStatusAnimation(runpodStatus)}`}></div>
        )}
      </div>
      <span className={`text-xs font-medium ${
        isDark ? 'text-gray-300' : 'text-gray-700'
      }`}>
        {getStatusText(runpodStatus)}
      </span>
    </div>
  );
}

export default ServerStatusIndicator;