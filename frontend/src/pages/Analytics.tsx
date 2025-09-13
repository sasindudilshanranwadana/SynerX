import React from 'react';
import { Activity, Download, RefreshCw } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ServerStatusIndicator from '../components/ServerStatusIndicator';
import { format, parseISO } from 'date-fns';
import { generatePDFReport } from '../lib/api';
import { TrackingResult } from '../lib/types';
import { getStoredTheme } from '../lib/theme';

const RUNPOD_API_BASE = import.meta.env.VITE_RUNPOD_URL || 'http://localhost:8000';

interface AnalysisData {
  weather_analysis: {
    weather_compliance: { [key: string]: { mean: number; count: number } };
    weather_reaction_time: { [key: string]: { mean: number; count: number } };
  };
  basic_correlations: {
    vehicle_type_compliance: { [key: string]: { mean: number; count: number } };
    hour_compliance: { [key: string]: { mean: number; count: number } };
  };
  recommendations: Array<{
    category: string;
    type: string;
    message: string;
    suggestion: string;
  }>;
}

function Analytics() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => getStoredTheme() === 'dark');
  const [data, setData] = React.useState<TrackingResult[]>([]);
  const [analysisData, setAnalysisData] = React.useState<AnalysisData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedJobId, setSelectedJobId] = React.useState<string>('');
  const [availableJobs, setAvailableJobs] = React.useState<Array<{id: string, filename: string}>>([]);
  
  // Filter states
  const [weatherFilter, setWeatherFilter] = React.useState('');
  const [vehicleFilter, setVehicleFilter] = React.useState('');
  const [complianceFilter, setComplianceFilter] = React.useState('');

  // Stats
  const [stats, setStats] = React.useState({
    totalVehicles: 0,
    overallCompliance: 0,
    avgReactionTime: 0,
    weatherConditions: 0
  });

  React.useEffect(() => {
    loadAvailableJobs();
    
    const handleThemeChange = () => {
      setIsDark(getStoredTheme() === 'dark');
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, []);

  const loadAvailableJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${RUNPOD_API_BASE}/jobs/completed`);
      const jobsData = await response.json();
      
      if (jobsData.status === 'success') {
        setAvailableJobs(jobsData.jobs.map((job: any) => ({
          id: job.job_id,
          filename: job.file_name
        })));
      }
    } catch (err: any) {
      // Silently handle error - don't show error message to user
    } finally {
      setLoading(false);
    }
  };

  const loadJobAnalytics = async (jobId: string) => {
    if (!jobId) return;
    
    try {
      setLoading(true);
      
      // Load analytics data
      const analyticsResponse = await fetch(`${RUNPOD_API_BASE}/jobs/${jobId}/analytics`);
      const analyticsData = await analyticsResponse.json();
      
      // Load correlation analysis
      const correlationResponse = await fetch(`${RUNPOD_API_BASE}/correlation-analysis/`);
      const correlationData = await correlationResponse.json();
      
      if (analyticsData.status === 'success') {
        setData(analyticsData.tracking_results || []);
        
        if (correlationData.status === 'success') {
          setAnalysisData(correlationData.analysis);
          updateStats(correlationData.data_points, analyticsData.tracking_results || []);
        }
        
        setError(null);
      } else {
        setError('No analytics data available for this job');
        setData([]);
        setAnalysisData(null);
      }
    } catch (err: any) {
      setError('Unable to load analytics data. Please try again.');
      setData([]);
      setAnalysisData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleJobSelection = (jobId: string) => {
    setSelectedJobId(jobId);
    if (jobId) {
      loadJobAnalytics(jobId);
    }
  };

  const updateStats = (dataPoints: number, trackingData: TrackingResult[]) => {
    const totalVehicles = trackingData.length;
    const compliantVehicles = trackingData.filter(d => d.compliance === 1).length;
    const overallCompliance = totalVehicles > 0 ? (compliantVehicles / totalVehicles) * 100 : 0;
    
    const validReactionTimes = trackingData
      .filter(d => d.compliance === 1 && d.reaction_time !== null && d.reaction_time !== undefined)
      .map(d => d.reaction_time as number);
    const avgReactionTime = validReactionTimes.length > 0
      ? validReactionTimes.reduce((sum, time) => sum + time, 0) / validReactionTimes.length
      : 0;
    
    const weatherConditions = new Set(trackingData.map(d => d.weather_condition).filter(Boolean)).size;

    setStats({
      totalVehicles,
      overallCompliance,
      avgReactionTime,
      weatherConditions
    });
  };

  const applyFilters = async () => {
    if (!selectedJobId) return;
    
    try {
      let url = `${RUNPOD_API_BASE}/tracking-data/filter/?limit=50`;
      
      if (weatherFilter) url += `&weather_condition=${weatherFilter}`;
      if (vehicleFilter) url += `&vehicle_type=${vehicleFilter}`;
      if (complianceFilter !== '') url += `&compliance=${complianceFilter}`;

      const response = await fetch(url);
      const filterData = await response.json();

      if (filterData.status === 'success') {
        setData(filterData.data);
      }
    } catch (err: any) {
      setError('Unable to apply filters. Please try again.');
    }
  };

  const createChart = (canvasId: string, config: any) => {
    React.useEffect(() => {
      if (!analysisData || !data.length) return;
      
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear previous chart
      if ((canvas as any).chart) {
        (canvas as any).chart.destroy();
      }
      
      // Create new chart
      import('chart.js/auto').then((Chart) => {
        (canvas as any).chart = new Chart.default(ctx, config);
      });
    }, [analysisData, data, canvasId]);
  };

  const getInsightIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      weather: '🌤️',
      vehicle_type: '🚛',
      time: '⏰',
    };
    return icons[category] || '💡';
  };

  return (
    <div className={`min-h-screen ${
      isDark ? 'bg-[#0B1121] text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <ServerStatusIndicator />

      <Header 
        title="Analytics" 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        isSidebarOpen={sidebarOpen} 
      />

      <Sidebar 
        activePath="/analytics" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">Road Safety Analytics Dashboard</h1>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Select a completed job to analyze traffic patterns and generate reports
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <div className={`p-6 rounded-xl text-center ${
              isDark 
                ? 'bg-[#151F32]' 
                : 'bg-white shadow-lg border border-gray-200'
            }`}>
              <div className="text-3xl font-bold text-primary-500 mb-2">{stats.totalVehicles}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Vehicles</div>
            </div>
            <div className={`p-6 rounded-xl text-center ${
              isDark 
                ? 'bg-[#151F32]' 
                : 'bg-white shadow-lg border border-gray-200'
            }`}>
              <div className="text-3xl font-bold text-green-500 mb-2">{stats.overallCompliance.toFixed(1)}%</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Overall Compliance</div>
            </div>
            <div className={`p-6 rounded-xl text-center ${
              isDark 
                ? 'bg-[#151F32]' 
                : 'bg-white shadow-lg border border-gray-200'
            }`}>
              <div className="text-3xl font-bold text-blue-500 mb-2">{stats.avgReactionTime.toFixed(1)}s</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg Reaction Time</div>
            </div>
            <div className={`p-6 rounded-xl text-center ${
              isDark 
                ? 'bg-[#151F32]' 
                : 'bg-white shadow-lg border border-gray-200'
            }`}>
              <div className="text-3xl font-bold text-purple-500 mb-2">{stats.weatherConditions}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Weather Conditions</div>
            </div>
          </div>

          {/* Job Selection */}
          <div className={`p-8 rounded-xl mb-8 ${
            isDark 
              ? 'bg-[#151F32]' 
              : 'bg-white shadow-lg border border-gray-200'
          }`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Job Analytics</h2>
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  {selectedJobId 
                    ? `Analyzing job: ${selectedJobId}` 
                    : 'Select a completed job to view analytics'
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <select
                value={selectedJobId}
                onChange={(e) => handleJobSelection(e.target.value)}
                className={`px-4 py-2 rounded-lg border ${
                  isDark 
                    ? 'bg-[#1E293B] border-[#334155] text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:border-primary-400`}
                disabled={loading}
              >
                <option value="">Select a job...</option>
                {availableJobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.filename} ({job.id})
                  </option>
                ))}
              </select>

              <button
                onClick={loadAvailableJobs}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                disabled={loading}
              >
                <RefreshCw className="w-5 h-5" />
                {loading ? 'Loading...' : 'Refresh Jobs'}
              </button>

              {data.length > 0 && (
                <button
                  onClick={() => {
                    const metrics = {
                      totalVehicles: stats.totalVehicles,
                      complianceRate: stats.overallCompliance,
                      avgReactionTime: stats.avgReactionTime,
                      violations: stats.totalVehicles - Math.round(stats.totalVehicles * stats.overallCompliance / 100),
                      peakViolationHour: 'N/A',
                      vehicleTypeStats: []
                    };
                    const report = generatePDFReport(data, metrics);
                    report.save('traffic-analysis-report.pdf');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                  disabled={loading}
                >
                  <Download className="w-5 h-5" />
                  Download Report
                </button>
              )}
            </div>

            {error && (
              <div className={`mt-4 p-4 rounded-lg ${
                isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
              }`}>
                {error}
              </div>
            )}
          </div>

          {loading ? (
            <div className={`p-8 rounded-xl text-center ${
              isDark 
                ? 'bg-[#151F32]' 
                : 'bg-white shadow-lg border border-gray-200'
            }`}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold mb-2">Loading Data</h3>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading job analytics...</p>
            </div>
          ) : data.length > 0 && analysisData ? (
            <div className="space-y-8">
              {/* Filters Section */}
              <div className={`p-6 rounded-xl ${
                isDark 
                  ? 'bg-[#151F32]' 
                  : 'bg-white shadow-lg border border-gray-200'
              }`}>
                <h2 className="text-lg font-semibold mb-4">🔍 Data Filters</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Weather Condition:
                    </label>
                    <select
                      value={weatherFilter}
                      onChange={(e) => setWeatherFilter(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark 
                          ? 'bg-[#1E293B] border-[#334155] text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">All Weather</option>
                      <option value="clear">Clear</option>
                      <option value="cloudy">Cloudy</option>
                      <option value="foggy">Foggy</option>
                      <option value="rainy">Rainy</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Vehicle Type:
                    </label>
                    <select
                      value={vehicleFilter}
                      onChange={(e) => setVehicleFilter(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark 
                          ? 'bg-[#1E293B] border-[#334155] text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">All Vehicles</option>
                      <option value="car">Car</option>
                      <option value="truck">Truck</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Compliance:
                    </label>
                    <select
                      value={complianceFilter}
                      onChange={(e) => setComplianceFilter(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark 
                          ? 'bg-[#1E293B] border-[#334155] text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">All</option>
                      <option value="1">Compliant</option>
                      <option value="0">Non-Compliant</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={applyFilters}
                      className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Weather Analysis Section */}
              <div className={`p-6 rounded-xl ${
                isDark 
                  ? 'bg-[#151F32]' 
                  : 'bg-white shadow-lg border border-gray-200'
              }`}>
                <h2 className="text-lg font-semibold mb-6">🌤️ Weather Impact Analysis</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-md font-medium mb-4">Weather Compliance Rates</h3>
                    <div className="h-64">
                      <canvas id="weatherComplianceChart"></canvas>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-md font-medium mb-4">Weather Reaction Times</h3>
                    <div className="h-64">
                      <canvas id="weatherReactionChart"></canvas>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Analysis Section */}
              <div className={`p-6 rounded-xl ${
                isDark 
                  ? 'bg-[#151F32]' 
                  : 'bg-white shadow-lg border border-gray-200'
              }`}>
                <h2 className="text-lg font-semibold mb-6">🚛 Vehicle Type Analysis</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-md font-medium mb-4">Vehicle Compliance Comparison</h3>
                    <div className="h-64">
                      <canvas id="vehicleChart"></canvas>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-md font-medium mb-4">Vehicle Distribution</h3>
                    <div className="h-64">
                      <canvas id="vehicleDistributionChart"></canvas>
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Analysis Section */}
              <div className={`p-6 rounded-xl ${
                isDark 
                  ? 'bg-[#151F32]' 
                  : 'bg-white shadow-lg border border-gray-200'
              }`}>
                <h2 className="text-lg font-semibold mb-6">⏰ Time-based Analysis</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-md font-medium mb-4">Hourly Compliance Rates</h3>
                    <div className="h-64">
                      <canvas id="hourlyChart"></canvas>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-md font-medium mb-4">Traffic Volume by Hour</h3>
                    <div className="h-64">
                      <canvas id="trafficVolumeChart"></canvas>
                    </div>
                  </div>
                </div>
              </div>

              {/* Heatmap Section */}
              <div className={`p-6 rounded-xl ${
                isDark 
                  ? 'bg-[#151F32]' 
                  : 'bg-white shadow-lg border border-gray-200'
              }`}>
                <h2 className="text-lg font-semibold mb-6">🔥 Correlation Heatmap</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-md font-medium mb-4">Weather vs Vehicle Type Heatmap</h3>
                    <div id="weatherVehicleHeatmap" className="min-h-[200px] border rounded-lg p-4"></div>
                  </div>
                  <div>
                    <h3 className="text-md font-medium mb-4">Time vs Weather Heatmap</h3>
                    <div id="timeWeatherHeatmap" className="min-h-[200px] border rounded-lg p-4"></div>
                  </div>
                </div>
              </div>

              {/* Insights Section */}
              {analysisData.recommendations && (
                <div className={`p-6 rounded-xl ${
                  isDark 
                    ? 'bg-[#151F32]' 
                    : 'bg-white shadow-lg border border-gray-200'
                }`}>
                  <h2 className="text-lg font-semibold mb-6">💡 Actionable Insights</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysisData.recommendations.map((rec, index) => (
                      <div key={index} className={`p-4 rounded-lg border-l-4 ${
                        rec.type === 'warning' ? 'border-yellow-500 bg-yellow-500/10' :
                        rec.type === 'critical' ? 'border-red-500 bg-red-500/10' :
                        'border-blue-500 bg-blue-500/10'
                      }`}>
                        <div className="font-semibold mb-2">
                          {getInsightIcon(rec.category)} {rec.category.toUpperCase()}
                        </div>
                        <div className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {rec.message}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          💡 {rec.suggestion}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Data Table */}
              <div className={`p-6 rounded-xl ${
                isDark 
                  ? 'bg-[#151F32]' 
                  : 'bg-white shadow-lg border border-gray-200'
              }`}>
                <h2 className="text-lg font-semibold mb-6">📊 Raw Data</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>ID</th>
                        <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Vehicle Type</th>
                        <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</th>
                        <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Compliance</th>
                        <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Reaction Time</th>
                        <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Weather</th>
                        <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Temperature</th>
                        <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.slice(0, 50).map((item, index) => (
                        <tr key={index} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.tracker_id}</td>
                          <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.vehicle_type}</td>
                          <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.status}</td>
                          <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {item.compliance === 1 ? '✅' : '❌'}
                          </td>
                          <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {item.reaction_time || '-'}
                          </td>
                          <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {item.weather_condition || '-'}
                          </td>
                          <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {item.temperature ? `${item.temperature}°C` : '-'}
                          </td>
                          <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {item.date ? format(parseISO(item.date), 'MMM dd, yyyy HH:mm') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className={`p-8 rounded-xl text-center ${
              isDark 
                ? 'bg-[#151F32]' 
                : 'bg-white shadow-lg border border-gray-200'
            }`}>
              <Activity className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              <h3 className="text-xl font-semibold mb-2">No Data Available</h3>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Select a completed job to view analytics</p>
            </div>
          )}
        </div>
      </main>

      {/* Chart.js Integration */}
      {data.length > 0 && analysisData && (
        <ChartRenderer analysisData={analysisData} isDark={isDark} />
      )}
    </div>
  );
}

// Chart Renderer Component
function ChartRenderer({ analysisData, isDark }: { analysisData: AnalysisData; isDark: boolean }) {
  React.useEffect(() => {
    const loadCharts = async () => {
      const Chart = (await import('chart.js/auto')).default;
      
      // Weather Compliance Chart
      const weatherComplianceCtx = document.getElementById('weatherComplianceChart') as HTMLCanvasElement;
      if (weatherComplianceCtx) {
        const existingChart = Chart.getChart(weatherComplianceCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(weatherComplianceCtx, {
          type: 'bar',
          data: {
            labels: Object.keys(analysisData.weather_analysis.weather_compliance),
            datasets: [{
              label: 'Compliance Rate (%)',
              data: Object.values(analysisData.weather_analysis.weather_compliance).map(item => item.mean * 100),
              backgroundColor: ['#4CAF50', '#FF9800', '#9C27B0', '#2196F3'],
              borderColor: ['#388E3C', '#F57C00', '#7B1FA2', '#1976D2'],
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  callback: function(value) { return value + '%'; },
                  color: isDark ? '#9CA3AF' : '#6B7280'
                },
                grid: { color: isDark ? '#374151' : '#E5E7EB' }
              },
              x: {
                ticks: { color: isDark ? '#9CA3AF' : '#6B7280' },
                grid: { color: isDark ? '#374151' : '#E5E7EB' }
              }
            },
          },
        });
      }

      // Weather Reaction Time Chart
      const weatherReactionCtx = document.getElementById('weatherReactionChart') as HTMLCanvasElement;
      if (weatherReactionCtx) {
        const existingChart = Chart.getChart(weatherReactionCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(weatherReactionCtx, {
          type: 'line',
          data: {
            labels: Object.keys(analysisData.weather_analysis.weather_reaction_time),
            datasets: [{
              label: 'Average Reaction Time (seconds)',
              data: Object.values(analysisData.weather_analysis.weather_reaction_time).map(item => item.mean),
              borderColor: '#FF5722',
              backgroundColor: 'rgba(255, 87, 34, 0.1)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: 'Seconds', color: isDark ? '#9CA3AF' : '#6B7280' },
                ticks: { color: isDark ? '#9CA3AF' : '#6B7280' },
                grid: { color: isDark ? '#374151' : '#E5E7EB' }
              },
              x: {
                ticks: { color: isDark ? '#9CA3AF' : '#6B7280' },
                grid: { color: isDark ? '#374151' : '#E5E7EB' }
              }
            },
          },
        });
      }

      // Vehicle Compliance Chart
      const vehicleCtx = document.getElementById('vehicleChart') as HTMLCanvasElement;
      if (vehicleCtx) {
        const existingChart = Chart.getChart(vehicleCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(vehicleCtx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(analysisData.basic_correlations.vehicle_type_compliance).map(type => 
              `${type.charAt(0).toUpperCase() + type.slice(1)} (${(analysisData.basic_correlations.vehicle_type_compliance[type].mean * 100).toFixed(1)}%)`
            ),
            datasets: [{
              data: Object.values(analysisData.basic_correlations.vehicle_type_compliance).map(item => item.mean * 100),
              backgroundColor: ['#4CAF50', '#F44336'],
              borderWidth: 2,
              borderColor: isDark ? '#1F2937' : '#fff',
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { 
                position: 'bottom',
                labels: { color: isDark ? '#9CA3AF' : '#6B7280' }
              },
            },
          },
        });
      }

      // Vehicle Distribution Chart
      const distributionCtx = document.getElementById('vehicleDistributionChart') as HTMLCanvasElement;
      if (distributionCtx) {
        const existingChart = Chart.getChart(distributionCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(distributionCtx, {
          type: 'pie',
          data: {
            labels: Object.keys(analysisData.basic_correlations.vehicle_type_compliance),
            datasets: [{
              data: Object.values(analysisData.basic_correlations.vehicle_type_compliance).map(item => item.count),
              backgroundColor: ['#2196F3', '#FF9800'],
              borderWidth: 2,
              borderColor: isDark ? '#1F2937' : '#fff',
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { 
                position: 'bottom',
                labels: { color: isDark ? '#9CA3AF' : '#6B7280' }
              },
            },
          },
        });
      }

      // Hourly Compliance Chart
      const hourlyCtx = document.getElementById('hourlyChart') as HTMLCanvasElement;
      if (hourlyCtx) {
        const existingChart = Chart.getChart(hourlyCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(hourlyCtx, {
          type: 'bar',
          data: {
            labels: Object.keys(analysisData.basic_correlations.hour_compliance),
            datasets: [{
              label: 'Compliance Rate (%)',
              data: Object.values(analysisData.basic_correlations.hour_compliance).map(item => item.mean * 100),
              backgroundColor: 'rgba(52, 152, 219, 0.8)',
              borderColor: '#3498db',
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  callback: function(value) { return value + '%'; },
                  color: isDark ? '#9CA3AF' : '#6B7280'
                },
                grid: { color: isDark ? '#374151' : '#E5E7EB' }
              },
              x: {
                title: { display: true, text: 'Hour of Day', color: isDark ? '#9CA3AF' : '#6B7280' },
                ticks: { color: isDark ? '#9CA3AF' : '#6B7280' },
                grid: { color: isDark ? '#374151' : '#E5E7EB' }
              }
            },
          },
        });
      }

      // Traffic Volume Chart
      const volumeCtx = document.getElementById('trafficVolumeChart') as HTMLCanvasElement;
      if (volumeCtx) {
        const existingChart = Chart.getChart(volumeCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(volumeCtx, {
          type: 'line',
          data: {
            labels: Object.keys(analysisData.basic_correlations.hour_compliance),
            datasets: [{
              label: 'Traffic Volume',
              data: Object.values(analysisData.basic_correlations.hour_compliance).map(item => item.count),
              borderColor: '#27AE60',
              backgroundColor: 'rgba(39, 174, 96, 0.1)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: 'Number of Vehicles', color: isDark ? '#9CA3AF' : '#6B7280' },
                ticks: { color: isDark ? '#9CA3AF' : '#6B7280' },
                grid: { color: isDark ? '#374151' : '#E5E7EB' }
              },
              x: {
                title: { display: true, text: 'Hour of Day', color: isDark ? '#9CA3AF' : '#6B7280' },
                ticks: { color: isDark ? '#9CA3AF' : '#6B7280' },
                grid: { color: isDark ? '#374151' : '#E5E7EB' }
              }
            },
          },
        });
      }
    };

    loadCharts();
  }, [analysisData, isDark]);

  // Create heatmaps
  React.useEffect(() => {
    // Weather vs Vehicle Type Heatmap
    const weatherVehicleContainer = document.getElementById('weatherVehicleHeatmap');
    if (weatherVehicleContainer && analysisData) {
      weatherVehicleContainer.innerHTML = '';
      
      const weatherTypes = Object.keys(analysisData.weather_analysis.weather_compliance);
      const vehicleTypes = Object.keys(analysisData.basic_correlations.vehicle_type_compliance);

      // Create heatmap grid
      const grid = document.createElement('div');
      grid.className = 'grid gap-1';
      grid.style.gridTemplateColumns = `repeat(${weatherTypes.length + 1}, 1fr)`;

      // Header row
      grid.appendChild(document.createElement('div')); // Empty corner
      weatherTypes.forEach(weather => {
        const cell = document.createElement('div');
        cell.className = `text-xs font-medium p-2 text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`;
        cell.textContent = weather;
        grid.appendChild(cell);
      });

      // Data rows
      vehicleTypes.forEach(vehicle => {
        // Row label
        const label = document.createElement('div');
        label.className = `text-xs font-medium p-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`;
        label.textContent = vehicle;
        grid.appendChild(label);

        // Data cells
        weatherTypes.forEach(weather => {
          const weatherCompliance = analysisData.weather_analysis.weather_compliance[weather].mean;
          const vehicleCompliance = analysisData.basic_correlations.vehicle_type_compliance[vehicle].mean;
          const correlation = (weatherCompliance + vehicleCompliance) / 2;

          const cell = document.createElement('div');
          cell.className = 'text-xs p-2 text-center text-white rounded';
          cell.style.backgroundColor = `rgba(52, 152, 219, ${correlation})`;
          cell.textContent = `${(correlation * 100).toFixed(0)}%`;
          cell.title = `Weather: ${weather}, Vehicle: ${vehicle}, Correlation: ${(correlation * 100).toFixed(1)}%`;
          grid.appendChild(cell);
        });
      });

      weatherVehicleContainer.appendChild(grid);
    }

    // Time vs Weather Heatmap
    const timeWeatherContainer = document.getElementById('timeWeatherHeatmap');
    if (timeWeatherContainer && analysisData) {
      timeWeatherContainer.innerHTML = '';
      
      const hours = Object.keys(analysisData.basic_correlations.hour_compliance);
      const weatherTypes = Object.keys(analysisData.weather_analysis.weather_compliance);

      // Create heatmap grid
      const grid = document.createElement('div');
      grid.className = 'grid gap-1';
      grid.style.gridTemplateColumns = `repeat(${hours.length + 1}, 1fr)`;

      // Header row
      grid.appendChild(document.createElement('div')); // Empty corner
      hours.forEach(hour => {
        const cell = document.createElement('div');
        cell.className = `text-xs font-medium p-2 text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`;
        cell.textContent = `${hour}:00`;
        grid.appendChild(cell);
      });

      // Data rows
      weatherTypes.forEach(weather => {
        // Row label
        const label = document.createElement('div');
        label.className = `text-xs font-medium p-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`;
        label.textContent = weather;
        grid.appendChild(label);

        // Data cells
        hours.forEach(hour => {
          const hourCompliance = analysisData.basic_correlations.hour_compliance[hour].mean;
          const weatherCompliance = analysisData.weather_analysis.weather_compliance[weather].mean;
          const correlation = (hourCompliance + weatherCompliance) / 2;

          const cell = document.createElement('div');
          cell.className = 'text-xs p-2 text-center text-white rounded';
          cell.style.backgroundColor = `rgba(231, 76, 60, ${correlation})`;
          cell.textContent = `${(correlation * 100).toFixed(0)}%`;
          cell.title = `Hour: ${hour}:00, Weather: ${weather}, Correlation: ${(correlation * 100).toFixed(1)}%`;
          grid.appendChild(cell);
        });
      });

      timeWeatherContainer.appendChild(grid);
    }
  }, [analysisData, isDark]);

  return null;
}

export default Analytics;