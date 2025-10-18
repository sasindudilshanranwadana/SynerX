import { s3Client, R2_BUCKET_NAME } from './r2Config';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface R2UploadResult {
  success: boolean;
  url: string;
  key: string;
  error?: string;
}

export const uploadVideoToR2 = async (
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<R2UploadResult> => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = file.name.split('.').pop() || 'mp4';
    const baseName = file.name.split('.').slice(0, -1).join('.') || 'video';
    const uniqueFilename = `${baseName}_${timestamp}.${fileExtension}`;

    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: uniqueFilename,
      Body: file,
      ContentType: file.type || 'video/mp4',
      CacheControl: 'public, max-age=31536000'
    };

    const uploadOptions = {
      partSize: 5 * 1024 * 1024,
      queueSize: 4
    };

    const upload = s3Client.upload(uploadParams, uploadOptions);

    if (onProgress) {
      upload.on('httpUploadProgress', (progress) => {
        const loaded = progress.loaded || 0;
        const total = progress.total || file.size;
        const percentage = Math.round((loaded / total) * 100);

        onProgress({
          loaded,
          total,
          percentage
        });
      });
    }

    const result = await upload.promise();

    const publicUrl = `https://pub-55e2fc15b81c4beb945c66aaa32aa5ea.r2.dev/${uniqueFilename}`;

    return {
      success: true,
      url: publicUrl,
      key: uniqueFilename
    };
  } catch (error: any) {
    console.error('R2 upload failed:', error);
    return {
      success: false,
      url: '',
      key: '',
      error: error.message || 'Upload failed'
    };
  }
};

export const generateJobId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
