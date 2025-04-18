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