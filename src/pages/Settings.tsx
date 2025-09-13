import React from 'react';
import { supabase } from '../lib/supabase';
import { getStoredTheme, toggleTheme } from '../lib/theme';
import {
  User, Mail, Moon, Sun, Key, Save,
  CheckCircle, AlertCircle
} from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ServerStatusIndicator from '../components/ServerStatusIndicator';

function Settings() {
  const [user, setUser] = React.useState<any>(null);
  const [darkMode, setDarkMode] = React.useState(() => getStoredTheme() === 'dark');
  const [showToast, setShowToast] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastType, setToastType] = React.useState<'success' | 'error'>('success');
  const [loading, setLoading] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  
  const [formData, setFormData] = React.useState({
    displayName: '',
    email: ''
  });

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setFormData(prev => ({
        ...prev,
        displayName: user?.user_metadata?.full_name || '',
        email: user?.email || ''
      }));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user;
      setUser(currentUser);
      if (currentUser) {
        setFormData(prev => ({
          ...prev,
          displayName: currentUser.user_metadata?.full_name || '',
          email: currentUser.email || ''
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: formData.email,
        data: {
          full_name: formData.displayName
        }
      });

      if (error) throw error;
      showNotification('Profile updated successfully', 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!formData.email) {
      showNotification('Please enter your email address first', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) throw error;
      showNotification('Password reset email sent successfully', 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeToggle = () => {
    const newTheme = toggleTheme(darkMode ? 'dark' : 'light');
    setDarkMode(newTheme === 'dark');
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#0B1121] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <ServerStatusIndicator />

      {/* Toast Notification */}
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
          toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toastType === 'success' ? (
            <CheckCircle className="w-5 h-5 text-white" />
          ) : (
            <AlertCircle className="w-5 h-5 text-white" />
          )}
          <span className="text-white">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header 
        title="Settings" 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        isSidebarOpen={sidebarOpen} 
      />

      {/* Sidebar */}
      <Sidebar 
        activePath="/settings" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage your account and preferences
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Settings */}
            <div className={`${darkMode ? 'bg-[#151F32]' : 'bg-white'} rounded-xl p-6 ${darkMode ? '' : 'shadow-lg border border-gray-200'}`}>
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-700'} mb-2`}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className={`w-full px-4 py-3 ${
                      darkMode 
                        ? 'bg-[#1E293B] border-[#2D3B4E] text-white' 
                        : 'bg-gray-50 border-gray-300 text-gray-900'
                    } border rounded-lg focus:outline-none focus:border-primary-400`}
                    placeholder="Enter your display name"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-700'} mb-2`}>
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full pl-12 pr-4 py-3 ${
                        darkMode 
                          ? 'bg-[#1E293B] border-[#2D3B4E] text-white' 
                          : 'bg-gray-50 border-gray-300 text-gray-900'
                      } border rounded-lg focus:outline-none focus:border-primary-400`}
                      placeholder="Enter your email address"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className={`${darkMode ? 'bg-[#151F32]' : 'bg-white'} rounded-xl p-6 ${darkMode ? '' : 'shadow-lg border border-gray-200'}`}>
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                Appearance
              </h2>
              <div className={`flex items-center justify-between p-4 ${darkMode ? 'bg-[#1E293B]' : 'bg-gray-50'} rounded-lg`}>
                <div>
                  <h3 className="font-medium">Dark Mode</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Use dark theme for better viewing experience
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleThemeToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    darkMode ? 'bg-primary-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Password Reset */}
            <div className={`${darkMode ? 'bg-[#151F32]' : 'bg-white'} rounded-xl p-6 ${darkMode ? '' : 'shadow-lg border border-gray-200'}`}>
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Password
              </h2>
              <div className={`p-4 ${darkMode ? 'bg-[#1E293B]' : 'bg-gray-50'} rounded-lg`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Reset Password</h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Send a password reset email to your registered email address
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading}
                    className="bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    {loading ? 'Sending...' : 'Reset Password'}
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg transition-colors flex items-center gap-2 font-medium"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Settings;