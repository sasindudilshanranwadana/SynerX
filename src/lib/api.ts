<<<<<<< Updated upstream
import { Task, TaskStats, TaskCounts, PriorityCounts } from './types';

const API_URL = import.meta.env.VITE_SUPABASE_URL;
const API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

export async function fetchJiraTasks(): Promise<Task[]> {
  try {
    const apiUrl = `${API_URL}/functions/v1/jira`;
    
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.issues || [];
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return []; // Return empty array instead of throwing
  }
}

export async function fetchTaskStats(days: number = 7): Promise<TaskStats> {
  try {
    const tasks = await fetchJiraTasks();
    const now = new Date();
    const pastDate = new Date(now.setDate(now.getDate() - days));

    const completed = tasks.filter(task => 
      task.status === 'done' && 
      new Date(task.updated_at) >= pastDate
    ).length;

    const updated = tasks.filter(task =>
      new Date(task.updated_at) >= pastDate
    ).length;

    const created = tasks.filter(task =>
      new Date(task.created_at) >= pastDate
    ).length;

    const dueSoon = tasks.filter(task =>
      task.status !== 'done' &&
      task.priority === 'high'
    ).length;

    return {
      completed,
      updated,
      created,
      dueSoon
    };
  } catch (error) {
    console.error('Error fetching task stats:', error);
    return {
      completed: 0,
      updated: 0,
      created: 0,
      dueSoon: 0
    };
  }
}

export async function fetchTaskCounts(): Promise<TaskCounts> {
  try {
    const tasks = await fetchJiraTasks();
    
    return {
      todo: tasks.filter(task => task.status === 'to_do').length,
      inProgress: tasks.filter(task => task.status === 'in_progress').length,
      done: tasks.filter(task => task.status === 'done').length
    };
  } catch (error) {
    console.error('Error fetching task counts:', error);
    return {
      todo: 0,
      inProgress: 0,
      done: 0
    };
  }
}

export async function fetchPriorityCounts(): Promise<PriorityCounts> {
  try {
    const tasks = await fetchJiraTasks();
    
    return {
      high: tasks.filter(task => task.priority === 'high').length,
      medium: tasks.filter(task => task.priority === 'medium').length,
      low: tasks.filter(task => task.priority === 'low').length
    };
  } catch (error) {
    console.error('Error fetching priority counts:', error);
    return {
      high: 0,
      medium: 0,
      low: 0
    };
  }
}

export async function fetchRecentTasks(limit: number = 5): Promise<Task[]> {
  try {
    const tasks = await fetchJiraTasks();
    return tasks
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching recent tasks:', error);
    return [];
  }
}

export function subscribeToTasks(callback: (tasks: Task[]) => void): () => void {
  // Initial load
  fetchJiraTasks()
    .then(callback)
    .catch(error => {
      console.error('Error in initial task load:', error);
      callback([]); // Call with empty array on error
    });

  // Poll for updates every 30 seconds
  const intervalId = setInterval(async () => {
    try {
      const tasks = await fetchJiraTasks();
      callback(tasks);
    } catch (error) {
      console.error('Error in subscription:', error);
      callback([]); // Call with empty array on error
    }
  }, 30000);

  // Return cleanup function
  return () => clearInterval(intervalId);
}
=======
import { supabase } from './supabase';
import { Task } from './types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { Chart, registerables } from 'chart.js';
import Papa from 'papaparse';
Chart.register(...registerables);

