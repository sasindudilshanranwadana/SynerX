export interface JobMessage {
  type: 'new_job' | 'status_update' | 'job_queued';
  job_id: string;
  r2_url?: string;
  file_name?: string;
  file_size?: number;
  status?: string;
  message?: string;
  queue_position?: number;
}

export interface WebSocketResponse {
  status: 'success' | 'error' | 'job_queued';
  job_id?: string;
  queue_position?: number;
  error?: string;
  summary?: {
    total_jobs: number;
    queue_length: number;
    queue_processor_running: boolean;
  };
  all_jobs?: any[];
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: ((data: WebSocketResponse) => void)[] = [];
  private connectionHandlers: ((connected: boolean) => void)[] = [];

  constructor(baseUrl: string) {
    // Convert HTTP/HTTPS URLs to WebSocket URLs
    if (baseUrl.startsWith('https://')) {
      this.url = baseUrl.replace('https://', 'wss://') + '/ws/jobs';
    } else if (baseUrl.startsWith('http://')) {
      this.url = baseUrl.replace('http://', 'ws://') + '/ws/jobs';
    } else {
      // If no protocol specified, assume HTTP
      this.url = 'ws://' + baseUrl + '/ws/jobs';
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }

        console.log(`[WebSocket] Connecting to: ${this.url}`);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] ✅ Connected');
          this.reconnectAttempts = 0;
          this.notifyConnectionHandlers(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: WebSocketResponse = JSON.parse(event.data);
            this.notifyMessageHandlers(data);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] ❌ Error:', error);
          this.notifyConnectionHandlers(false);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log(`[WebSocket] Closed with code: ${event.code}`);
          this.notifyConnectionHandlers(false);
          
          // Auto-reconnect if not a clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[WebSocket] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            this.reconnectTimeout = setTimeout(() => {
              this.connect().catch(() => {
                // Reconnection failed, will be handled by onerror
              });
            }, 2000 * this.reconnectAttempts);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  sendJob(jobData: JobMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    console.log('[WebSocket] Sending job:', jobData);
    this.ws.send(JSON.stringify(jobData));
  }

  onMessage(handler: (data: WebSocketResponse) => void): void {
    this.messageHandlers.push(handler);
  }

  onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler);
  }

  private notifyMessageHandlers(data: WebSocketResponse): void {
    this.messageHandlers.forEach(handler => handler(data));
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Create singleton instance
const API_BASE = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
export const wsClient = new WebSocketClient(API_BASE);
