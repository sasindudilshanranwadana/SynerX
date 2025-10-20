import { supabase } from './supabase';
import { 
  getAllVideos, 
  getAllTrackingResults, 
  getAllVehicleCounts,
  insertVideo,
  updateVideo,
  getOverallAnalytics,
  insertTrackingResults,
  insertVehicleCounts,
  insertProcessingJob,
  updateProcessingJob,
  getAllProcessingJobs,
  getProcessingJobsByStatus
} from './database';
import { Video, TrackingResultInsert, VehicleCountInsert, Job, JobsResponse } from './types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { Chart, registerables } from 'chart.js';
import Papa from 'papaparse';
Chart.register(...registerables);

// New API functions for video management
export const fetchFilteredVideos = async (filters: {
  dateFrom?: string;
  dateTo?: string;
  orderBy?: string;
  orderDesc?: string;
  limit?: number;
  offset?: number;
} = {}) => {
  try {
    let endpoint = '/data/videos/filter';
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    if (filters.orderBy) params.set('order_by', filters.orderBy);
    if (filters.orderDesc) params.set('order_desc', filters.orderDesc);
    if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
    if (typeof filters.offset === 'number') params.set('offset', String(filters.offset));
    
    if (params.toString()) {
      endpoint += '?' + params.toString();
    }
    
    const data = await fetchJSON(endpoint);
    return data; // includes: data, count (total), limit, offset, next_href, prev_href
  } catch (error) {
    console.error('Error fetching filtered videos:', error);
    throw error;
  }
};

export const fetchVideoSummary = async (videoId: number) => {
  try {
    const data = await fetchJSON(`/data/summary/by-video/${videoId}`);
    return data;
  } catch (error) {
    console.error('Error fetching video summary:', error);
    throw error;
  }
};

export const deleteVideoFromRunPod = async (videoId: number) => {
  try {
    const response = await fetch(`${RUNPOD_API_BASE}/data/videos/${videoId}`, {
      method: 'DELETE',
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok || data.status !== 'success') {
      throw new Error(data.error || response.statusText);
    }
    return data;
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
};

export const getStreamingVideoUrl = (videoId: number): string => {
  return `${RUNPOD_API_BASE}/data/video/${videoId}`;
};

export const getSignedStreamingUrl = async (videoId: number, expiresInSeconds: number = 300): Promise<string> => {
  const data = await fetchJSON(`/data/video/${videoId}/signed?expires_in=${expiresInSeconds}`);
  if (data.status !== 'success' || !data.url) throw new Error('Failed to get signed URL');
  return data.url as string;
};

// Helper function to create chart and capture image
const getChartImage = async (
  chartType: 'pie' | 'bar' | 'line',
  chartData: any,
  chartOptions: any = {},
  width: number = 400,
  height: number = 400
): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      // Create off-screen canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.warn('Could not get canvas context for chart');
        resolve(null);
        return;
      }

      // Create chart with animation disabled for faster rendering
      const chart = new Chart(ctx, {
        type: chartType,
        data: chartData,
        options: {
          ...chartOptions,
          animation: false, // Disable animation for immediate rendering
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            ...chartOptions.plugins,
            legend: {
              ...chartOptions.plugins?.legend,
              display: true
            }
          }
        }
      });

      // Small delay to ensure chart is fully rendered
      setTimeout(() => {
        try {
          const imageData = chart.toBase64Image();
          chart.destroy(); // Clean up chart instance
          resolve(imageData);
        } catch (error) {
          console.warn('Could not capture chart image:', error);
          chart.destroy();
          resolve(null);
        }
      }, 100);
    } catch (error) {
      console.warn('Error creating chart:', error);
      resolve(null);
    }
  });
};

// RunPod API Base URL
const RUNPOD_API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000');

// Helper to detect if error is from cold start
const isColdStartError = (error: any, responseText: string = ''): boolean => {
  const errorMsg = error?.message?.toLowerCase() || '';
  const respText = responseText.toLowerCase();

  return (
    respText.includes('no workers available') ||
    respText.includes('worker') ||
    errorMsg.includes('503') ||
    errorMsg.includes('timeout') ||
    errorMsg.includes('timed out')
  );
};

