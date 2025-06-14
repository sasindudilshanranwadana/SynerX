import React from 'react';
<<<<<<< Updated upstream
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Car, Activity } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

// Dummy data for charts
const vehicleData = [
  { time: '00:00', count: 95, speed: 45 },
  { time: '04:00', count: 80, speed: 48 },
  { time: '08:00', count: 285, speed: 35 },
  { time: '12:00', count: 320, speed: 32 },
  { time: '16:00', count: 380, speed: 30 },
  { time: '20:00', count: 190, speed: 42 }
];

function Analytics() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const stats = [
    {
      title: 'Total Vehicles',
      value: '1,420',
      change: '+12%',
      icon: <Car className="w-6 h-6" />
    },
    {
      title: 'Avg. Speed',
      value: '38 km/h',
      change: '-5%',
      icon: <Activity className="w-6 h-6" />
    },
    {
      title: 'Violations',
      value: '26',
      change: '+8%',
      icon: <Activity className="w-6 h-6" />
    }
  ];

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      {/* Header */}
=======
import { Activity, Upload as UploadIcon, FileSpreadsheet, Download } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Plot from 'react-plotly.js';
import Papa from 'papaparse';
import { format, parseISO } from 'date-fns';
import { generatePDFReport } from '../lib/api';

interface VehicleData {
  tracker_id: string;
  vehicle_type: string;
  status: string;
  compliance: number;
  reaction_time?: string;
  date: string;
}

