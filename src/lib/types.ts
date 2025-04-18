export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'to_do' | 'in_progress' | 'done';
  priority: 'high' | 'medium' | 'low';
  type: 'task' | 'epic' | 'bug' | 'story';
  labels?: string[];
  assignee: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskStats {
  completed: number;
  updated: number;
  created: number;
  dueSoon: number;
}

export interface TaskCounts {
  todo: number;
  inProgress: number;
  done: number;
}

export interface PriorityCounts {
  high: number;
  medium: number;
  low: number;
}