// Helper for retry with exponential backoff
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  onRetry?: (attempt: number, maxRetries: number) => void
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if this is a cold start error
      const responseText = error?.response || error?.message || '';
      const isColdStart = isColdStartError(error, responseText);

      // Only retry on cold start errors, and if we haven't exceeded max retries
      if (isColdStart && attempt < maxRetries) {
        const backoffMs = Math.min(3000 * Math.pow(2, attempt), 48000);
        console.log(`[API Retry] Cold start detected, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);

        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(attempt + 1, maxRetries);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      // If not a cold start error, or max retries exceeded, throw immediately
      throw lastError;
    }
  }

  throw lastError;
};

// Robust JSON fetch helper with automatic RunPod URL resolution, Supabase JWT, and cold start retry
export const fetchJSON = async (url: string, options?: RequestInit, enableRetry: boolean = true) => {
  // If URL is relative, prepend RUNPOD_API_BASE (which is /api in dev, full URL in prod)
  const fullUrl = url.startsWith('http') ? url : `${RUNPOD_API_BASE}${url.startsWith('/') ? url : '/' + url}`;

  const fetchFn = async () => {
    // Build headers via Headers to avoid type issues
    const headers = new Headers(options?.headers as any);

    if (import.meta.env.VITE_RUNPOD_API_KEY) {
      headers.set('Authorization', `Bearer ${import.meta.env.VITE_RUNPOD_API_KEY}`);
    }

    // Attach Supabase user JWT if present (client-side auth)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = (session as any)?.access_token as string | undefined;
      if (userToken) {
        headers.set('Authorization', `Bearer ${userToken}`);
      }
    } catch (e) {
      // Ignore if session fetch fails; request may still succeed for public endpoints
    }

    const res = await fetch(fullUrl, { ...options, headers });
    const text = await res.text();

    // Log raw response for debugging when there's an error
    if (!res.ok) {
      console.error(`HTTP ${res.status} Error for ${fullUrl}:`);
      console.error('Response headers:', Object.fromEntries(res.headers.entries()));
      console.error('Raw response text:', text);
    }

      try {
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        // Create error with response text for cold start detection
        const error: any = new Error(`${res.status} ${data.detail || data.error || res.statusText}`);
        error.response = text;
        error.status = res.status;
          // On unauthorized, redirect to auth page
          if (res.status === 401) {
            try {
              await supabase.auth.signOut();
            } catch {}
            if (typeof window !== 'undefined') {
              window.location.href = '/auth';
            }
          }
        throw error;
      }
      return data;
    } catch (parseError: any) {
      if (!res.ok) {
        const error: any = new Error(`${res.status} ${res.statusText}`);
        error.response = text;
        error.status = res.status;
          if (res.status === 401 && typeof window !== 'undefined') {
            try { await supabase.auth.signOut(); } catch {}
            window.location.href = '/auth';
          }
        throw error;
      }
      throw parseError;
    }
  };

  // Use retry logic only if enabled (default true)
  if (enableRetry) {
    return retryWithBackoff(fetchFn);
  }

  return fetchFn();
};

// Check if response is ok first
const fetchJSONAlternative = async (url: string, options?: RequestInit) => {
  const fullUrl = url.startsWith('http') ? url : `${RUNPOD_API_BASE}${url.startsWith('/') ? url : '/' + url}`;

  // Build headers via Headers
  const headers = new Headers(options?.headers as any);

  if (import.meta.env.VITE_RUNPOD_API_KEY) {
    headers.set('Authorization', `Bearer ${import.meta.env.VITE_RUNPOD_API_KEY}`);
  }

  // Attach Supabase user JWT if present
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userToken = (session as any)?.access_token as string | undefined;
    if (userToken) {
      headers.set('Authorization', `Bearer ${userToken}`);
    }
  } catch {}

  const res = await fetch(fullUrl, { ...options, headers });
  
  if (!res.ok) {
    let errorMessage = res.statusText || 'Request failed';
    
    try {
      // Try to get error details from response body
      const text = await res.text();
      if (text) {
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.detail || errorData.error || errorMessage;
        } catch {
          // If not JSON, use the raw text (but truncate if it's HTML)
          errorMessage = text.startsWith('<!DOCTYPE') ? 'Server returned HTML error page' : text;
        }
      }
    } catch {
      // If we can't read the response body, use the status text
    }
    
    if (res.status === 401 && typeof window !== 'undefined') {
      try { await supabase.auth.signOut(); } catch {}
      window.location.href = '/auth';
    }
    throw new Error(`${res.status} ${errorMessage}`);
  }
  
  // Only parse JSON for successful responses
  const text = await res.text();
  return text ? JSON.parse(text) : {};
};

export const fetchTrackingResults = async () => {
  return getAllTrackingResults();
};

export const fetchVideos = async () => {
  return getAllVideos();
};

export const fetchVehicleCounts = async () => {
  return getAllVehicleCounts();
};

export const createVideo = async (videoData: {
  video_name: string;
  original_filename: string;
  original_url?: string;
  file_size?: number;
  duration_seconds?: number;
}): Promise<Video> => {
  return insertVideo(videoData);
};

export const updateVideoStatus = async (
  videoId: number, 
  status: Video['status'], 
  additionalData?: Partial<Video>
): Promise<Video> => {
  return updateVideo(videoId, { status, ...additionalData });
};

export const saveTrackingResults = async (
  videoId: number, 
  results: Omit<TrackingResultInsert, 'video_id'>[]
): Promise<void> => {
  const trackingResults = results.map(result => ({
    ...result,
    video_id: videoId
  }));
  
  await insertTrackingResults(trackingResults);
};

export const saveVehicleCounts = async (
  videoId: number, 
  counts: Omit<VehicleCountInsert, 'video_id'>[]
): Promise<void> => {
  const vehicleCounts = counts.map(count => ({
    ...count,
    video_id: videoId
  }));
  
  await insertVehicleCounts(vehicleCounts);
};

// RunPod Job Management Functions
export const startRunPodProcessing = async (video: Video): Promise<{ job_id: string; queue_position: number }> => {
  try {
    const formData = new FormData();
    
    // NOTE: This function path is deprecated in favor of startRunPodProcessingDirect.
    // Keeping signature for compatibility; backend expects a file Blob.
    // @ts-expect-error legacy path: `video` here is not a Blob. Use startRunPodProcessingDirect instead.
    formData.append('file', video);
    formData.append('video_id', video.id.toString());
    formData.append('video_name', video.video_name);
    
    const data = await fetchJSON(`${RUNPOD_API_BASE}/video/upload`, {
      method: 'POST',
      body: formData,
    });
    
    return data;
  } catch (error) {
    console.error('Error starting RunPod processing:', error);
    throw error;
  }
};

export const startRunPodProcessingDirect = async (
  videoFile: File,
  videoName: string,
  onProgress?: (progress: number) => void
): Promise<{ job_id: string; video_id: number | null; queue_position: number; original_url: string }> => {
  try {
    const formData = new FormData();

    formData.append('file', videoFile);
    formData.append('video_name', videoName);

    const fullUrl = `${RUNPOD_API_BASE}/video/upload`;

    const uploadData = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('Failed to parse server response'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      xhr.open('POST', fullUrl);

      if (import.meta.env.VITE_RUNPOD_API_KEY) {
        xhr.setRequestHeader('Authorization', `Bearer ${import.meta.env.VITE_RUNPOD_API_KEY}`);
      }

      xhr.send(formData);
    });

    if (onProgress) {
      onProgress(100);
    }

    const processData = await fetchJSON(`/video/process/${uploadData.job_id}`, {
      method: 'POST'
    });

    return {
      job_id: uploadData.job_id,
      video_id: uploadData.video_id,
      queue_position: processData.queue_position ?? uploadData.queue_position ?? 0,
      original_url: uploadData.original_url || uploadData.video_url || ''
    };
  } catch (error) {
    console.error('Error starting RunPod processing:', error);
    throw error;
  }
};

export const createVideoMetadataRecord = async (
  file: File,
  videoName: string,
  originalUrl?: string
): Promise<Video> => {
  try {
    const videoData = {
      video_name: videoName,
      original_filename: file.name,
      original_url: originalUrl,
      file_size: file.size,
      status: 'uploaded' as const
    };

    return await insertVideo(videoData);
  } catch (error) {
    console.error('Error creating video metadata record:', error);
    throw error;
  }
};

export const clearCompletedRunPodJobs = async (): Promise<void> => {
  try {
    await fetch(`${RUNPOD_API_BASE}/jobs/clear-completed`, { method: 'POST' });
  } catch (error) {
    console.error('Error clearing completed jobs:', error);
    throw error;
  }
};

export const shutdownAllRunPodJobs = async (): Promise<void> => {
  try {
    await fetch(`${RUNPOD_API_BASE}/jobs/shutdown`, { method: 'POST' });
  } catch (error) {
    console.error('Error shutting down all jobs:', error);
    throw error;
  }
};

export const shutdownSpecificRunPodJob = async (jobId: string): Promise<void> => {
  try {
    await fetch(`${RUNPOD_API_BASE}/jobs/shutdown/${jobId}`, { method: 'POST' });
  } catch (error) {
    console.error('Error shutting down job:', error);
    throw error;
  }
};

export const deleteVideo = async (fileName: string, uploadId: string): Promise<void> => {
  try {
    // Video deletion functionality is disabled
    throw new Error('Video deletion is currently disabled');
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
};


export const uploadCSV = async (file: File, fileName: string, videoId: string): Promise<string> => {
  try {
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('analytics')
      .upload(`csv/${fileName}`, file, {
        upsert: true
      });

    if (error) throw error;

    // Parse CSV data
    const text = await file.text();
    const results = Papa.parse(text, { 
      header: true,
      dynamicTyping: true, // Automatically convert numbers
      skipEmptyLines: true
    });
    
    const videoIdNum = parseInt(videoId);
    
    if (fileName.includes('count')) {
      // Process vehicle count data
      const countData = results.data as Array<{
        vehicle_type: string;
        count: number;
        date: string;
      }>;

      // Calculate total count per vehicle type
      const vehicleCounts = countData.reduce((acc: { [key: string]: number }, row) => {
        acc[row.vehicle_type] = (acc[row.vehicle_type] || 0) + (row.count || 0);
        return acc;
      }, {});

      const totalCount = Object.values(vehicleCounts).reduce((sum, count) => sum + count, 0);

      // Save to database if videoId is provided
      if (!isNaN(videoIdNum)) {
        const vehicleCountInserts = Object.entries(vehicleCounts).map(([vehicleType, count]) => ({
          vehicle_type: vehicleType,
          count: count,
          date: new Date().toISOString().split('T')[0] // Today's date
        }));
        
        await saveVehicleCounts(videoIdNum, vehicleCountInserts);
        console.log('Saved vehicle count data to database');
      } else {
        console.log('Processed vehicle count data:', { totalCount, vehicleCounts });
      }
    } else if (fileName.includes('tracking')) {
      // Process tracking data
      const trackingData = results.data as any[];
      const validReactionTimes = trackingData.filter(d => d.compliance === '1' && d.reaction_time);
      const avgReactionTime = validReactionTimes.length > 0
        ? validReactionTimes.reduce((sum, d) => sum + parseFloat(d.reaction_time), 0) / validReactionTimes.length
        : 0;

      // Save to database if videoId is provided
      if (!isNaN(videoIdNum)) {
        const trackingInserts = trackingData.map(row => ({
          vehicle_type: row.vehicle_type || 'unknown',
          status: (row.status === 'moving' || row.status === 'stationary') ? row.status : 'moving',
          compliance: parseInt(row.compliance) === 1 ? 1 : 0,
          reaction_time: row.reaction_time ? parseFloat(row.reaction_time) : undefined,
          weather_condition: row.weather_condition,
          temperature: row.temperature ? parseFloat(row.temperature) : undefined,
          humidity: row.humidity ? parseInt(row.humidity) : undefined,
          visibility: row.visibility ? parseFloat(row.visibility) : undefined,
          precipitation_type: row.precipitation_type,
          wind_speed: row.wind_speed ? parseFloat(row.wind_speed) : undefined,
          date: row.date || new Date().toISOString()
        })) as Omit<TrackingResultInsert, 'video_id'>[];
        
        await saveTrackingResults(videoIdNum, trackingInserts);
        console.log('Saved tracking data to database');
      } else {
        console.log('Processed tracking data:', { avgReactionTime, validReactionTimes: validReactionTimes.length });
      }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('analytics')
      .getPublicUrl(`csv/${fileName}`);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading CSV:', error);
    throw error;
  }
};

export const generatePDFReport = async (trackingData: any[], metrics: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const title = 'Traffic Analysis Report';
  const date = new Date().toLocaleDateString();

  // Title Page
  doc.setFontSize(24);
  doc.setTextColor(6, 182, 212); // Primary color
  doc.text(title, pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${date}`, pageWidth / 2, 55, { align: 'center' });

  // Add Project 49 branding
  doc.setFontSize(12);
  doc.setTextColor(6, 182, 212);
  doc.text('Project 49 - Road Safety Analysis Platform', pageWidth / 2, 70, { align: 'center' });

  // Enhanced Executive Summary
  doc.addPage();
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text('Executive Summary', 20, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  
  // Calculate additional insights for executive summary
  const complianceRateValue = Number(metrics.complianceRate) || 0;
  const avgReactionTimeValue = Number(metrics.avgReactionTime) || 0;
  const totalVehiclesValue = Number(metrics.totalVehicles) || 0;
  const violationsValue = Number(metrics.violations) || 0;
  
  // Determine compliance status
  const complianceStatus = complianceRateValue >= 85 ? 'Excellent' : 
                          complianceRateValue >= 70 ? 'Good' : 
                          complianceRateValue >= 50 ? 'Fair' : 'Poor';
  
  // Determine reaction time status
  const reactionTimeStatus = avgReactionTimeValue <= 2.0 ? 'Excellent' : 
                            avgReactionTimeValue <= 3.0 ? 'Good' : 
                            avgReactionTimeValue <= 4.0 ? 'Fair' : 'Needs Improvement';
  
  const enhancedSummary = [
    `Analysis Overview:`,
    `This comprehensive traffic analysis report examines ${totalVehiclesValue} vehicles across multiple`,
    `monitoring sessions, providing insights into road user behavior and compliance patterns.`,
    ``,
    `Key Findings:`,
    `• Overall Compliance Rate: ${complianceRateValue.toFixed(1)}% (${complianceStatus})`,
    `• Average Reaction Time: ${avgReactionTimeValue.toFixed(2)}s (${reactionTimeStatus})`,
    `• Total Violations Detected: ${violationsValue}`,
    `• Peak Violation Period: ${metrics.peakViolationHour || 'Not determined'}`,
    `• Analysis Period: ${metrics.analysisStartDate || 'N/A'} to ${metrics.analysisEndDate || 'N/A'}`,
    ``,
    `Performance Assessment:`,
    complianceRateValue >= 85 ? 
      `The compliance rate of ${complianceRateValue.toFixed(1)}% indicates excellent road safety performance,` :
    complianceRateValue >= 70 ?
      `The compliance rate of ${complianceRateValue.toFixed(1)}% shows good safety performance with room for improvement.` :
      `The compliance rate of ${complianceRateValue.toFixed(1)}% indicates significant safety concerns requiring immediate attention.`,
    ``,
    avgReactionTimeValue <= 3.0 ?
      `Average reaction times are within acceptable safety parameters.` :
      `Reaction times exceed recommended thresholds, suggesting potential safety risks.`
  ];
  
  let yPos = 40;
  enhancedSummary.forEach(line => {
    if (line.startsWith('•')) {
      doc.setFontSize(11);
      doc.text(line, 25, yPos);
    } else if (line.includes(':') && !line.includes('•')) {
      doc.setFontSize(12);
      doc.setTextColor(6, 182, 212);
      doc.text(line, 20, yPos);
      doc.setTextColor(60, 60, 60);
    } else {
      doc.setFontSize(11);
      doc.text(line, 20, yPos);
    }
    yPos += line === '' ? 5 : 7;
  });

  // Traffic Flow Patterns
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Traffic Flow Patterns', 20, 20);

  // Calculate daily traffic patterns
  const dailyData = trackingData.reduce((acc: any, curr: any) => {
    if (!curr.date) return acc;
    const dayOfWeek = format(parseISO(curr.date), 'EEEE');
    if (!acc[dayOfWeek]) {
      acc[dayOfWeek] = { total: 0, violations: 0 };
    }
    acc[dayOfWeek].total++;
    if (curr.compliance === 0) acc[dayOfWeek].violations++;
    return acc;
  }, {});

  if (Object.keys(dailyData).length > 0) {
    const dailyImageData = await getChartImage('bar', {
      labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      datasets: [{
        label: 'Total Traffic Volume',
        data: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
          .map(day => dailyData[day]?.total || 0),
        backgroundColor: '#06B6D4',
        borderColor: '#0891B2',
        borderWidth: 1
      }, {
        label: 'Violations',
        data: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
          .map(day => dailyData[day]?.violations || 0),
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        borderWidth: 1
      }]
    }, {
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: 'Weekly Traffic Flow and Violations'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Vehicles'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Day of Week'
          }
        }
      }
    }, 700, 400);
    
    if (dailyImageData) {
      doc.addImage(dailyImageData, 'PNG', 10, 40, 190, 110);
    }
  }

  // Add traffic flow analysis text
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  let flowYPos = 160;
  
  const peakDay = Object.keys(dailyData).reduce((a, b) => 
    (dailyData[a]?.total || 0) > (dailyData[b]?.total || 0) ? a : b, 'Monday');
  const lowDay = Object.keys(dailyData).reduce((a, b) => 
    (dailyData[a]?.total || 0) < (dailyData[b]?.total || 0) ? a : b, 'Monday');
  
  const flowAnalysis = [
    `Traffic Flow Analysis:`,
    `• Peak Traffic Day: ${peakDay} (${dailyData[peakDay]?.total || 0} vehicles)`,
    `• Lowest Traffic Day: ${lowDay} (${dailyData[lowDay]?.total || 0} vehicles)`,
    `• Weekend vs Weekday Pattern: ${
      ((dailyData['Saturday']?.total || 0) + (dailyData['Sunday']?.total || 0)) > 
      ((dailyData['Monday']?.total || 0) + (dailyData['Tuesday']?.total || 0)) ? 
      'Higher weekend traffic observed' : 'Higher weekday traffic observed'
    }`
  ];
  
  flowAnalysis.forEach(line => {
    if (line.includes(':') && !line.includes('•')) {
      doc.setFontSize(12);
      doc.setTextColor(6, 182, 212);
      doc.text(line, 20, flowYPos);
      doc.setTextColor(60, 60, 60);
    } else {
      doc.setFontSize(11);
      doc.text(line, 20, flowYPos);
    }
    flowYPos += 8;
  });

  // Compliance Overview Chart
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Compliance Overview', 20, 20);

  // Create compliance pie chart
  const complianceImageData = await getChartImage('pie', {
    labels: ['Compliant', 'Violations'],
    datasets: [{
      data: [metrics.totalVehicles - metrics.violations, metrics.violations],
      backgroundColor: ['#10B981', '#EF4444'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  }, {
    plugins: {
      legend: {
        display: true,
        position: 'bottom'
      },
      title: {
        display: true,
        text: 'Overall Compliance Rate'
      }
    }
  });
  
  if (complianceImageData) {
    doc.addImage(complianceImageData, 'PNG', 20, 40, 100, 100);
  }

  // Add compliance statistics text
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  const complianceRate = totalVehiclesValue > 0 ? 
    (((totalVehiclesValue - violationsValue) / totalVehiclesValue) * 100).toFixed(1) : '0.0';
  doc.text(`Compliance Rate: ${complianceRate}%`, 130, 60);
  doc.text(`Total Compliant: ${totalVehiclesValue - violationsValue}`, 130, 75);
  doc.text(`Total Violations: ${violationsValue}`, 130, 90);
  doc.text(`Sample Size: ${totalVehiclesValue} vehicles`, 130, 105);

  // Vehicle Type Analysis
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Vehicle Type Analysis', 20, 20);

  // Create vehicle type bar chart
  if (metrics.vehicleTypeStats && metrics.vehicleTypeStats.length > 0) {
    const vehicleTypeImageData = await getChartImage('bar', {
      labels: metrics.vehicleTypeStats.map((stat: any) => stat.type),
      datasets: [{
        label: 'Total Vehicles',
        data: metrics.vehicleTypeStats.map((stat: any) => stat.total),
        backgroundColor: '#06B6D4',
        borderColor: '#0891B2',
        borderWidth: 1
      }, {
        label: 'Violations',
        data: metrics.vehicleTypeStats.map((stat: any) => stat.violations),
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        borderWidth: 1
      }]
    }, {
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: 'Vehicle Types: Total vs Violations'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Vehicles'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Vehicle Type'
          }
        }
      }
    }, 700, 400);
    
    if (vehicleTypeImageData) {
      doc.addImage(vehicleTypeImageData, 'PNG', 10, 40, 190, 110);
    }
  }

  // Vehicle Type Compliance Rate Chart

  // Reaction Time Analysis
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Reaction Time Analysis', 20, 20);

  if (metrics.vehicleTypeStats && metrics.vehicleTypeStats.length > 0) {
    const reactionTimeImageData = await getChartImage('bar', {
      labels: metrics.vehicleTypeStats.map((stat: any) => stat.type),
      datasets: [{
        label: 'Average Reaction Time (seconds)',
        data: metrics.vehicleTypeStats.map((stat: any) => stat.avgReactionTime),
        backgroundColor: '#8B5CF6',
        borderColor: '#7C3AED',
        borderWidth: 1
      }]
    }, {
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: 'Average Reaction Time by Vehicle Type'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Reaction Time (seconds)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Vehicle Type'
          }
        }
      }
    }, 700, 400);
    
    if (reactionTimeImageData) {
      doc.addImage(reactionTimeImageData, 'PNG', 10, 40, 190, 110);
    }
  }

  // Hourly Analysis
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Hourly Analysis', 20, 20);

  const hourlyData = trackingData.reduce((acc: any, curr: any) => {
    if (!curr.date) return acc;
    const hour = format(parseISO(curr.date), 'HH:00');
    if (!acc[hour]) {
      acc[hour] = { total: 0, violations: 0 };
    }
    acc[hour].total++;
    if (curr.compliance === 0) acc[hour].violations++;
    return acc;
  }, {});

  if (Object.keys(hourlyData).length > 0) {
    const hourlyImageData = await getChartImage('line', {
      labels: Object.keys(hourlyData),
      datasets: [{
        label: 'Total Vehicles',
        data: Object.values(hourlyData).map((d: any) => d.total),
        borderColor: '#06B6D4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        fill: false,
        tension: 0.4
      }, {
        label: 'Violations',
        data: Object.values(hourlyData).map((d: any) => d.violations),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        tension: 0.4
      }]
    }, {
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: 'Traffic Volume and Violations by Hour'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Vehicles'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Hour of Day'
          }
        }
      }
    }, 700, 400);
    
    if (hourlyImageData) {
      doc.addImage(hourlyImageData, 'PNG', 10, 40, 190, 110);
    }
  }

  // Weather Impact Analysis (if weather data exists)
  const weatherData = trackingData.filter(d => d.weather_condition);
  if (weatherData.length > 0) {
    doc.addPage();
    doc.setFontSize(20);
    doc.text('Weather Impact Analysis', 20, 20);

    const weatherStats = weatherData.reduce((acc: any, curr: any) => {
      const weather = curr.weather_condition;
      if (!acc[weather]) {
        acc[weather] = { total: 0, violations: 0 };
      }
      acc[weather].total++;
      if (curr.compliance === 0) acc[weather].violations++;
      return acc;
    }, {});

    const weatherImageData = await getChartImage('bar', {
      labels: Object.keys(weatherStats),
      datasets: [{
        label: 'Total Vehicles',
        data: Object.values(weatherStats).map((d: any) => d.total),
        backgroundColor: '#06B6D4',
        borderWidth: 1
      }, {
        label: 'Violations',
        data: Object.values(weatherStats).map((d: any) => d.violations),
        backgroundColor: '#EF4444',
        borderWidth: 1
      }]
    }, {
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: 'Traffic Behavior by Weather Condition'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Vehicles'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Weather Condition'
          }
        }
      }
    }, 700, 400);
    
    if (weatherImageData) {
      doc.addImage(weatherImageData, 'PNG', 10, 40, 190, 110);
    }
  }

  // Monthly Trend Analysis
  const monthlyData = trackingData.reduce((acc: any, curr: any) => {
    if (!curr.date) return acc;
    const month = format(parseISO(curr.date), 'MMM yyyy');
    if (!acc[month]) {
      acc[month] = { total: 0, violations: 0 };
    }
    acc[month].total++;
    if (curr.compliance === 0) acc[month].violations++;
    return acc;
  }, {});

  if (Object.keys(monthlyData).length > 1) {
    doc.addPage();
    doc.setFontSize(20);
    doc.text('Monthly Trend Analysis', 20, 20);

    const monthlyImageData = await getChartImage('line', {
      labels: Object.keys(monthlyData),
      datasets: [{
        label: 'Compliance Rate (%)',
        data: Object.values(monthlyData).map((d: any) => 
          ((d.total - d.violations) / d.total * 100).toFixed(1)
        ),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      }]
    }, {
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: 'Compliance Rate Trend Over Time'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Compliance Rate (%)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Month'
          }
        }
      }
    }, 700, 400);
    
    if (monthlyImageData) {
      doc.addImage(monthlyImageData, 'PNG', 10, 40, 190, 110);
    }
  }

  // Methodology and Data Sources
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Methodology and Data Sources', 20, 20);

  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  
  const methodologyContent = [
    'Data Collection Methodology:',
    '',
    'This analysis is based on advanced computer vision technology and artificial intelligence',
    'algorithms designed to monitor and analyze road user behavior at level crossings.',
    '',
    'Key Technologies:',
    '• YOLOv8 (You Only Look Once) - State-of-the-art object detection algorithm',
    '• Computer Vision Processing - Real-time video analysis and tracking',
    '• Machine Learning Classification - Automated behavior pattern recognition',
    '• Statistical Analysis - Comprehensive data processing and trend identification',
    '',
    'Data Sources:',
    '• High-definition traffic monitoring cameras',
    '• Continuous 24/7 video surveillance systems',
    '• Weather monitoring stations (when available)',
    '• Automated vehicle detection and classification systems',
    '',
    'Analysis Parameters:',
    '• Vehicle Detection: Automated identification of cars, trucks, motorcycles, and other vehicles',
    '• Compliance Monitoring: Real-time assessment of traffic rule adherence',
    '• Reaction Time Measurement: Precise calculation of driver response times',
    '• Behavioral Classification: Categorization of compliant vs. non-compliant behavior',
    '',
    'Quality Assurance:',
    '• Multi-stage validation of detection accuracy',
    '• Statistical significance testing for all reported metrics',
    '• Continuous calibration of detection algorithms',
    '• Regular validation against manual observation samples'
  ];
  
  let methodYPos = 40;
  methodologyContent.forEach(line => {
    if (line.includes(':') && !line.includes('•')) {
      doc.setFontSize(12);
      doc.setTextColor(6, 182, 212);
      doc.text(line, 20, methodYPos);
      doc.setTextColor(60, 60, 60);
    } else if (line.startsWith('•')) {
      doc.setFontSize(11);
      doc.text(line, 25, methodYPos);
    } else {
      doc.setFontSize(11);
      doc.text(line, 20, methodYPos);
    }
    methodYPos += line === '' ? 5 : 7;
  });
  // Detailed Statistics
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Detailed Statistics', 20, 20);

  const detailedStats = metrics.vehicleTypeStats && metrics.vehicleTypeStats.length > 0 
    ? metrics.vehicleTypeStats.map((stat: any) => [
        stat.type,
        stat.total,
        stat.compliant,
        stat.violations,
        `${stat.avgReactionTime.toFixed(2)}s`,
        `${((stat.compliant / stat.total) * 100).toFixed(1)}%`
      ])
    : [['No data', '0', '0', '0', '0s', '0%']];

  (doc as any).autoTable({
    startY: 30,
    head: [['Vehicle Type', 'Total', 'Compliant', 'Violations', 'Avg RT', 'Compliance']],
    body: detailedStats,
    theme: 'grid',
    headStyles: { fillColor: [6, 182, 212] },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 20 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 }
    }
  });

  // Key Performance Indicators
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Key Performance Indicators', 20, 20);

  const kpis = [
    { metric: 'Overall Compliance Rate', value: `${complianceRateValue.toFixed(1)}%`, target: '≥85%', status: complianceRateValue >= 85 ? 'Good' : 'Needs Improvement' },
    { metric: 'Average Reaction Time', value: `${avgReactionTimeValue.toFixed(2)}s`, target: '≤3.0s', status: avgReactionTimeValue <= 3.0 ? 'Good' : 'Needs Improvement' },
    { metric: 'Total Violations', value: violationsValue.toString(), target: 'Minimize', status: 'Monitor' },
    { metric: 'Sample Size', value: totalVehiclesValue.toString(), target: '≥1000', status: totalVehiclesValue >= 1000 ? 'Adequate' : 'Limited' }
  ];

  (doc as any).autoTable({
    startY: 40,
    head: [['KPI', 'Current Value', 'Target', 'Status']],
    body: kpis.map(kpi => [kpi.metric, kpi.value, kpi.target, kpi.status]),
    theme: 'grid',
    headStyles: { fillColor: [6, 182, 212] },
    styles: { fontSize: 11 },
    columnStyles: {
      3: { 
        cellWidth: 30,
        fontStyle: 'bold'
      }
    }
  });

  // Enhanced Analysis & Recommendations
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Analysis & Recommendations', 20, 20);

  // Calculate dynamic insights for recommendations
  const worstPerformingVehicle = metrics.vehicleTypeStats && metrics.vehicleTypeStats.length > 0 
    ? metrics.vehicleTypeStats.reduce((worst: any, current: any) => 
        current.complianceRate < worst.complianceRate ? current : worst
      )
    : null;
  
  const bestPerformingVehicle = metrics.vehicleTypeStats && metrics.vehicleTypeStats.length > 0 
    ? metrics.vehicleTypeStats.reduce((best: any, current: any) => 
        current.complianceRate > best.complianceRate ? current : best
      )
    : null;

  const recommendations = [
    {
      finding: 'Overall Safety Performance Assessment',
      description: `Current compliance rate of ${complianceRateValue.toFixed(1)}% ${
        complianceRateValue >= 85 ? 'exceeds industry safety standards' :
        complianceRateValue >= 70 ? 'meets basic safety requirements but has room for improvement' :
        'falls below recommended safety thresholds and requires immediate attention'
      }. Average reaction time of ${avgReactionTimeValue.toFixed(2)}s ${
        avgReactionTimeValue <= 3.0 ? 'is within acceptable parameters' : 'exceeds recommended response times'
      }.`,
      recommendation: complianceRateValue >= 85 ? 
        'Maintain current safety protocols and continue regular monitoring to sustain high performance levels.' :
        complianceRateValue >= 70 ?
        'Implement targeted safety improvements focusing on the identified risk areas. Consider enhanced signage and driver education programs.' :
        'Urgent intervention required. Implement comprehensive safety measures including enhanced enforcement, improved signage, and immediate driver awareness campaigns.'
    },
    {
      finding: 'Vehicle Type Performance Analysis',
      description: worstPerformingVehicle && bestPerformingVehicle
        ? `${worstPerformingVehicle.type} vehicles show the lowest compliance rate at ${(worstPerformingVehicle.complianceRate || 0).toFixed(1)}%, while ${bestPerformingVehicle.type} vehicles demonstrate the highest compliance at ${(bestPerformingVehicle.complianceRate || 0).toFixed(1)}%. This ${((bestPerformingVehicle.complianceRate || 0) - (worstPerformingVehicle.complianceRate || 0)).toFixed(1)}% difference indicates significant behavioral variations between vehicle types.`
        : 'Vehicle type analysis requires additional data for comprehensive assessment.',
      recommendation: worstPerformingVehicle
        ? `Develop targeted safety interventions specifically for ${worstPerformingVehicle.type} operators. Consider vehicle-specific signage, enhanced training programs, and focused enforcement during peak ${worstPerformingVehicle.type} traffic periods. Study successful compliance strategies used for ${bestPerformingVehicle?.type || 'high-performing'} vehicles and adapt them for ${worstPerformingVehicle.type} operators.`
        : 'Collect additional vehicle type data to enable targeted safety interventions.'
    },
    {
      finding: 'Peak Risk Period Identification',
      description: `Analysis reveals ${metrics.peakViolationHour ? `peak violation activity at ${metrics.peakViolationHour}` : 'distributed violation patterns throughout monitoring periods'}. ${
        Object.keys(dailyData).length > 0 ? 
        `Weekly patterns show ${peakDay} as the highest risk day with ${dailyData[peakDay]?.violations || 0} violations out of ${dailyData[peakDay]?.total || 0} total vehicles.` :
        'Additional temporal data needed for comprehensive risk period analysis.'
      }`,
      recommendation: metrics.peakViolationHour ?
        `Implement enhanced monitoring and enforcement protocols during ${metrics.peakViolationHour} and surrounding peak periods. Deploy additional safety personnel and consider dynamic warning systems that activate during high-risk timeframes. Analyze traffic flow patterns to understand underlying causes of increased violations during these periods.` :
        'Establish continuous monitoring to identify peak risk periods and develop time-specific safety interventions.'
    },
    {
      finding: 'Reaction Time and Warning System Effectiveness',
      description: `Current average reaction time of ${avgReactionTimeValue.toFixed(2)}s ${
        avgReactionTimeValue <= 2.0 ? 'demonstrates excellent driver responsiveness to warning systems' :
        avgReactionTimeValue <= 3.0 ? 'indicates adequate but improvable driver response times' :
        'suggests potential issues with warning system visibility, timing, or driver awareness'
      }. ${worstPerformingVehicle ? `${worstPerformingVehicle.type} vehicles show the slowest average reaction time of ${(worstPerformingVehicle.avgReactionTime || 0).toFixed(2)}s.` : ''}`,
      recommendation: avgReactionTimeValue <= 3.0 ?
        'Current warning systems are performing effectively. Continue regular maintenance and consider minor optimizations based on vehicle-specific response patterns.' :
        `Warning system requires immediate evaluation and enhancement. Consider: 1) Increasing warning signal visibility and audibility, 2) Implementing earlier warning activation, 3) Adding redundant warning methods, 4) Conducting driver education on proper response procedures. ${worstPerformingVehicle ? `Special attention needed for ${worstPerformingVehicle.type} vehicle operators.` : ''}`
    },
    {
      finding: 'Data Quality and Monitoring Coverage',
      description: `Analysis based on ${totalVehiclesValue} vehicle observations ${
        totalVehiclesValue >= 1000 ? 'provides statistically significant insights' :
        totalVehiclesValue >= 500 ? 'offers meaningful trends but would benefit from larger sample size' :
        'represents limited data that may not capture full behavioral patterns'
      }. ${weatherData.length > 0 ? 'Weather impact data available for enhanced analysis.' : 'Weather correlation data not available for this period.'}`,
      recommendation: totalVehiclesValue >= 1000 ?
        'Current monitoring coverage is adequate. Maintain consistent data collection protocols and consider expanding analysis to include seasonal variations and weather impact studies.' :
        'Expand monitoring duration and coverage to achieve statistically robust sample sizes (target: >1000 observations). Implement weather monitoring integration to understand environmental impact on driver behavior. Consider additional monitoring locations for comprehensive area coverage.'
    }
  ];

  let recYPos = 40;
  recommendations.forEach(rec => {
    doc.setFontSize(14);
    doc.setTextColor(6, 182, 212);
    doc.text(rec.finding, 20, recYPos);
    
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    const descLines = doc.splitTextToSize(rec.description, pageWidth - 40);
    doc.text(descLines, 20, recYPos + 7);
    
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('Recommended Actions:', 20, recYPos + 7 + (descLines.length * 5) + 5);
    
    const recLines = doc.splitTextToSize(rec.recommendation, pageWidth - 40);
    doc.text(recLines, 20, recYPos + 7 + (descLines.length * 5) + 12);
    
    recYPos += 40 + (descLines.length * 5) + (recLines.length * 5);
    
    // Add page break if needed
    if (recYPos > pageHeight - 40) {
      doc.addPage();
      recYPos = 20;
    }
  });

  // Footer on last page
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Generated by Project 49 - Road Safety Analysis Platform', pageWidth / 2, pageHeight - 10, { align: 'center' });
  doc.text(`Report generated on ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 5, { align: 'center' });

  return doc;
};

export const listCSVFiles = async () => {
  try {
    const { data, error } = await supabase.storage
      .from('analytics')
      .list('csv');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error listing CSV files:', error);
    throw error;
  }
};

export const getCSVUrl = async (fileName: string): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from('analytics')
      .createSignedUrl(`csv/${fileName}`, 3600);

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting CSV URL:', error);
    throw error;
  }
};

export const deleteCSV = async (fileName: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from('analytics')
      .remove([`csv/${fileName}`]);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting CSV:', error);
    throw error;
  }
};

export const generateDetailedReport = (trackingData: any[]): string => {
  const vehicleTypes = [...new Set(trackingData.map(d => d.vehicle_type))];
  
  const vehicleStats = vehicleTypes.map(type => {
    const vehicles = trackingData.filter(d => d.vehicle_type === type);
    const total = vehicles.length;
    const compliant = vehicles.filter(d => d.compliance === 1).length;
    const violations = total - compliant;
    const avgReactionTime = vehicles
      .filter(d => d.compliance === 1 && d.reaction_time)
      .reduce((sum, d) => sum + (d.reaction_time || 0), 0) / compliant || 0;
    
    return {
      type,
      total,
      compliant,
      violations,
      complianceRate: (compliant / total * 100).toFixed(2),
      avgReactionTime: avgReactionTime.toFixed(2)
    };
  });

  let csvContent = 'Vehicle Type,Total Vehicles,Compliant Vehicles,Violations,Compliance Rate (%),Average Reaction Time (s)\n';
  csvContent += vehicleStats
    .map(stat => 
      `${stat.type},${stat.total},${stat.compliant},${stat.violations},${stat.complianceRate},${stat.avgReactionTime}`
    )
    .join('\n');
  csvContent += '\n\nDetailed Records\n';
  csvContent += 'Tracker ID,Vehicle Type,Status,Compliance,Reaction Time,Date\n';
  csvContent += trackingData
    .map(d => 
      `${d.tracker_id},${d.vehicle_type},${d.status},${d.compliance},${d.reaction_time || ''},${d.date || ''}`
    )
    .join('\n');

  return csvContent;
};

// Enhanced job management functions that integrate with database
export const syncProcessingJobStatus = async (jobId: string, status: string, progress?: number, message?: string): Promise<void> => {
  try {
    // Processing job sync disabled - using RunPod backend only
    console.log(`Job ${jobId} status: ${status}, progress: ${progress}%, message: ${message}`);
  } catch (error) {
    console.error('Error syncing processing job status:', error);
    throw error;
  }
};

export const getJobsFromDatabase = async (): Promise<any[]> => {
  try {
    // Return empty array - jobs are managed by RunPod backend only
    return [];
  } catch (error) {
    console.error('Error getting jobs from database:', error);
    return [];
  }
};

export const downloadCSV = (content: string, fileName: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const getVideoUrl = async (fileName: string): Promise<string> => {
  try {
    // Videos are now served from backend /processed folder
    return `${RUNPOD_API_BASE}/processed/${fileName}`;
  } catch (error) {
    console.error('Error getting video URL:', error);
    throw error;
  }
};

export const processVideo = async (videoId: string, videoUrl: string): Promise<void> => {
  try {
    // Video processing functionality is disabled
    throw new Error('Video processing is currently disabled');
  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
};