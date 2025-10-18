import AWS from 'aws-sdk';

const R2_ACCOUNT_ID = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || 'f11fa7adea3fa8c103ead0f687971f53';
const R2_ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID || 'c3a0939c7c77d8b6cd2a0685290824ba';
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '13acf0dae3a6fe85808d91d52d4428b2d6d6056a082e4c99831cf56d6415530e';
export const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME || 'synerx-videos';

export const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const R2_CONFIG = {
  endpoint: R2_ENDPOINT,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
  region: 'auto',
  s3ForcePathStyle: true
};

AWS.config.update(R2_CONFIG);

export const s3Client = new AWS.S3();
