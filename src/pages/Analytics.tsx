import React from 'react';
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
      <Header 
        title="Analytics" 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        isSidebarOpen={sidebarOpen} 
      />

      {/* Sidebar */}
      <Sidebar 
        activePath="/analytics" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

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
        </div>
      </main>
    </div>
  );
}

export default Analytics;