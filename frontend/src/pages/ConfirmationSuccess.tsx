import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Home } from 'lucide-react';

function ConfirmationSuccess() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = React.useState(5);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1121] relative overflow-hidden">
      {/* Neural grid background */}
      <div className="absolute inset-0 neural-grid opacity-10"></div>
      
      {/* Animated circles */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

      <div className="bg-[#151F32]/50 p-12 rounded-2xl border border-[#1E293B] backdrop-blur-sm text-center max-w-md w-full mx-4 relative">
        <div className="mb-8">
          <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-400 animate-pulse" />
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-4">
            Email Confirmed Successfully!
          </h1>
          
          <p className="text-gray-300 mb-6 leading-relaxed">
            Thank you for confirming your email address. Your account has been successfully activated 
            and you can now access all features of Project 49.
          </p>
          
          <div className="bg-[#1E293B] rounded-lg p-4 mb-6">
            <p className="text-gray-400 text-sm mb-2">
              Redirecting to home page in:
            </p>
            <div className="text-2xl font-bold text-primary-400">
              {countdown} second{countdown !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Go to Home Page Now
        </button>
      </div>
    </div>
  );
}

export default ConfirmationSuccess;