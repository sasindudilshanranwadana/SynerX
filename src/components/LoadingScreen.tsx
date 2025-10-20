import React from 'react';

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#0B1121] flex items-center justify-center z-50">
      <div className="relative">
        {/* Neural grid background */}
        <div className="absolute inset-0 neural-grid opacity-20"></div>
        
        {/* Animated circles */}
        <div className="relative">
          <div className="flex items-center justify-center">
            <div className="absolute animate-ping h-16 w-16 rounded-full bg-primary-400 opacity-20"></div>
            <div className="absolute h-16 w-16 rounded-full bg-primary-400 opacity-10 animate-pulse"></div>
            <div className="relative h-12 w-12 rounded-full bg-primary-400 animate-pulse flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-[#0B1121] flex items-center justify-center">
                <div className="h-4 w-4 rounded-full bg-primary-400 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading text */}
        <div className="mt-8 text-center">
          <p className="text-primary-400 text-lg font-medium animate-pulse">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;