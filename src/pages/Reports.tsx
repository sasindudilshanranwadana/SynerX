import React from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  Download, Filter, Calendar, Search, CheckCircle
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

// Dummy data for charts
const violationData = [
  { date: '03/10', speed: 12, signal: 5, other: 3 },
  { date: '03/11', speed: 8, signal: 7, other: 4 },
  { date: '03/12', speed: 15, signal: 3, other: 2 },
  { date: '03/13', speed: 10, signal: 8, other: 5 },
  { date: '03/14', speed: 7, signal: 4, other: 3 }
];

const complianceData = [
  { time: '06:00', rate: 95 },
  { time: '09:00', rate: 88 },
  { time: '12:00', rate: 92 },
  { time: '15:00', rate: 85 },
  { time: '18:00', rate: 90 }
];

function Reports() {
  const [reportType, setReportType] = React.useState('all');
  const [selectedDate, setSelectedDate] = React.useState('');
  const [showToast, setShowToast] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const generateReport = () => {
    const doc = new jsPDF();
    const title = 'Daily Safety Report';
    const date = new Date().toLocaleDateString();

    doc.setFontSize(20);
    doc.text(title, 20, 20);
    doc.setFontSize(12);
    doc.text(`Generated on: ${date}`, 20, 30);

    const content = [
      ['Date', 'Violations', 'Compliance Rate', 'Actions Taken'],
      ['2024-03-15', '8', '92%', 'Warning Issued'],
      ['2024-03-14', '12', '88%', 'Citations Issued'],
      ['2024-03-13', '6', '94%', 'Monitoring Increased']
    ];

    (doc as any).autoTable({
      startY: 40,
      head: [content[0]],
      body: content.slice(1),
      theme: 'grid',
      styles: { fontSize: 10 }
    });

    doc.save('daily-safety-report.pdf');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5" />
          <span>Report generated successfully</span>
        </div>
      )}

      {/* Header */}
      <Header 
        title="Reports" 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        isSidebarOpen={sidebarOpen} 
      />

      {/* Sidebar */}
      <Sidebar 
        activePath="/reports" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">Reports & Analytics</h1>
            <p className="text-gray-400">Generate and download detailed safety reports</p>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-8">
            {/* Violation Trends Chart */}
            <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl">
              <h3 className="text-xl font-semibold mb-6">Violation Trends</h3>
              <div className="h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={violationData}>
                    <XAxis dataKey="date" stroke="#64748B" />
                    <YAxis stroke="#64748B" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151F32',
                        border: '1px solid #1E293B',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="speed" stackId="a" fill="#EF4444" />
                    <Bar dataKey="signal" stackId="a" fill="#F59E0B" />
                    <Bar dataKey="other" stackId="a" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Compliance Rate Chart */}
            <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl">
              <h3 className="text-xl font-semibold mb-6">Compliance Rate</h3>
              <div className="h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={complianceData}>
                    <XAxis dataKey="time" stroke="#64748B" />
                    <YAxis stroke="#64748B" domain={[80, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151F32',
                        border: '1px solid #1E293B',
                        borderRadius: '8px'
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
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-8">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                <Filter className="w-4 h-4 inline-block mr-2" />
                Report Type
              </label>
              <select
                className="w-full bg-[#151F32] border border-[#1E293B] rounded-lg px-4 py-2"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="daily">Daily Report</option>
                <option value="weekly">Weekly Summary</option>
                <option value="monthly">Monthly Analysis</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                <Calendar className="w-4 h-4 inline-block mr-2" />
                Date
              </label>
              <input
                type="date"
                className="w-full bg-[#151F32] border border-[#1E293B] rounded-lg px-4 py-2"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* Reports List */}
          <div className="space-y-4">
            {/* Daily Report Card */}
            <div className="bg-[#151F32] rounded-xl p-4 lg:p-6">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <h3 className="text-lg lg:text-xl font-semibold">Daily Safety Report - March 15, 2024</h3>
                  <p className="text-gray-400 mt-1">Overview of safety incidents and compliance metrics</p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                    <span>Daily Report</span>
                    <span>•</span>
                    <span>15/03/2024</span>
                  </div>
                </div>
                <button
                  onClick={generateReport}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 w-full lg:w-auto justify-center"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
              </div>
            </div>

            {/* Weekly Report Card */}
            <div className="bg-[#151F32] rounded-xl p-4 lg:p-6">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <h3 className="text-lg lg:text-xl font-semibold">Weekly Analysis - March 8-14, 2024</h3>
                  <p className="text-gray-400 mt-1">Comprehensive analysis of weekly trends and patterns</p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                    <span>Weekly Report</span>
                    <span>•</span>
                    <span>14/03/2024</span>
                  </div>
                </div>
                <button
                  onClick={generateReport}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2  rounded-lg transition-colors flex items-center gap-2 w-full lg:w-auto justify-center"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Reports;