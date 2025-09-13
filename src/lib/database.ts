import { supabase } from './supabase';
import { Video, TrackingResult, VehicleCount, VideoUploadData, TrackingResultInsert, VehicleCountInsert } from './types';

// Video Operations
export const insertVideo = async (videoData: VideoUploadData): Promise<Video> => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .insert([videoData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error inserting video:', error);
    throw error;
  }
};

export const updateVideo = async (id: number, updates: Partial<Video>): Promise<Video> => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating video:', error);
    throw error;
  }
};

export const deleteVideo = async (id: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
};

export const getVideoById = async (id: number): Promise<Video | null> => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching video:', error);
    throw error;
  }
};

export const getAllVideos = async (): Promise<Video[]> => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
};

export const getVideosByStatus = async (status: Video['status']): Promise<Video[]> => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching videos by status:', error);
    throw error;
  }
};

// Tracking Results Operations
export const insertTrackingResults = async (results: TrackingResultInsert[]): Promise<TrackingResult[]> => {
  try {
    const { data, error } = await supabase
      .from('tracking_results')
      .insert(results)
      .select();

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error inserting tracking results:', error);
    throw error;
  }
};

export const getTrackingResultsByVideo = async (videoId: number): Promise<TrackingResult[]> => {
  try {
    const { data, error } = await supabase
      .from('tracking_results')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching tracking results:', error);
    throw error;
  }
};

export const getAllTrackingResults = async (): Promise<TrackingResult[]> => {
  try {
    const { data, error } = await supabase
      .from('tracking_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all tracking results:', error);
    throw error;
  }
};

export const updateTrackingResult = async (trackerId: number, updates: Partial<TrackingResult>): Promise<TrackingResult> => {
  try {
    const { data, error } = await supabase
      .from('tracking_results')
      .update(updates)
      .eq('tracker_id', trackerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating tracking result:', error);
    throw error;
  }
};

export const deleteTrackingResult = async (trackerId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('tracking_results')
      .delete()
      .eq('tracker_id', trackerId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting tracking result:', error);
    throw error;
  }
};

// Vehicle Counts Operations
export const insertVehicleCounts = async (counts: VehicleCountInsert[]): Promise<VehicleCount[]> => {
  try {
    const { data, error } = await supabase
      .from('vehicle_counts')
      .insert(counts)
      .select();

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error inserting vehicle counts:', error);
    throw error;
  }
};

export const getVehicleCountsByVideo = async (videoId: number): Promise<VehicleCount[]> => {
  try {
    const { data, error } = await supabase
      .from('vehicle_counts')
      .select('*')
      .eq('video_id', videoId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vehicle counts:', error);
    throw error;
  }
};

export const getAllVehicleCounts = async (): Promise<VehicleCount[]> => {
  try {
    const { data, error } = await supabase
      .from('vehicle_counts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all vehicle counts:', error);
    throw error;
  }
};

export const updateVehicleCount = async (id: number, updates: Partial<VehicleCount>): Promise<VehicleCount> => {
  try {
    const { data, error } = await supabase
      .from('vehicle_counts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating vehicle count:', error);
    throw error;
  }
};

export const deleteVehicleCount = async (id: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('vehicle_counts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting vehicle count:', error);
    throw error;
  }
};

// Analytics and Statistics
export const getVideoAnalytics = async (videoId: number) => {
  try {
    const [trackingResults, vehicleCounts] = await Promise.all([
      getTrackingResultsByVideo(videoId),
      getVehicleCountsByVideo(videoId)
    ]);

    const totalVehicles = trackingResults.length;
    const violations = trackingResults.filter(r => r.compliance === 0).length;
    const compliantVehicles = trackingResults.filter(r => r.compliance === 1);
    const complianceRate = totalVehicles > 0 ? (compliantVehicles.length / totalVehicles) * 100 : 0;

    const reactionTimes = compliantVehicles
      .map(r => r.reaction_time)
      .filter((time): time is number => time !== null && time !== undefined && time > 0);
    
    const avgReactionTime = reactionTimes.length > 0
      ? reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length
      : 0;

    const vehicleTypeStats = Array.from(new Set(trackingResults.map(r => r.vehicle_type)))
      .map(type => {
        const typeResults = trackingResults.filter(r => r.vehicle_type === type);
        const typeCompliant = typeResults.filter(r => r.compliance === 1);
        const typeReactionTimes = typeCompliant
          .map(r => r.reaction_time)
          .filter((time): time is number => time !== null && time !== undefined && time > 0);
        
        return {
          type,
          total: typeResults.length,
          compliant: typeCompliant.length,
          violations: typeResults.length - typeCompliant.length,
          avgReactionTime: typeReactionTimes.length > 0
            ? typeReactionTimes.reduce((sum, time) => sum + time, 0) / typeReactionTimes.length
            : 0,
          complianceRate: typeResults.length > 0 ? (typeCompliant.length / typeResults.length) * 100 : 0
        };
      });

    return {
      totalVehicles,
      violations,
      complianceRate,
      avgReactionTime,
      vehicleTypeStats,
      trackingResults,
      vehicleCounts
    };
  } catch (error) {
    console.error('Error getting video analytics:', error);
    throw error;
  }
};

export const getOverallAnalytics = async () => {
  try {
    const [videos, trackingResults, vehicleCounts] = await Promise.all([
      getAllVideos(),
      getAllTrackingResults(),
      getAllVehicleCounts()
    ]);

    const totalVideos = videos.length;
    const processedVideos = videos.filter(v => v.status === 'completed').length;
    const totalVehicles = trackingResults.length;
    const violations = trackingResults.filter(r => r.compliance === 0).length;
    const compliantVehicles = trackingResults.filter(r => r.compliance === 1);
    const complianceRate = totalVehicles > 0 ? (compliantVehicles.length / totalVehicles) * 100 : 0;

    const reactionTimes = compliantVehicles
      .map(r => r.reaction_time)
      .filter((time): time is number => time !== null && time !== undefined && time > 0);
    
    const avgReactionTime = reactionTimes.length > 0
      ? reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length
      : 0;

    return {
      totalVideos,
      processedVideos,
      totalVehicles,
      violations,
      complianceRate,
      avgReactionTime,
      trackingResults,
      vehicleCounts,
      videos
    };
  } catch (error) {
    console.error('Error getting overall analytics:', error);
    throw error;
  }
};

// Real-time subscriptions
export const subscribeToVideoChanges = (callback: (payload: any) => void) => {
  return supabase
    .channel('videos_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'videos' }, 
      callback
    )
    .subscribe();
};

export const subscribeToTrackingResults = (callback: (payload: any) => void) => {
  return supabase
    .channel('tracking_results_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'tracking_results' }, 
      callback
    )
    .subscribe();
};