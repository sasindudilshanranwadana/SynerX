import React from 'react';
import { getStoredTheme } from '../lib/theme';

const RUNPOD_API_BASE = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';

interface ServerStatusIndicatorProps {
  className?: string;
}

function ServerStatusIndicator({ className = '' }: ServerStatusIndicatorProps) {
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');
  const [runpodStatus, setRunpodStatus] = React.useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [frontendStatus] = React.useState<'connected'>('connected'); // Frontend is always connected if component renders

  React.useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    
    // Check RunPod connection
    checkRunPodConnection();
    
    // Set up periodic health check
    const interval = setInterval(checkRunPodConnection, 30000); // Check every 30 seconds
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      clearInterval(interval);
    };
  }, []);

  const checkRunPodConnection = async () => {
    setRunpodStatus('connecting');
    
    try {
      const response = await fetch(`${RUNPOD_API_BASE}/jobs/completed`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        setRunpodStatus('connected');
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

  const overallStatus = runpodStatus === 'connected' && frontendStatus === 'connected' ? 'connected' : 
                      runpodStatus === 'connecting' ? 'connecting' : 'error';

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-sm ${
      isDark 
        ? 'bg-[#151F32]/90 border border-[#1E293B]' 
        : 'bg-white/90 border border-gray-200'
    } ${className}`}>
      <div className="relative">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(overallStatus)}`}></div>
        {overallStatus === 'connected' && (
          <div className={`absolute inset-0 w-3 h-3 rounded-full ${getStatusColor(overallStatus)} ${getStatusAnimation(overallStatus)} opacity-75`}></div>
        )}
        {overallStatus === 'connecting' && (
          <div className={`absolute inset-0 w-3 h-3 rounded-full ${getStatusColor(overallStatus)} ${getStatusAnimation(overallStatus)}`}></div>
        )}
      </div>
      <span className={`text-xs font-medium ${
        isDark ? 'text-gray-300' : 'text-gray-700'
      }`}>
        {overallStatus === 'connected' ? 'Connected with Runpod' :
         overallStatus === 'connecting' ? 'Connecting...' :
         'Disconnected from Runpod'}
      </span>
    </div>
  );
}

export default ServerStatusIndicator;