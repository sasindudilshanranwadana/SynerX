import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';

function Auth() {
  const navigate = useNavigate();
  const [darkMode] = React.useState(true);

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
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

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 p-4 relative">
        {/* Left Column - Illustration */}
        <div className="hidden md:flex flex-col items-center justify-center p-8 relative overflow-hidden bg-[#151F32]/50 rounded-2xl border border-[#1E293B]">
          <div className="absolute inset-0 neural-grid opacity-20"></div>
          <img
            src="https://github.com/sasindudilshanranwadana/SynerX/blob/web/public/m6-motorway-trim-result.gif?raw=true"
            alt="AI Traffic Analysis"
            className="rounded-xl shadow-2xl relative z-10 animate-float object-cover h-[400px] w-full"
          />
          <div className="mt-8 text-center relative z-10 text-gray-300">
            <h2 className="text-2xl font-bold mb-4">Project 49</h2>
            <p className="text-gray-400">Road-User Behaviour Analysis Using AI & Computer Vision</p>
          </div>
        </div>

        {/* Right Column - Auth Form */}
        <div className="bg-[#151F32]/50 p-8 rounded-2xl border border-[#1E293B] backdrop-blur-sm">
          <div className="flex justify-between items-center mb-8">
            <Link to="/" className="flex items-center text-gray-300 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-6 text-white">Welcome</h1>

          <SupabaseAuth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              style: {
                button: {
                  background: '#06B6D4',
                  color: 'white',
                  borderRadius: '0.5rem',
                  height: '2.75rem',
                  '&:hover': {
                    background: '#0891B2'
                  }
                },
                input: {
                  background: '#1E293B',
                  borderColor: '#334155',
                  color: 'white',
                  borderRadius: '0.5rem',
                  height: '2.75rem',
                  '&:focus': {
                    borderColor: '#06B6D4',
                    boxShadow: '0 0 0 2px rgba(6, 182, 212, 0.2)'
                  },
                  '&::placeholder': {
                    color: '#64748B'
                  }
                },
                label: {
                  color: '#94A3B8',
                  marginBottom: '0.5rem'
                },
                message: {
                  color: '#94A3B8'
                },
                anchor: {
                  color: '#06B6D4',
                  '&:hover': {
                    color: '#0891B2'
                  }
                }
              }
            }}
            providers={[]}
            redirectTo={`${window.location.origin}/dashboard`}
          />
        </div>
      </div>
    </div>
  );
}

export default Auth;