export const fetchJiraTasks = async (): Promise<Task[]> => {
  try {
    const tasks = [
      // In Progress Tasks
      {
        id: 'PROJECT49-46',
        project_id: 'PROJECT49',
        title: 'Correlations to API',
        description: null,
        status: 'in_progress',
        priority: 'high',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Franco Perez',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-42',
        project_id: 'PROJECT49',
        title: 'Improve "Classification Correction Line" feature',
        description: null,
        status: 'in_progress',
        priority: 'medium',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Quang Le',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-43',
        project_id: 'PROJECT49',
        title: 'Implement the correlation analysis between weather and driver behaviour',
        description: null,
        status: 'in_progress',
        priority: 'high',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Thiviru Thejan',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-45',
        project_id: 'PROJECT49',
        title: 'Improve the numberplate detection yolo model to detect pedestrian faces',
        description: null,
        status: 'in_progress',
        priority: 'medium',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Risinu Cooray',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      // Done Tasks
      {
        id: 'PROJECT49-36',
        project_id: 'PROJECT49',
        title: 'API uses Visualisations',
        description: null,
        status: 'done',
        priority: 'high',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Franco Perez',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-33',
        project_id: 'PROJECT49',
        title: 'Incorporate blurring changes to API',
        description: null,
        status: 'done',
        priority: 'medium',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Franco Perez',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-34',
        project_id: 'PROJECT49',
        title: 'Driver behaviour even when no stop',
        description: null,
        status: 'done',
        priority: 'high',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Quang Le',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-35',
        project_id: 'PROJECT49',
        title: 'Visualisation Improvements',
        description: null,
        status: 'done',
        priority: 'high',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Janith Athuluwage',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-37',
        project_id: 'PROJECT49',
        title: 'Fix CORS Configuration for Supabase ⇔ Render Communication',
        description: null,
        status: 'done',
        priority: 'high',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Sasindu Ranwadana',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-38',
        project_id: 'PROJECT49',
        title: 'Update Supabase Edge Function to Handle JSON Payload',
        description: null,
        status: 'done',
        priority: 'medium',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Sasindu Ranwadana',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-39',
        project_id: 'PROJECT49',
        title: 'Handle Render 500 Errors and Improve Logging',
        description: null,
        status: 'done',
        priority: 'high',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Sasindu Ranwadana',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-40',
        project_id: 'PROJECT49',
        title: 'Refactor main.py to Support Headless Processing',
        description: null,
        status: 'done',
        priority: 'high',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Sasindu Ranwadana',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'PROJECT49-41',
        project_id: 'PROJECT49',
        title: 'Prepare Backend for Sprint 3 Data Visualization',
        description: null,
        status: 'done',
        priority: 'high',
        type: 'task',
        labels: ['technical & development'],
        assignee: 'Sasindu Ranwadana',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    return tasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

export const subscribeToTasks = (callback: (tasks: Task[]) => void): (() => void) => {
  const subscription = supabase
    .channel('tasks_channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks'
      },
      async () => {
        // Fetch updated tasks when changes occur
        const tasks = await fetchJiraTasks();
        callback(tasks);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
};

export const deleteVideo = async (fileName: string, uploadId: string): Promise<void> => {
  try {
    // First, delete the video file from storage
    const { error: storageError } = await supabase.storage
      .from('videos')
      .remove([fileName]);

    if (storageError) throw storageError;

    // Then, delete the database record
    const { error: dbError } = await supabase
      .from('video_uploads')
      .delete()
      .eq('id', uploadId);

    if (dbError) throw dbError;
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

      // Store in database with video_id
      const { error: dbError } = await supabase
        .from('vehicle_tracking_results')
        .upsert({
          video_id: videoId,
          vehicle_count: totalCount,
          raw_count_csv: fileName
        });

      if (dbError) throw dbError;
    } else if (fileName.includes('tracking')) {
      // Process tracking data
      const trackingData = results.data as any[];
      const validReactionTimes = trackingData.filter(d => d.compliance === '1' && d.reaction_time);
      const avgReactionTime = validReactionTimes.length > 0
        ? validReactionTimes.reduce((sum, d) => sum + parseFloat(d.reaction_time), 0) / validReactionTimes.length
        : 0;

      // Store in database with video_id
      const { error: dbError } = await supabase
        .from('vehicle_tracking_results')
        .upsert({
          video_id: videoId,
          average_reaction_time: avgReactionTime,
          raw_tracking_csv: fileName
        });

      if (dbError) throw dbError;
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
    const { data } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.error('Error getting video URL:', error);
    throw error;
  }
};

export const processVideo = async (uploadId: string, videoUrl: string): Promise<void> => {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    if (!backendUrl) {
      throw new Error('Backend URL not configured');
    }

    const response = await fetch(`${backendUrl}/process-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        upload_id: uploadId,
        video_url: videoUrl 
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error processing video:', error);
    // Update video status to failed
    await supabase
      .from('video_uploads')
      .update({ 
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
      .eq('id', uploadId);
    throw error;
  }
};
>>>>>>> Stashed changes
