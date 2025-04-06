import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Video, AlertTriangle, CheckCircle } from 'lucide-react';

interface Camera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  thumbnail: string;
}

const Monitoring: React.FC = () => {
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);

  // Sample data - replace with actual data from your backend
  const cameras: Camera[] = [
    {
      id: '1',
      name: 'Camera A1',
      location: 'Crossing A-12 North',
      status: 'online',
      thumbnail: 'https://images.unsplash.com/photo-1494783367193-149034c05e8f?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: '2',
      name: 'Camera A2',
      location: 'Crossing A-12 South',
      status: 'online',
      thumbnail: 'https://images.unsplash.com/photo-1542219550-37153d387c27?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: '3',
      name: 'Camera B1',
      location: 'Crossing B-15 East',
      status: 'offline',
      thumbnail: 'https://images.unsplash.com/photo-1516466723877-e6ec3246450b?auto=format&fit=crop&w=800&q=80'
    }
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Live Monitoring</h1>
        <p className="text-gray-400">
          Real-time surveillance of level crossings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Video Feed */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg overflow-hidden aspect-video mb-6">
            {selectedCamera ? (
              <video
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                poster={cameras.find(c => c.id === selectedCamera)?.thumbnail}
              >
                <source src="/sample-video.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Video className="w-16 h-16 mx-auto mb-4" />
                  <p>Select a camera to view live feed</p>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          {selectedCamera && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="flex items-center justify-center gap-2 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                <Camera className="w-5 h-5" />
                <span>Snapshot</span>
              </button>
              <button className="flex items-center justify-center gap-2 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                <Video className="w-5 h-5" />
                <span>Record</span>
              </button>
              <button className="flex items-center justify-center gap-2 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                <AlertTriangle className="w-5 h-5" />
                <span>Alert</span>
              </button>
              <button className="flex items-center justify-center gap-2 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                <CheckCircle className="w-5 h-5" />
                <span>Status</span>
              </button>
            </div>
          )}
        </div>

        {/* Camera List */}
        <div className="space-y-4">
          {cameras.map((camera) => (
            <motion.button
              key={camera.id}
              onClick={() => setSelectedCamera(camera.id)}
              className={`w-full p-4 rounded-lg transition-all ${
                selectedCamera === camera.id
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={camera.thumbnail}
                    alt={camera.name}
                    className="w-20 h-20 rounded object-cover"
                  />
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                    camera.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold mb-1">{camera.name}</h3>
                  <p className={`text-sm ${
                    selectedCamera === camera.id ? 'text-white/80' : 'text-gray-400'
                  }`}>
                    {camera.location}
                  </p>
                  <p className={`text-sm ${
                    camera.status === 'online' 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {camera.status.charAt(0).toUpperCase() + camera.status.slice(1)}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Monitoring;