import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useJira } from '../hooks/useJira';
import { 
  AlertCircle,
  Loader2,
  CheckCircle,
  FileEdit,
  FilePlus,
  Clock,
  ListTodo,
  Bug,
  Zap,
  ExternalLink,
  Search,
  User,
  ChevronRight,
  Plus,
  Filter,
  Settings,
  AlertTriangle,
  ArrowUpCircle,
  BarChart2,
  Calendar,
  Flag,
  Target
} from 'lucide-react';

const TeamLogs: React.FC = () => {
  const { 
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
    getIssuesByStatus
  } = useJira();

  const [view, setView] = useState<'summary' | 'board'>('summary');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading Jira issues...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-500">Error Loading Issues</h3>
            <p className="text-red-500/80 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const renderSummaryView = () => {
    const sevenDayStats = getLastSevenDaysStats();
    const statusOverview = getStatusOverview();
    const recentActivity = getRecentActivity();
    const typeDistribution = getTypeDistribution();

    return (
      <>
        {/* Sprint Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Sprint progress</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>Apr 4 - Apr 25</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-4">
              <Target className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">15</p>
                <p className="text-sm text-gray-500">Total issues</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <BarChart2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">67%</p>
                <p className="text-sm text-gray-500">Completion rate</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Clock className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">14 days</p>
                <p className="text-sm text-gray-500">Remaining</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-gray-500">Blockers</p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Sprint progress</span>
              <span className="text-sm font-medium">67%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div className="h-full w-[67%] bg-blue-500 rounded-full" />
            </div>
          </div>
        </motion.div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Status Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <h2 className="text-xl font-semibold mb-6">Status overview</h2>
            <div className="relative aspect-square max-w-[200px] mx-auto">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="10"
                  strokeDasharray={`${(statusOverview.inProgress / statusOverview.total) * 283} 283`}
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="10"
                  strokeDasharray={`${(statusOverview.done / statusOverview.total) * 283} 283`}
                  strokeDashoffset={-((statusOverview.inProgress / statusOverview.total) * 283)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold">{statusOverview.total}</p>
                  <p className="text-sm text-gray-500">Total issues</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6 text-center">
              <div>
                <p className="text-gray-500">To Do</p>
                <p className="text-xl font-bold">{statusOverview.todo}</p>
              </div>
              <div>
                <p className="text-gray-500">In Progress</p>
                <p className="text-xl font-bold">{statusOverview.inProgress}</p>
              </div>
              <div>
                <p className="text-gray-500">Done</p>
                <p className="text-xl font-bold">{statusOverview.done}</p>
              </div>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <h2 className="text-xl font-semibold mb-6">Recent activity</h2>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.key} className="flex items-start gap-4">
                  {activity.avatarUrl ? (
                    <img
                      src={activity.avatarUrl}
                      alt={activity.assignee || 'User'}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{activity.summary}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{activity.key}</span>
                      <span>•</span>
                      <span>{formatDate(activity.updated)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Types of Work */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <h2 className="text-xl font-semibold mb-6">Types of work</h2>
            <div className="space-y-6">
              {typeDistribution.map(({ type, percentage }) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {type === 'Task' && <ListTodo className="w-5 h-5 text-blue-500" />}
                      {type === 'Bug' && <Bug className="w-5 h-5 text-red-500" />}
                      {type === 'Epic' && <Zap className="w-5 h-5 text-purple-500" />}
                      <span>{type}</span>
                    </div>
                    <span>{percentage}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                    <div 
                      className={`h-full rounded-full ${
                        type === 'Task' ? 'bg-blue-500' :
                        type === 'Bug' ? 'bg-red-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </>
    );
  };

  const renderBoardView = () => {
    const issuesByStatus = getIssuesByStatus();

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* To Do Column */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">To Do</h3>
              <span className="text-sm text-gray-500">{issuesByStatus.todo.length}</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {issuesByStatus.todo.map((issue) => (
              <div
                key={issue.key}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-500">{issue.key}</span>
                  {issue.fields.labels.map((label) => (
                    <span
                      key={label}
                      className={`px-2 py-0.5 text-xs rounded-full ${getLabelColor(label)}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <p className="mb-3">{issue.fields.summary}</p>
                {issue.fields.assignee && (
                  <div className="flex items-center gap-2">
                    <img
                      src={issue.fields.assignee.avatarUrls['48x48']}
                      alt={issue.fields.assignee.displayName}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-sm text-gray-500">
                      {issue.fields.assignee.displayName}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">In Progress</h3>
              <span className="text-sm text-gray-500">{issuesByStatus.inProgress.length}</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {issuesByStatus.inProgress.map((issue) => (
              <div
                key={issue.key}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-500">{issue.key}</span>
                  {issue.fields.labels.map((label) => (
                    <span
                      key={label}
                      className={`px-2 py-0.5 text-xs rounded-full ${getLabelColor(label)}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <p className="mb-3">{issue.fields.summary}</p>
                {issue.fields.assignee && (
                  <div className="flex items-center gap-2">
                    <img
                      src={issue.fields.assignee.avatarUrls['48x48']}
                      alt={issue.fields.assignee.displayName}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-sm text-gray-500">
                      {issue.fields.assignee.displayName}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Done Column */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Done</h3>
              <span className="text-sm text-gray-500">{issuesByStatus.done.length}</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {issuesByStatus.done.map((issue) => (
              <div
                key={issue.key}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-500">{issue.key}</span>
                  {issue.fields.labels.map((label) => (
                    <span
                      key={label}
                      className={`px-2 py-0.5 text-xs rounded-full ${getLabelColor(label)}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <p className="mb-3">{issue.fields.summary}</p>
                {issue.fields.assignee && (
                  <div className="flex items-center gap-2">
                    <img
                      src={issue.fields.assignee.avatarUrls['48x48']}
                      alt={issue.fields.assignee.displayName}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-sm text-gray-500">
                      {issue.fields.assignee.displayName}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {view === 'summary' ? 'Summary' : 'Board'}
          </h1>
          <p className="text-gray-400">
            {view === 'summary' ? 'Project overview and statistics' : 'Track work in progress'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setView('summary')}
              className={`px-4 py-2 ${
                view === 'summary'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setView('board')}
              className={`px-4 py-2 ${
                view === 'board'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Board
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {view === 'summary' && renderSummaryView()}
      {view === 'board' && renderBoardView()}
    </div>
  );
};

export default TeamLogs;