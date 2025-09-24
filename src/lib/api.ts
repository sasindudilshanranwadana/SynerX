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

// RunPod API Base URL
const RUNPOD_API_BASE = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';

// Robust JSON fetch helper to avoid "Unexpected end of JSON input"
export const fetchJSON = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const msg = data.detail || data.error || res.statusText || 'Request failed';
      throw new Error(`${res.status} ${msg}`);
    }
    return data;
  } catch (err) {
    // If content-type isn't JSON or body empty, surface meaningful error
    if (!res.ok) throw new Error(`${res.status} ${text || res.statusText}`);
    throw err;
  }
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
  videoName: string
): Promise<{ job_id: string; queue_position: number; original_url: string }> => {
  try {
    const formData = new FormData();
    
    formData.append('file', videoFile);
    formData.append('video_name', videoName);
    
    const data = await fetchJSON(`${RUNPOD_API_BASE}/video/upload`, {
      method: 'POST',
      body: formData,
    });
    
    return {
      job_id: data.job_id,
      queue_position: data.queue_position,
      original_url: data.original_url || data.video_url || ''
    };
  } catch (error) {
    console.error('Error starting RunPod processing:', error);
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

export const createVideoMetadataRecord = async (
  videoFile: File,
  videoName: string,
  originalUrl: string
): Promise<Video> => {
  try {
    // Create video record in database
    const video = await createVideo({
      video_name: videoName,
      original_filename: videoFile.name,
      original_url: originalUrl,
      file_size: videoFile.size,
      status: 'processing',
      duration_seconds: 0 // Will be updated when processing completes
    });

    return video;
  } catch (error) {
    console.error('Error creating video metadata record:', error);
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

export const generatePDFReport = (trackingData: any[], metrics: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const title = 'Traffic Analysis Report';
  const date = new Date().toLocaleDateString();

  // Title Page
  doc.setFontSize(24);
  doc.setTextColor(6, 182, 212); // Primary color
  doc.text(title, pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${date}`, pageWidth / 2, 55, { align: 'center' });

  // Executive Summary
  doc.addPage();
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text('Executive Summary', 20, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  const summary = [
    `Total Vehicles Analyzed: ${metrics.totalVehicles}`,
    `Overall Compliance Rate: ${metrics.complianceRate}%`,
    `Average Reaction Time: ${metrics.avgReactionTime}s`,
    `Total Violations: ${metrics.violations}`,
    `Peak Violation Hour: ${metrics.peakViolationHour}`
  ];
  
  let yPos = 40;
  summary.forEach(line => {
    doc.text(line, 20, yPos);
    yPos += 10;
  });

  // Key Metrics Visualization
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Key Metrics Analysis', 20, 20);

  // Create compliance pie chart
  const complianceCanvas = document.createElement('canvas');
  complianceCanvas.width = 400;
  complianceCanvas.height = 400;
  const complianceCtx = complianceCanvas.getContext('2d');
  
  if (complianceCtx) {
    new Chart(complianceCtx, {
      type: 'pie',
      data: {
        labels: ['Compliant', 'Violations'],
        datasets: [{
          data: [metrics.totalVehicles - metrics.violations, metrics.violations],
          backgroundColor: ['#10B981', '#EF4444']
        }]
      }
    });
    
    doc.addImage(complianceCanvas.toDataURL(), 'PNG', 20, 40, 80, 80);
  }

  // Vehicle Type Analysis
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Vehicle Type Analysis', 20, 20);

  // Create vehicle type bar chart
  const vehicleTypeCanvas = document.createElement('canvas');
  vehicleTypeCanvas.width = 600;
  vehicleTypeCanvas.height = 400;
  const vehicleTypeCtx = vehicleTypeCanvas.getContext('2d');
  
  if (vehicleTypeCtx) {
    new Chart(vehicleTypeCtx, {
      type: 'bar',
      data: {
        labels: metrics.vehicleTypeStats.map((stat: any) => stat.type),
        datasets: [{
          label: 'Total Vehicles',
          data: metrics.vehicleTypeStats.map((stat: any) => stat.total),
          backgroundColor: '#06B6D4'
        }]
      }
    });
    
    doc.addImage(vehicleTypeCanvas.toDataURL(), 'PNG', 20, 40, 170, 100);
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

  const hourlyCanvas = document.createElement('canvas');
  hourlyCanvas.width = 600;
  hourlyCanvas.height = 400;
  const hourlyCtx = hourlyCanvas.getContext('2d');
  
  if (hourlyCtx) {
    new Chart(hourlyCtx, {
      type: 'line',
      data: {
        labels: Object.keys(hourlyData),
        datasets: [{
          label: 'Total Vehicles',
          data: Object.values(hourlyData).map((d: any) => d.total),
          borderColor: '#06B6D4'
        }, {
          label: 'Violations',
          data: Object.values(hourlyData).map((d: any) => d.violations),
          borderColor: '#EF4444'
        }]
      }
    });
    
    doc.addImage(hourlyCanvas.toDataURL(), 'PNG', 20, 40, 170, 100);
  }

  // Detailed Statistics
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Detailed Statistics', 20, 20);

  const detailedStats = metrics.vehicleTypeStats.map((stat: any) => [
    stat.type,
    stat.total,
    stat.compliant,
    stat.violations,
    `${stat.avgReactionTime.toFixed(2)}s`,
    `${((stat.compliant / stat.total) * 100).toFixed(1)}%`
  ]);

  (doc as any).autoTable({
    startY: 30,
    head: [['Vehicle Type', 'Total', 'Compliant', 'Violations', 'Avg RT', 'Compliance']],
    body: detailedStats,
    theme: 'grid',
    headStyles: { fillColor: [6, 182, 212] }
  });

  // Recommendations
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Analysis & Recommendations', 20, 20);

  const recommendations = [
    {
      finding: 'Peak Violation Periods',
      description: `The highest number of violations occurs at ${metrics.peakViolationHour}`,
      recommendation: 'Consider increased monitoring and enforcement during peak violation hours.'
    },
    {
      finding: 'Vehicle Type Compliance',
      description: `${metrics.vehicleTypeStats[0].type} vehicles show ${((metrics.vehicleTypeStats[0].compliant / metrics.vehicleTypeStats[0].total) * 100).toFixed(1)}% compliance rate`,
      recommendation: 'Target awareness campaigns for specific vehicle types with lower compliance rates.'
    },
    {
      finding: 'Reaction Time Analysis',
      description: `Average reaction time is ${metrics.avgReactionTime}s`,
      recommendation: 'Evaluate warning system effectiveness and consider improvements if reaction times are above threshold.'
    }
  ];

  let recYPos = 40;
  recommendations.forEach(rec => {
    doc.setFontSize(14);
    doc.setTextColor(6, 182, 212);
    doc.text(rec.finding, 20, recYPos);
    
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(rec.description, 20, recYPos + 7);
    doc.text(rec.recommendation, 20, recYPos + 14);
    
    recYPos += 30;
  });

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
    const runpodUrl = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';
    return `${runpodUrl}/processed/${fileName}`;
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