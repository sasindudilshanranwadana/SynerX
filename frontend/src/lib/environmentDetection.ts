export interface EnvironmentInfo {
  isWebContainer: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
  supportsWebSocket: boolean;
  baseUrl: string;
  wsBaseUrl: string;
}

export const detectEnvironment = (): EnvironmentInfo => {
  const hostname = window.location.hostname;
  const isDev = import.meta.env.DEV;
  const runpodUrl = import.meta.env.VITE_RUNPOD_URL;

  const webContainerPatterns = [
    'webcontainer-api.io',
    'webcontainer.io',
    'stackblitz.io',
    'codesandbox.io',
    'csb.app',
    'githubbox.com',
    'local-credentialless.webcontainer-api.io'
  ];

  const isWebContainer = webContainerPatterns.some(pattern => hostname.includes(pattern));

  const supportsWebSocket = !isWebContainer && (
    isDev ||
    (runpodUrl && runpodUrl.trim() !== '')
  );

  let baseUrl: string;
  let wsBaseUrl: string;

  if (isDev) {
    baseUrl = '/api';
    wsBaseUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  } else {
    baseUrl = runpodUrl || 'http://localhost:8000';
    wsBaseUrl = (runpodUrl || 'http://localhost:8000').replace(/^https?/, 'wss');
  }

  return {
    isWebContainer,
    isDevelopment: isDev,
    isProduction: !isDev,
    supportsWebSocket,
    baseUrl,
    wsBaseUrl
  };
};

export const getWebSocketUrl = (path: string): string | null => {
  const env = detectEnvironment();

  if (!env.supportsWebSocket) {
    return null;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${env.wsBaseUrl}${cleanPath}`;
};

export const shouldUsePolling = (): boolean => {
  const env = detectEnvironment();
  return !env.supportsWebSocket;
};
