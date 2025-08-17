/*
  # Update tasks data to match Jira board exactly

  1. Changes
    - Modify tasks table to use assignee_initials instead of assignee UUID
    - Insert tasks with proper assignee initials
    - Remove temporary users table
*/

-- First modify the tasks table to use initials
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignee_fkey;
ALTER TABLE tasks DROP COLUMN IF EXISTS assignee;
ALTER TABLE tasks ADD COLUMN assignee_initials text;

-- Clear existing tasks
TRUNCATE tasks CASCADE;

-- Insert tasks with assignee initials
INSERT INTO tasks (project_id, title, description, status, priority, type, labels, assignee_initials)
VALUES 
  -- TO DO Column
  ('PROJECT49-3', 'Documentation Framework', 'Set up documentation framework and guidelines', 'to_do', 'high', 'task', ARRAY['documentation', 'coordination'], 'SR'),
  ('PROJECT49-8', 'Auto-Labeling Using Pretrained YOLOv8', 'Implement auto-labeling functionality', 'to_do', 'high', 'task', ARRAY['technical', 'development'], 'SR'),
  ('PROJECT49-10', 'YOLOv8 Training Setup', 'Set up training environment for YOLOv8', 'to_do', 'high', 'task', ARRAY['technical', 'development'], 'SR'),

  -- IN PROGRESS Column
  ('PROJECT49-2', 'Setup Development Environment', 'Configure development environment', 'in_progress', 'high', 'task', ARRAY['technical', 'development'], 'QV'),
  ('PROJECT49-6', 'Initial Research on YOLO and Computer Vision Tools', 'Research and evaluate tools', 'in_progress', 'medium', 'task', ARRAY['technical', 'development'], 'SR'),
  ('PROJECT49-7', 'Frame Extraction from Traffic Video', 'Extract frames from footage', 'in_progress', 'medium', 'task', ARRAY['technical', 'development'], 'RC'),
  ('PROJECT49-9', 'Dataset Preparation', 'Prepare training dataset', 'in_progress', 'high', 'task', ARRAY['technical', 'development'], 'JA'),
  ('PROJECT49-11', 'Project Repository Setup', 'Set up Node, Vite, Tailwind', 'in_progress', 'low', 'task', ARRAY['technical', 'development'], 'SR'),
  ('PROJECT49-13', 'Worklog and Sprint Report Updates', 'Update documentation', 'in_progress', 'medium', 'task', ARRAY['documentation', 'coordination'], 'TT'),

  -- DONE Column
  ('PROJECT49-1', 'Create Project Plan & Team Roles', 'Define project structure', 'done', 'high', 'task', ARRAY['planning', 'setup'], 'SR'),
  ('PROJECT49-3', 'Client Meeting for Scope Clarification', 'Clarify requirements', 'done', 'high', 'task', ARRAY['planning', 'setup'], 'FP'),
  ('PROJECT49-4', 'Supervisor Meetings & Adjustments', 'Regular meetings', 'done', 'medium', 'task', ARRAY['planning', 'setup'], 'TT'),
  ('PROJECT49-14', 'Project Plan', 'Create detailed plan', 'done', 'high', 'task', ARRAY['documentation', 'coordination'], 'FP'),
  ('PROJECT49-15', 'Set up project repository, tools', 'Setup Jira and GitHub', 'done', 'high', 'task', ARRAY['planning', 'setup'], 'SR');