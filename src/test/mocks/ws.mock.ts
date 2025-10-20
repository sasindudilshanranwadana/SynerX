import { act } from '@testing-library/react';

export class WSStub {
  onopen?: ((event: Event) => void) | null = null;
  onerror?: ((event: Event) => void) | null = null;
  onclose?: ((event: CloseEvent) => void) | null = null;
  onmessage?: ((event: MessageEvent) => void) | null = null;
  readyState: number = 0;

  constructor(public url: string) {
    (globalThis as any).lastWS = this;
  }

  open() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  error() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  close() {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  send(data: any) {
    // no-op
  }

  message(data: any) {
    if (this.onmessage) {
      act(() => {
        this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
      });
    }
  }

  addEventListener(type: string, listener: any) {
    if (type === 'open') this.onopen = listener;
    if (type === 'error') this.onerror = listener;
    if (type === 'close') this.onclose = listener;
    if (type === 'message') this.onmessage = listener;
  }

  removeEventListener(type: string, listener: any) {
    if (type === 'open') this.onopen = null;
    if (type === 'error') this.onerror = null;
    if (type === 'close') this.onclose = null;
    if (type === 'message') this.onmessage = null;
  }
}

export const createWSStub = () => {
  return WSStub;
};

export const getLastWSInstance = (): WSStub | undefined => {
  return (globalThis as any).lastWS;
};

export const clearWSInstance = () => {
  (globalThis as any).lastWS = undefined;
};

export const cleanupWebSocket = () => {
  const ws = getLastWSInstance();
  if (ws && ws.readyState !== 3) {
    ws.close();
  }
  clearWSInstance();
};
