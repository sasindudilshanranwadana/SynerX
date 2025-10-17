export interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  signatureVersion: string;
}

export const R2_CONFIG: R2Config = {
  accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || '',
  secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '',
  endpoint: `https://${import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  signatureVersion: 'v4'
};

export const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME || 'synerx-videos';

export const API_BASE = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
