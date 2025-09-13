import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import ServerStatusIndicator from '../components/ServerStatusIndicator';

function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [notification, setNotification] = React.useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    confirmPassword: ''
  });

  const recaptchaRef = React.useRef<ReCAPTCHA>(null);

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        showNotification('success', 'Welcome! You have successfully signed in to your account.');
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    });

    // Check for email confirmation
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    
    if (accessToken && refreshToken) {
      navigate('/confirmation-success');
    }

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!captchaToken) {
      showNotification('error', 'Please complete the reCAPTCHA verification.');
      return;
    }

    if (isSignUp && formData.password !== formData.confirmPassword) {
      showNotification('error', 'Passwords do not match. Please ensure both password fields are identical.');
      return;
    }

    if (formData.password.length < 6) {
      showNotification('error', 'Password must be at least 6 characters long for security purposes.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/confirmation-success`
          }
        });

        if (error) throw error;

        showNotification('success', 
          'Account created successfully! We\'ve sent a confirmation email to your inbox. Please check your email and click the confirmation link to activate your account.'
        );
        
        // Reset form
        setFormData({ email: '', password: '', confirmPassword: '' });
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('The email or password you entered is incorrect. Please check your credentials and try again.');
          }
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Please check your email and click the confirmation link to activate your account before signing in.');
          }
          throw error;
        }
      }
    } catch (error: any) {
      showNotification('error', error.message);
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1121] relative overflow-hidden">
      <ServerStatusIndicator />

      {/* Neural grid background */}
      <div className="absolute inset-0 neural-grid opacity-10"></div>
      
      {/* Animated circles */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 max-w-md ${
          notification.type === 'success' ? 'bg-green-500' : 
          notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-white text-sm">{notification.message}</span>
        </div>
      )}

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

          <h1 className="text-3xl font-bold mb-2 text-white">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-gray-400 mb-8">
            {isSignUp 
              ? 'Join Project 49 to access advanced traffic analysis tools' 
              : 'Sign in to your account to continue'
            }
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-[#1E293B] border border-[#334155] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-[#1E293B] border border-[#334155] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-[#1E293B] border border-[#334155] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all pr-12"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* reCAPTCHA */}
            <div className="flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey="6Le0Q7wrAAAAAABAh2pXfgRl2nCAWyhvY40ns4Ye"
                onChange={setCaptchaToken}
                theme="dark"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !captchaToken}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </div>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setFormData({ email: '', password: '', confirmPassword: '' });
                  setNotification(null);
                  recaptchaRef.current?.reset();
                  setCaptchaToken(null);
                }}
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in here' 
                  : 'Need an account? Create one here'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Auth;