import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { AlertCircle, ArrowLeft, CircleUserRound } from 'lucide-react';

function Auth() {
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  
  const [formData, setFormData] = React.useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const auth = getAuth();
  const googleProvider = new GoogleAuthProvider();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${
      darkMode ? 'bg-neural-900 text-white' : 'bg-neural-100 text-gray-900'
    }`}>
      <div className={`w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 p-4 ${
        darkMode ? 'bg-neural-800/50' : 'bg-white'
      } rounded-2xl shadow-xl m-4`}>
        {/* Left Column - Illustration */}
        <div className="hidden md:flex flex-col items-center justify-center p-8 relative overflow-hidden">
          <div className="absolute inset-0 neural-grid opacity-20"></div>
          <img
            src="https://images.unsplash.com/photo-1617471346061-5d329ab9c574?auto=format&fit=crop&w=800&q=80"
            alt="AI Traffic Analysis"
            className="rounded-xl shadow-2xl relative z-10 animate-float"
          />
          <div className={`mt-8 text-center relative z-10 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <h2 className="text-2xl font-bold mb-4">Project 49</h2>
            <p>Road-User Behaviour Analysis Using AI & Computer Vision</p>
          </div>
        </div>

        {/* Right Column - Auth Form */}
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <Link to="/" className={`flex items-center ${
              darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}>
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-6">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>

          {error && (
            <div className={`mb-4 p-4 rounded-lg flex items-center ${
              darkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-600'
            }`}>
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode 
                      ? 'bg-neural-700 border-neural-600 text-white' 
                      : 'bg-white border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500`}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode 
                    ? 'bg-neural-700 border-neural-600 text-white' 
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-primary-500`}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode 
                    ? 'bg-neural-700 border-neural-600 text-white' 
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-primary-500`}
                required
              />
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode 
                      ? 'bg-neural-700 border-neural-600 text-white' 
                      : 'bg-white border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500`}
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                darkMode
                  ? 'bg-primary-500 hover:bg-primary-600 text-white'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${
                  darkMode ? 'border-neural-700' : 'border-gray-300'
                }`}></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-2 ${
                  darkMode ? 'bg-neural-800/50' : 'bg-white'
                }`}>Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center ${
                darkMode
                  ? 'bg-neural-700 hover:bg-neural-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              }`}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>

            <p className="text-center mt-6">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className={`ml-2 font-medium ${
                  darkMode ? 'text-primary-400' : 'text-primary-600'
                }`}
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Auth;