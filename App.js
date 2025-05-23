import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import './styles.css';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c', '#d0ed57', '#8dd1e1', '#FFBB28', '#FF8042'];

const App = () => {
  const [reactionData, setReactionData] = useState([]);
  const [vehicleData, setVehicleData] = useState([]);
  const [statusData, setStatusData] = useState([]);

  useEffect(() => {
    // Load reaction data from tracking_results.csv
    fetch('/asset/tracking_results.csv')
      .then(resp => resp.text())
      .then(text => {
        const rows = text.trim().split('\n');
        const headers = rows[0].split(',');
        const records = rows.slice(1).map(r => {
          const vals = r.split(',');
          return headers.reduce((obj, key, i) => {
            obj[key] = vals[i];
            return obj;
          }, {});
        });

        const cleanReaction = records
          .filter(d => !isNaN(+d.reaction_time))
          .map(d => ({
            tracker_id: d.tracker_id,
            reaction_time: +d.reaction_time
          }));

        setReactionData(cleanReaction);
      });

    // Load vehicle and status data from tracking_results-test.csv
    fetch('/asset/tracking_results-test.csv')
      .then(resp => resp.text())
      .then(text => {
        const rows = text.trim().split('\n');
        const headers = rows[0].split(',');
        const records = rows.slice(1).map(r => {
          const vals = r.split(',');
          return headers.reduce((obj, key, i) => {
            obj[key] = vals[i];
            return obj;
          }, {});
        });

        const vehicleCount = {};
        const vehicleStatus = {};

        records.forEach(d => {
          vehicleCount[d.vehicle_type] = (vehicleCount[d.vehicle_type] || 0) + 1;
          const label = `${d.vehicle_type} - ${d.status}`;
          vehicleStatus[label] = (vehicleStatus[label] || 0) + 1;
        });

        setVehicleData(Object.entries(vehicleCount).map(([type, count]) => ({ type, count })));
        setStatusData(Object.entries(vehicleStatus).map(([label, count]) => ({ label, count })));
      });
  }, []);

  return (
    <div className="container">
      <h1>Chart Dashboard</h1>

      <div className="chart-container">
        <h2>Chart 1: Reaction Time per Tracker</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={reactionData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tracker_id" angle={-45} textAnchor="end" interval={0} />
            <YAxis label={{ value: 'Reaction Time (s)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="reaction_time" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h2>Chart 2: Donut Chart of Vehicle Types</h2>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={vehicleData}
              dataKey="count"
              nameKey="type"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={60}
              label
            >
              {vehicleData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h2>Chart 3: Vehicle Count by Type and Status</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={statusData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" label={{ value: 'Count', position: 'insideBottom', offset: -5 }} />
            <YAxis type="category" dataKey="label" width={180} />
            <Tooltip />
            <Bar dataKey="count">
              {statusData.map((entry, index) => (
                <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default App;
