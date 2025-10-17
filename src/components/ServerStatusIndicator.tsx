import React from 'react';
import { getStoredTheme } from '../lib/theme';

interface ServerStatusIndicatorProps {
  className?: string;
}

function ServerStatusIndicator({ className = '' }: ServerStatusIndicatorProps) {
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');
  const [runpodStatus, setRunpodStatus] = React.useState<'connecting' | 'connected' | 'disconnected' | 'error' | 'warming'>('connecting');
  const [retryCount, setRetryCount] = React.useState(0);

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

  const checkRunPodConnection = async (attempt: number = 0) => {
    const maxRetries = 5;

    if (attempt === 0) {
      setRunpodStatus('connecting');
      setRetryCount(0);
    }

    try {
      const apiBase = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add RunPod API key to all requests (proxy will forward it in dev mode)
      if (import.meta.env.VITE_RUNPOD_API_KEY) {
        headers['Authorization'] = `Bearer ${import.meta.env.VITE_RUNPOD_API_KEY}`;
      }

      // Increase timeout for cold starts (serverless needs time to wake up)
      const timeoutMs = attempt === 0 ? 10000 : 30000 + (attempt * 5000);

      const response = await fetch(`${apiBase}/`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Read response as text first (can only read body once)
      const responseText = await response.text();

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);

          // Check if the response matches the expected health check message
          if (data.message === "SynerX API is running!" && data.status === "ok") {
            setRunpodStatus('connected');
            setRetryCount(0);
            console.log('[ServerStatus] Successfully connected to RunPod!');
            return;
          }
        } catch (parseError) {
          console.error('[ServerStatus] Failed to parse response:', parseError);
        }
      }

      // Check for "no workers available" error (cold start)
      if (responseText.includes('no workers available') || responseText.includes('worker') || response.status === 503) {
        if (attempt < maxRetries) {
          setRunpodStatus('warming');
          setRetryCount(attempt + 1);

          // Exponential backoff: 3s, 6s, 12s, 24s, 48s
          const backoffMs = Math.min(3000 * Math.pow(2, attempt), 48000);
          console.log(`[ServerStatus] Cold start detected, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);

          setTimeout(() => checkRunPodConnection(attempt + 1), backoffMs);
          return;
        }
      }

      console.error(`[ServerStatus] Connection failed: ${response.status} - ${responseText}`);
      setRunpodStatus('error');
    } catch (error: any) {
      // Timeout or network error during cold start
      if ((error.name === 'TimeoutError' || error.message?.includes('timeout')) && attempt < maxRetries) {
        setRunpodStatus('warming');
        setRetryCount(attempt + 1);

        const backoffMs = Math.min(3000 * Math.pow(2, attempt), 48000);
        console.log(`[ServerStatus] Timeout during warm-up, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);

        setTimeout(() => checkRunPodConnection(attempt + 1), backoffMs);
        return;
      }

      setRunpodStatus('error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'warming':
        return 'bg-orange-500';
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
      case 'warming':
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
      case 'warming':
        return retryCount > 0 ? `Warming up... (${retryCount}/5)` : 'Warming up...';
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
        {(runpodStatus === 'connecting' || runpodStatus === 'warming') && (
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