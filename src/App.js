import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import './styles.css';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c', '#d0ed57', '#8dd1e1', '#FFBB28', '#FF8042'];

const App = () => {
  const [meanReactionData, setMeanReactionData] = useState([]);
  const [vehicleData, setVehicleData] = useState([]);
  const [stackedData, setStackedData] = useState([]);

  useEffect(() => {
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

        // Chart 1: Mean Reaction Time by Vehicle Type
        const grouped = {};
        records.forEach(d => {
          const type = d.vehicle_type;
          const rt = parseFloat(d.reaction_time);
          if (!isNaN(rt)) {
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(rt);
          }
        });

        const meanReaction = Object.entries(grouped).map(([type, vals]) => ({
          vehicle_type: type,
          mean_reaction_time: vals.reduce((a, b) => a + b, 0) / vals.length
        }));
        setMeanReactionData(meanReaction);

        // Chart 2: Count of Vehicle Types (Donut Chart)
        const vehicleCounts = {};
        records.forEach(d => {
          const type = d.vehicle_type;
          vehicleCounts[type] = (vehicleCounts[type] || 0) + 1;
        });
        const vehicleArray = Object.entries(vehicleCounts).map(([type, count]) => ({ type, count }));
        setVehicleData(vehicleArray);

        // Chart 3: Stacked Bar of Vehicle Type by Status
        const statusMap = {};
        records.forEach(d => {
          const type = d.vehicle_type;
          const status = d.status;
          if (!statusMap[type]) statusMap[type] = {};
          statusMap[type][status] = (statusMap[type][status] || 0) + 1;
        });

        const stackedArray = Object.entries(statusMap).map(([type, statuses]) => ({
          vehicle_type: type,
          ...statuses
        }));
        setStackedData(stackedArray);
      });
  }, []);

  const statusKeys = stackedData.length > 0 ? Object.keys(stackedData[0]).filter(k => k !== 'vehicle_type') : [];

  return (
    <div className="container">
      <h1>Tracking Results Dashboard</h1>

      <div className="chart-container">
        <h2>Chart 1: Mean Reaction Time by Vehicle Type</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={meanReactionData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="vehicle_type" />
            <YAxis label={{ value: 'Mean Reaction Time (s)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="mean_reaction_time" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h2>Chart 2: Vehicle Type Distribution (Donut)</h2>
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
        <h2>Chart 3: Vehicle Type vs Status (Stacked Bar)</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={stackedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="vehicle_type" />
            <YAxis />
            <Tooltip />
            <Legend />
            {statusKeys.map((key, index) => (
              <Bar key={key} dataKey={key} stackId="a" fill={COLORS[index % COLORS.length]} />
            ))}
          </BarChart>
        </>
      </div>
    </div>
  );
};

export default App;
