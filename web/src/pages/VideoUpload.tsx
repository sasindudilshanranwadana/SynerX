import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle, AlertTriangle, Clock, FileVideo, Calendar, Filter } from 'lucide-react';

interface Video {
  id: string;
  filename: string;
  uploadDate: Date;
  status: 'processing' | 'completed' | 'failed';
  thumbnail?: string;
  violationType?: string;
}

const VideoUpload: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [violationFilter, setViolationFilter] = useState('');
  
  // Sample data - replace with actual data from your backend
  const [videos, setVideos] = useState<Video[]>([
    {
      id: '1',
      filename: 'intersection-footage-001.mp4',
      uploadDate: new Date('2024-03-10'),
      status: 'completed',
      violationType: 'speed'
    },
    {
      id: '2',
      filename: 'crossing-analysis-002.mp4',
      uploadDate: new Date('2024-03-11'),
      status: 'processing',
      violationType: 'signal'
    }
  ]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    // Filter for video files
    const videoFiles = files.filter(file => 
      file.type.startsWith('video/mp4') || file.type.startsWith('video/quicktime')
    );

    if (videoFiles.length === 0) {
      alert('Please upload MP4 or MOV files only');
      return;
    }

    // Simulate upload progress
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
          return null;
        }
        return prev + 10;
      });
    }, 300);

    // Add new videos to the list
    const newVideos = videoFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      filename: file.name,
      uploadDate: new Date(),
      status: 'processing' as const
    }));

    setVideos(prev => [...newVideos, ...prev]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
    }
  };

  const filteredVideos = videos.filter(video => {
    const dateMatch = dateFilter ? 
      video.uploadDate.toISOString().startsWith(dateFilter) : true;
    const violationMatch = violationFilter ? 
      video.violationType === violationFilter : true;
    return dateMatch && violationMatch;
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Video Upload</h1>
        <p className="text-gray-400">
          Upload traffic footage for AI analysis. Supported formats: MP4, MOV
        </p>
      </div>

      {/* Upload Area */}
      <motion.div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center mb-8 transition-colors
          ${isDragging ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-700 hover:border-gray-600'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={{ borderColor: isDragging ? '#06b6d4' : '#374151' }}
      >
        <input
          type="file"
          accept=".mp4,.mov"
          multiple
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileInput}
        />
        <Upload className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
        <p className="text-lg font-medium text-white mb-2">
          Drag and drop video files here
        </p>
        <p className="text-gray-400">
          or click to browse your files
        </p>
      </motion.div>

      {/* Upload Progress */}
      {uploadProgress !== null && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-cyan-500"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Uploading... {uploadProgress}%
          </p>
        </motion.div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            Upload completed successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="flex items-center gap-2 text-gray-400 mb-2">
            <Calendar className="w-4 h-4" />
            Date Filter
          </label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
          />
        </div>
        <div className="flex-1">
          <label className="flex items-center gap-2 text-gray-400 mb-2">
            <Filter className="w-4 h-4" />
            Violation Type
          </label>
          <select
            value={violationFilter}
            onChange={(e) => setViolationFilter(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="">All Types</option>
            <option value="speed">Speed Violation</option>
            <option value="signal">Signal Violation</option>
            <option value="crossing">Crossing Violation</option>
          </select>
        </div>
      </div>

      {/* Video List */}
      <div className="bg-gray-800/50 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 p-4 border-b border-gray-700 text-gray-400">
          <div>Type</div>
          <div>Filename</div>
          <div>Upload Date</div>
          <div>Status</div>
        </div>
        <AnimatePresence>
          {filteredVideos.map((video) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-[auto_1fr_auto_auto] gap-4 p-4 border-b border-gray-700 hover:bg-white/5 transition-colors items-center"
            >
              <FileVideo className="w-6 h-6 text-cyan-500" />
              <div>
                <p className="text-white">{video.filename}</p>
                {video.violationType && (
                  <p className="text-sm text-gray-400">
                    Type: {video.violationType}
                  </p>
                )}
              </div>
              <div className="text-gray-400">
                {video.uploadDate.toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(video.status)}
                <span className="text-gray-400 capitalize">
                  {video.status}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VideoUpload;