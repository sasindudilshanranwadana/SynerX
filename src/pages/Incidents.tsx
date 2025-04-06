import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, MapPin, Clock, Filter, Search } from 'lucide-react';

interface Incident {
  id: string;
  type: 'speed' | 'signal' | 'crossing';
  location: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
  details: string;
  status: 'pending' | 'investigating' | 'resolved';
}

const Incidents: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);

  // Sample data - replace with actual data from your backend
  const incidents: Incident[] = [
    {
      id: '1',
      type: 'speed',
      location: 'Crossing A-12',
      timestamp: new Date('2024-03-15T08:30:00'),
      severity: 'high',
      details: 'Vehicle exceeded speed limit by 30km/h',
      status: 'investigating'
    },
    {
      id: '2',
      type: 'signal',
      location: 'Crossing B-15',
      timestamp: new Date('2024-03-15T09:45:00'),
      severity: 'medium',
      details: 'Signal violation during peak hours',
      status: 'pending'
    }
  ];

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = incident.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !selectedType || incident.type === selectedType;
    const matchesSeverity = !selectedSeverity || incident.severity === selectedSeverity;
    return matchesSearch && matchesType && matchesSeverity;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-green-500';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Incident Reports</h1>
        <p className="text-gray-400">
          Monitor and manage safety violations at level crossings
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div>
          <label className="flex items-center gap-2 text-gray-400 mb-2">
            <Search className="w-4 h-4" />
            Search
          </label>
          <input
            type="text"
            placeholder="Search incidents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-gray-400 mb-2">
            <Filter className="w-4 h-4" />
            Type
          </label>
          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="">All Types</option>
            <option value="speed">Speed Violation</option>
            <option value="signal">Signal Violation</option>
            <option value="crossing">Crossing Violation</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 text-gray-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            Severity
          </label>
          <select
            value={selectedSeverity || ''}
            onChange={(e) => setSelectedSeverity(e.target.value || null)}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {filteredIncidents.map((incident) => (
          <motion.div
            key={incident.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 rounded-lg p-6 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {incident.type.charAt(0).toUpperCase() + incident.type.slice(1)} Violation
                </h3>
                <div className="flex items-center gap-4 text-gray-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{incident.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{incident.timestamp.toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{incident.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full ${getSeverityColor(incident.severity)} bg-opacity-20`}>
                {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)} Severity
              </div>
            </div>
            <p className="text-gray-300 mb-4">{incident.details}</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">
                Status: <span className="text-cyan-500">{incident.status}</span>
              </span>
              <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white transition-colors">
                View Details
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Incidents;