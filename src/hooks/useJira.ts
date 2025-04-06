import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
      statusCategory: {
        colorName: string;
      };
    };
    issuetype: {
      name: string;
    };
    priority: {
      name: string;
    };
    assignee: {
      displayName: string;
      avatarUrls: {
        '48x48': string;
      };
    } | null;
    created: string;
    updated: string;
    labels: string[];
    sprint?: {
      id: number;
      name: string;
      startDate: string;
      endDate: string;
    };
  };
}

export interface Sprint {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  issues: JiraIssue[];
}

export const useJira = () => {
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchJiraData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/proxy-jira');
        
        if (!response.ok) {
          throw new Error(`API Error (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        if (!data?.issues) {
          throw new Error('Invalid response format');
        }

        // Add mock sprint data for demo
        const issuesWithSprint = data.issues.map((issue: JiraIssue) => ({
          ...issue,
          fields: {
            ...issue.fields,
            sprint: {
              id: 1,
              name: 'Sprint 1',
              startDate: '2024-04-04',
              endDate: '2024-04-25'
            }
          }
        }));

        setIssues(issuesWithSprint);
      } catch (err) {
        console.error('Error fetching Jira data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch issues');
      } finally {
        setLoading(false);
      }
    };

    fetchJiraData();
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'done':
        return 'bg-green-500/10 text-green-500';
      case 'in progress':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'PLANNING & SETUP':
        return 'bg-purple-500/10 text-purple-500';
      case 'TECHNICAL & DEVELOPMENT':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'DOCUMENTATION & COORDINATION':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getLastSevenDaysStats = () => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const recentIssues = issues.filter(issue => 
      new Date(issue.fields.updated) >= sevenDaysAgo
    );

    return {
      completed: recentIssues.filter(i => i.fields.status.name === 'Done').length,
      updated: recentIssues.length,
      created: recentIssues.filter(i => 
        new Date(i.fields.created) >= sevenDaysAgo
      ).length,
      dueSoon: 0
    };
  };

  const getStatusOverview = () => {
    const total = issues.length;
    const todo = issues.filter(i => i.fields.status.name === 'To Do').length;
    const inProgress = issues.filter(i => i.fields.status.name === 'In Progress').length;
    const done = issues.filter(i => i.fields.status.name === 'Done').length;

    return { total, todo, inProgress, done };
  };

  const getRecentActivity = () => {
    return issues
      .sort((a, b) => new Date(b.fields.updated).getTime() - new Date(a.fields.updated).getTime())
      .slice(0, 5)
      .map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        updated: issue.fields.updated,
        assignee: issue.fields.assignee?.displayName,
        avatarUrl: issue.fields.assignee?.avatarUrls['48x48']
      }));
  };

  const getTypeDistribution = () => {
    const total = issues.length;
    const types = issues.reduce((acc, issue) => {
      const type = issue.fields.issuetype.name;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(types).map(([type, count]) => ({
      type,
      percentage: Math.round((count / total) * 100)
    }));
  };

  const getIssuesByStatus = () => {
    return {
      todo: issues.filter(i => i.fields.status.name === 'To Do'),
      inProgress: issues.filter(i => i.fields.status.name === 'In Progress'),
      done: issues.filter(i => i.fields.status.name === 'Done')
    };
  };

  const getSprintIssues = () => {
    return {
      id: 1,
      name: 'Sprint 1',
      startDate: '2024-04-04',
      endDate: '2024-04-25',
      issues: issues.filter(issue => issue.fields.sprint?.id === 1)
    };
  };

  const getPriorityDistribution = () => {
    const priorities = issues.reduce((acc, issue) => {
      const priority = issue.fields.priority.name;
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = issues.length;
    return Object.entries(priorities).map(([priority, count]) => ({
      priority,
      count,
      percentage: Math.round((count / total) * 100)
    }));
  };

  const filteredIssues = issues.filter(issue => {
    if (!searchQuery) return true;
    return (
      issue.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.fields.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return {
    issues: filteredIssues,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    formatDate,
    getStatusColor,
    getLabelColor,
    getLastSevenDaysStats,
    getStatusOverview,
    getRecentActivity,
    getTypeDistribution,
    getIssuesByStatus,
    getSprintIssues,
    getPriorityDistribution
  };
};