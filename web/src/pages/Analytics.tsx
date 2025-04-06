import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import {
  Calendar,
  MapPin,
  Clock,
  TrendingUp,
  AlertTriangle,
  Car,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

// Sample data - replace with actual data from your backend
const trafficData = [
  { time: '00:00', vehicles: 120, speed: 45, violations: 2 },
  { time: '04:00', vehicles: 80, speed: 48, violations: 1 },
  { time: '08:00', vehicles: 280, speed: 35, violations: 5 },
  { time: '12:00', vehicles: 340, speed: 32, violations: 8 },
  { time: '16:00', vehicles: 380, speed: 30, violations: 7 },
  { time: '20:00', vehicles: 220, speed: 42, violations: 3 }
];

const locations = [
  'Crossing A-12',
  'Crossing B-15',
  'Crossing C-08',
  'Crossing D-23'
];

const timeRanges = [
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '3 Months', value: '3m' }
];

const Analytics: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState(locations[0]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  const stats = [
    {
      label: 'Total Vehicles',
      value: '1,420',
      change: '+12%',
      icon: Car,
      color: 'cyan'
    },
    {
      label: 'Avg. Speed',
      value: '38 km/h',
      change: '-5%',
      icon: TrendingUp,
      color: 'green'
    },
    {
      label: 'Violations',
      value: '26',
      change: '+8%',
      icon: AlertTriangle,
      color: 'yellow'
    }
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
        <p className="text-gray-400">
          Comprehensive analysis of traffic patterns and behavior
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-8">
        <div className="flex-1">
          <label className="flex items-center gap-2 text-gray-400 mb-2">
            <MapPin className="w-4 h-4" />
            Location
          </label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="flex items-center gap-2 text-gray-400 mb-2">
            <Clock className="w-4 h-4" />
            Time Range
          </label>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setSelectedTimeRange(range.value)}
                className={`flex-1 px-4 py-2 text-sm transition-colors ${
                  selectedTimeRange === range.value
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#0F172A] p-6 rounded-xl border border-gray-800 hover:border-cyan-500/50 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <stat.icon className={`w-8 h-8 text-${stat.color}-500`} />
              <span className="text-xs text-gray-400 flex items-center">
                {stat.change} <ArrowUpRight className="w-3 h-3 ml-1" />
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Vehicle Count Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0F172A] p-6 rounded-xl border border-gray-800"
        >
          <h2 className="text-xl font-semibold text-white mb-6">Vehicle Count</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="vehicles"
                  stroke="#06b6d4"
                  fillOpacity={1}
                  fill="url(#colorVehicles)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Speed Distribution Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0F172A] p-6 rounded-xl border border-gray-800"
        >
          <h2 className="text-xl font-semibold text-white mb-6">Speed Distribution</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="speed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#0F172A] p-6 rounded-xl border border-gray-800"
      >
        <h2 className="text-xl font-semibold text-white mb-6">Traffic Density Heatmap</h2>
        <div className="relative h-[400px] rounded-lg overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80)',
              filter: 'brightness(0.3)'
            }}
          />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(circle at 30% 50%, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0.1) 30%, transparent 70%)',
            mixBlendMode: 'screen'
          }} />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(circle at 70% 40%, rgba(6, 182, 212, 0.4) 0%, rgba(6, 182, 212, 0.1) 40%, transparent 70%)',
            mixBlendMode: 'screen'
          }} />
        </div>
        <div className="mt-4 flex justify-between items-center text-gray-400">
          <span>Low Density</span>
          <div className="h-2 w-32 bg-gradient-to-r from-cyan-500/20 to-cyan-500"></div>
          <span>High Density</span>
        </div>
      </motion.div>
    </div>
  );
};

export default Analytics;