function Analytics() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [data, setData] = React.useState<VehicleData[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const parsedData = results.data as VehicleData[];
        setData(parsedData.filter(item => item.tracker_id && item.vehicle_type));
        setError(null);
      },
      error: (error) => {
        setError('Error parsing CSV file: ' + error.message);
      }
    });
  };

  const calculateMetrics = () => {
    const totalVehicles = data.length;
    const compliantVehicles = data.filter(d => d.compliance === 1).length;
    const complianceRate = ((compliantVehicles / totalVehicles) * 100).toFixed(1);
    const violations = totalVehicles - compliantVehicles;

    const validReactionTimes = data
      .filter(d => d.compliance === 1 && d.reaction_time)
      .map(d => parseFloat(d.reaction_time || '0'));
    const avgReactionTime = validReactionTimes.length > 0
      ? (validReactionTimes.reduce((sum, time) => sum + time, 0) / validReactionTimes.length).toFixed(2)
      : '0';

    const violationsByHour = data.reduce((acc: { [key: string]: number }, curr) => {
      if (!curr.date || curr.compliance === 1) return acc;
      const hour = format(parseISO(curr.date), 'HH:00');
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});
    const peakViolationHour = Object.entries(violationsByHour)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

    const vehicleTypeStats = Array.from(new Set(data.map(d => d.vehicle_type)))
      .map(type => {
        const vehicles = data.filter(d => d.vehicle_type === type);
        const total = vehicles.length;
        const compliant = vehicles.filter(d => d.compliance === 1).length;
        const typeViolations = total - compliant;
        const typeReactionTimes = vehicles
          .filter(d => d.compliance === 1 && d.reaction_time)
          .map(d => parseFloat(d.reaction_time || '0'));
        const avgTypeReactionTime = typeReactionTimes.length > 0
          ? typeReactionTimes.reduce((sum, time) => sum + time, 0) / typeReactionTimes.length
          : 0;

        return {
          type,
          total,
          compliant,
          violations: typeViolations,
          avgReactionTime: avgTypeReactionTime
        };
      });

    return {
      totalVehicles,
      complianceRate,
      avgReactionTime,
      violations,
      peakViolationHour,
      vehicleTypeStats
    };
  };

  const prepareReactionTimeDistribution = () => {
    const vehicleTypes = Array.from(new Set(data.map(d => d.vehicle_type)));
  
    return [{
      type: 'box',
      x: data.map(d => d.vehicle_type),
      y: data.map(d => d.reaction_time ? parseFloat(d.reaction_time) : null),
      name: 'Reaction Time',
      boxpoints: 'outliers',
      marker: {
        color: '#06B6D4'
      },
      hovertemplate: '<b>%{x}</b><br>' +
                    'Reaction Time: %{y:.2f}s<extra></extra>'
    }];
  };

  const prepareStatusDistribution = () => {
    const statusCounts = data.reduce((acc: { [key: string]: number }, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});

    const statuses = Object.keys(statusCounts);
    const counts = statuses.map(status => statusCounts[status]);
    const total = counts.reduce((a, b) => a + b, 0);
    const percentages = counts.map(count => ((count / total) * 100).toFixed(1));

    return [{
      type: 'pie',
      labels: statuses.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      values: counts,
      textinfo: 'label+percent',
      hovertemplate: '<b>%{label}</b><br>' +
                    'Count: %{value}<br>' +
                    'Percentage: %{percent}<extra></extra>',
      marker: {
        colors: ['#06B6D4', '#10B981', '#EF4444'],
        line: {
          color: '#1E293B',
          width: 2
        }
      }
    }];
  };

  const prepareStatusOverTime = () => {
    const statusCounts = data.reduce((acc: { [key: string]: { [key: string]: number } }, curr) => {
      if (!curr.date) return acc;
      const hour = format(parseISO(curr.date), 'HH:00');
      if (!acc[hour]) acc[hour] = {};
      if (!acc[hour][curr.status]) acc[hour][curr.status] = 0;
      acc[hour][curr.status]++;
      return acc;
    }, {});

    const hours = Object.keys(statusCounts).sort();
    const statuses = Array.from(new Set(data.map(d => d.status)));
    const colors = ['#06B6D4', '#10B981', '#EF4444', '#F59E0B'];

    return statuses.map((status, index) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name: status.charAt(0).toUpperCase() + status.slice(1),
      x: hours,
      y: hours.map(hour => statusCounts[hour][status] || 0),
      line: { 
        shape: 'spline',
        color: colors[index % colors.length],
        width: 3
      },
      marker: {
        size: 8,
        symbol: 'circle'
      },
      hovertemplate: '<b>Hour: %{x}</b><br>' +
                    'Count: %{y}<br>' +
                    'Status: ' + status + '<extra></extra>'
    }));
  };

  const prepareStatusComplianceFlow = () => {
    const statusData = data.reduce((acc: { [key: string]: { compliant: number, total: number } }, curr) => {
      if (!acc[curr.status]) acc[curr.status] = { compliant: 0, total: 0 };
      acc[curr.status].total++;
      if (curr.compliance === 1) acc[curr.status].compliant++;
      return acc;
    }, {});

    const statuses = Object.keys(statusData);
    
    return [{
      type: 'bar',
      name: 'Total Vehicles',
      x: statuses.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      y: statuses.map(s => statusData[s].total),
      marker: { 
        color: '#06B6D4',
        opacity: 0.8
      },
      hovertemplate: '<b>%{x}</b><br>' +
                    'Total Vehicles: %{y}<extra></extra>'
    }, {
      type: 'scatter',
      name: 'Compliance Rate',
      x: statuses.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      y: statuses.map(s => (statusData[s].compliant / statusData[s].total) * 100),
      yaxis: 'y2',
      line: { 
        color: '#10B981',
        width: 3
      },
      marker: {
        size: 10,
        symbol: 'diamond'
      },
      hovertemplate: '<b>%{x}</b><br>' +
                    'Compliance Rate: %{y:.1f}%<extra></extra>'
    }];
  };

  const prepareReactionTimeScatter = () => {
    return [{
      x: data.map(d => d.tracker_id),
      y: data.map(d => d.reaction_time ? parseFloat(d.reaction_time) : null),
      type: 'scatter',
      mode: 'markers',
      marker: {
        color: data.map(d => d.vehicle_type === 'car' ? '#06B6D4' : 
                          d.vehicle_type === 'truck' ? '#EF4444' : '#10B981'),
        symbol: data.map(d => d.status === 'moving' ? 'circle' : 'square'),
        size: 8
      },
      text: data.map(d => `${d.vehicle_type} (${d.status})`),
      hovertemplate: '<b>Tracker ID: %{x}</b><br>' +
                  'Reaction Time: %{y:.2f}s<br>' +
                  'Vehicle: %{text}<extra></extra>'
    }];
  };

  const prepareEventTimeline = () => {
    const trackers = Array.from(new Set(data.map(d => d.tracker_id))).slice(0, 10);
    
    return trackers.map(tracker => {
      const events = data.filter(d => d.tracker_id === tracker);
      return {
        x: events.map(e => e.date),
        y: Array(events.length).fill(tracker),
        type: 'scatter',
        mode: 'lines+markers',
        name: `Tracker ${tracker}`,
        line: { color: events[0].compliance === 1 ? '#10B981' : '#EF4444' },
        marker: {
          color: events.map(e => e.status === 'moving' ? '#EF4444' : '#10B981'),
          size: 8
        },
        hovertemplate: '<b>Time: %{x}</b><br>' +
                    'Tracker: %{y}<br>' +
                    'Status: ' + events.map(e => e.status) + '<extra></extra>'
      };
    });
  };

  const prepareReactionTimeHistogram = () => {
    const reactionTimes = data
      .filter(d => d.reaction_time)
      .map(d => parseFloat(d.reaction_time || '0'));

    return [{
      type: 'histogram',
      x: reactionTimes,
      name: 'Frequency',
      marker: {
        color: '#06B6D4',
        line: {
          color: '#1E293B',
          width: 1
        }
      },
      opacity: 0.75,
      hovertemplate: 'Reaction Time: %{x:.2f}s<br>Count: %{y}<extra></extra>'
    }, {
      type: 'scatter',
      x: reactionTimes,
      y: [],
      name: 'Distribution',
      yaxis: 'y2',
      mode: 'lines',
      line: {
        color: '#10B981',
        width: 2
      },
      hoverinfo: 'skip'
    }];
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
>>>>>>> Stashed changes
      <Header 
        title="Analytics" 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        isSidebarOpen={sidebarOpen} 
      />

<<<<<<< Updated upstream
      {/* Sidebar */}
=======
>>>>>>> Stashed changes
      <Sidebar 
        activePath="/analytics" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

<<<<<<< Updated upstream
      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">Analytics</h1>
            <p className="text-gray-400">Comprehensive analysis of traffic patterns and behavior</p>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-8">
            {/* Location Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Location</label>
              <select className="w-full bg-[#151F32] border border-[#1E293B] rounded-lg px-4 py-2 text-white">
                <option>Crossing A-12</option>
                <option>Crossing B-15</option>
                <option>Crossing C-08</option>
              </select>
            </div>
            {/* Time Range */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Time Range</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button className="bg-primary-500 text-white px-4 py-2 rounded-lg">24 Hours</button>
                <button className="bg-[#151F32] text-gray-400 px-4 py-2 rounded-lg hover:bg-[#1E293B]">7 Days</button>
                <button className="bg-[#151F32] text-gray-400 px-4 py-2 rounded-lg hover:bg-[#1E293B]">30 Days</button>
                <button className="bg-[#151F32] text-gray-400 px-4 py-2 rounded-lg hover:bg-[#1E293B]">3 Months</button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
            {stats.map((stat, index) => (
              <div key={index} className="bg-[#151F32] p-4 lg:p-6 rounded-xl border border-[#1E293B]">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 lg:p-3 bg-primary-500/10 rounded-lg text-primary-400">
                    {stat.icon}
                  </div>
                  <span className={`text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full ${
                    stat.change.startsWith('+') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>{stat.change}</span>
                </div>
                <h3 className="text-xl lg:text-2xl font-bold mb-1">{stat.value}</h3>
                <p className="text-gray-400 text-sm">{stat.title}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Vehicle Count Chart */}
            <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-6">Vehicle Count</h3>
              <div className="h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vehicleData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#64748B" />
                    <YAxis stroke="#64748B" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151F32',
                        border: '1px solid #1E293B',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#06B6D4"
                      fill="url(#colorCount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Speed Distribution Chart */}
            <div className="bg-[#151F32] p-4 lg:p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-6">Speed Distribution</h3>
              <div className="h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vehicleData}>
                    <XAxis dataKey="time" stroke="#64748B" />
                    <YAxis stroke="#64748B" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151F32',
                        border: '1px solid #1E293B',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Bar dataKey="speed" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
=======
      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">Traffic Analysis Dashboard</h1>
            <p className="text-gray-400">Upload CSV files to analyze traffic patterns and generate reports</p>
          </div>

          <div className="bg-[#151F32] p-8 rounded-xl mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary-500/10 rounded-lg">
                <FileSpreadsheet className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Upload CSV File</h2>
                <p className="text-gray-400">Upload your vehicle tracking data for analysis</p>
              </div>
            </div>

            <div className="flex gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              >
                <UploadIcon className="w-5 h-5" />
                Choose File
              </button>

              {data.length > 0 && (
                <button
                  onClick={() => {
                    const metrics = calculateMetrics();
                    const report = generatePDFReport(data, metrics);
                    report.save('traffic-analysis-report.pdf');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download Report
                </button>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 text-red-400 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {data.length > 0 ? (
            <div className="space-y-8">
              <div className="bg-[#151F32] p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Reaction Time Distribution</h3>
                <Plot
                  data={prepareReactionTimeHistogram()}
                  layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#fff', size: 14 },
                    xaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Reaction Time (seconds)',
                        font: { size: 14 }
                      }
                    },
                    yaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Frequency',
                        font: { size: 14 }
                      },
                      zeroline: false
                    },
                    yaxis2: {
                      overlaying: 'y',
                      side: 'right',
                      showgrid: false,
                      zeroline: false,
                      showticklabels: false
                    },
                    margin: { t: 30, b: 80, l: 80, r: 50 },
                    showlegend: false,
                    bargap: 0.1
                  }}
                  className="w-full h-[400px]"
                  config={{ responsive: true }}
                />
              </div>

              <div className="bg-[#151F32] p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Average Reaction Time by Vehicle Type</h3>
                <Plot
                  data={prepareReactionTimeDistribution()}
                  layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#fff', size: 14 },
                    xaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Vehicle Type',
                        font: { size: 14 }
                      }
                    },
                    yaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Reaction Time (seconds)',
                        font: { size: 14 }
                      },
                      zeroline: false
                    },
                    margin: { t: 30, b: 80, l: 80, r: 50 },
                    showlegend: false
                  }}
                  className="w-full h-[400px]"
                  config={{ responsive: true }}
                />
              </div>

              <div className="bg-[#151F32] p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Vehicle Status Distribution</h3>
                <Plot
                  data={prepareStatusDistribution()}
                  layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#fff', size: 14 },
                    margin: { t: 30, b: 80, l: 30, r: 30 },
                    showlegend: true,
                    legend: {
                      orientation: 'h',
                      y: -0.2
                    }
                  }}
                  className="w-full h-[400px]"
                  config={{ responsive: true }}
                />
              </div>

              <div className="bg-[#151F32] p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Vehicle Status Distribution Over Time</h3>
                <Plot
                  data={prepareStatusOverTime()}
                  layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#fff', size: 14 },
                    xaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Hour of Day',
                        font: { size: 14 }
                      }
                    },
                    yaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Number of Vehicles',
                        font: { size: 14 }
                      },
                      zeroline: false
                    },
                    margin: { t: 30, b: 80, l: 80, r: 50 },
                    showlegend: true,
                    legend: {
                      orientation: 'h',
                      y: -0.2
                    }
                  }}
                  className="w-full h-[400px]"
                  config={{ responsive: true }}
                />
              </div>

              <div className="bg-[#151F32] p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Vehicle Status and Compliance Analysis</h3>
                <Plot
                  data={prepareStatusComplianceFlow()}
                  layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#fff', size: 14 },
                    xaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Vehicle Status',
                        font: { size: 14 }
                      }
                    },
                    yaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Total Vehicles',
                        font: { size: 14 }
                      },
                      zeroline: false
                    },
                    yaxis2: {
                      title: {
                        text: 'Compliance Rate (%)',
                        font: { size: 14 }
                      },
                      overlaying: 'y',
                      side: 'right',
                      gridcolor: '#1E293B',
                      zeroline: false,
                      range: [0, 100]
                    },
                    margin: { t: 30, b: 80, l: 80, r: 80 },
                    showlegend: true,
                    legend: {
                      orientation: 'h',
                      y: -0.2
                    }
                  }}
                  className="w-full h-[400px]"
                  config={{ responsive: true }}
                />
              </div>

              <div className="bg-[#151F32] p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Reaction Time by Vehicle</h3>
                <Plot
                  data={prepareReactionTimeScatter()}
                  layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#fff', size: 14 },
                    xaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Vehicle Tracker ID',
                        font: { size: 14 }
                      }
                    },
                    yaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Reaction Time (seconds)',
                        font: { size: 14 }
                      },
                      zeroline: false
                    },
                    margin: { t: 30, b: 80, l: 80, r: 50 },
                    showlegend: false
                  }}
                  className="w-full h-[400px]"
                  config={{ responsive: true }}
                />
              </div>

              <div className="bg-[#151F32] p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Vehicle Event Timeline</h3>
                <Plot
                  data={prepareEventTimeline()}
                  layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#fff', size: 14 },
                    xaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Timestamp (Date/Time)',
                        font: { size: 14 }
                      }
                    },
                    yaxis: { 
                      gridcolor: '#1E293B',
                      title: {
                        text: 'Vehicle Tracker ID',
                        font: { size: 14 }
                      },
                      zeroline: false
                    },
                    margin: { t: 30, b: 80, l: 80, r: 50 },
                    showlegend: true,
                    legend: {
                      orientation: 'h',
                      y: -0.2
                    }
                  }}
                  className="w-full h-[600px]"
                  config={{ responsive: true }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-[#151F32] p-8 rounded-xl text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Data Available</h3>
              <p className="text-gray-400">Upload a CSV file to view analytics</p>
            </div>
          )}
>>>>>>> Stashed changes
        </div>
      </main>
    </div>
  );
}

export default Analytics;