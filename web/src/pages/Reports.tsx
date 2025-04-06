import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Filter, Calendar, ChevronDown } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Report {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly';
  date: Date;
  summary: string;
  downloadUrl: string;
}

const Reports: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');

  // Sample data - replace with actual data from your backend
  const reports: Report[] = [
    {
      id: '1',
      title: 'Daily Safety Report - March 15, 2024',
      type: 'daily',
      date: new Date('2024-03-15'),
      summary: 'Overview of safety incidents and compliance metrics',
      downloadUrl: '#'
    },
    {
      id: '2',
      title: 'Weekly Analysis - March 8-14, 2024',
      type: 'weekly',
      date: new Date('2024-03-14'),
      summary: 'Comprehensive analysis of weekly trends and patterns',
      downloadUrl: '#'
    }
  ];

  // Sample analytics data
  const violationData = [
    { date: '03/10', speed: 12, signal: 5, crossing: 3 },
    { date: '03/11', speed: 8, signal: 7, crossing: 4 },
    { date: '03/12', speed: 15, signal: 3, crossing: 2 },
    { date: '03/13', speed: 10, signal: 8, crossing: 5 },
    { date: '03/14', speed: 7, signal: 4, crossing: 3 }
  ];

  const complianceData = [
    { time: '06:00', rate: 95 },
    { time: '09:00', rate: 88 },
    { time: '12:00', rate: 92 },
    { time: '15:00', rate: 85 },
    { time: '18:00', rate: 90 }
  ];

  const filteredReports = reports.filter(report => {
    const matchesType = !selectedType || report.type === selectedType;
    const matchesDate = !selectedDate || report.date.toISOString().startsWith(selectedDate);
    return matchesType && matchesDate;
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Reports & Analytics</h1>
        <p className="text-gray-400">
          Generate and download detailed safety reports
        </p>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 p-6 rounded-lg"
        >
          <h2 className="text-xl font-semibold text-white mb-6">Violation Trends</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={violationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.5rem'
                  }}
                />
                <Bar dataKey="speed" fill="#EF4444" name="Speed" />
                <Bar dataKey="signal" fill="#F59E0B" name="Signal" />
                <Bar dataKey="crossing" fill="#3B82F6" name="Crossing" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800 p-6 rounded-lg"
        >
          <h2 className="text-xl font-semibold text-white mb-6">Compliance Rate</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={complianceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" domain={[80, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.5rem'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="flex items-center gap-2 text-gray-400 mb-2">
            <Filter className="w-4 h-4" />
            Report Type
          </label>
          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="">All Types</option>
            <option value="daily">Daily Reports</option>
            <option value="weekly">Weekly Reports</option>
            <option value="monthly">Monthly Reports</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 text-gray-400 mb-2">
            <Calendar className="w-4 h-4" />
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white"
          />
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.map((report) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 rounded-lg p-6 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">{report.title}</h3>
                <p className="text-gray-400 mb-4">{report.summary}</p>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="capitalize">{report.type} Report</span>
                  <span>•</span>
                  <span>{report.date.toLocaleDateString()}</span>
                </div>
              </div>
              <a
                href={report.downloadUrl}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </a>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Generate Report Button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white shadow-lg transition-colors"
      >
        <FileText className="w-5 h-5" />
        <span>Generate New Report</span>
      </motion.button>
    </div>
  );
};

export default Reports;