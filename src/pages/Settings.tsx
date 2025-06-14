import React from 'react';
<<<<<<< Updated upstream
import { getAuth, updateProfile, updateEmail } from 'firebase/auth';
=======
import { supabase } from '../lib/supabase';
>>>>>>> Stashed changes
import {
  User, Mail, Moon, Sun, Bell, Shield, Trash2, Save,
  CheckCircle, AlertCircle
} from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

function Settings() {
<<<<<<< Updated upstream
  const auth = getAuth();
=======
  const [user, setUser] = React.useState<any>(null);
>>>>>>> Stashed changes
  const [darkMode, setDarkMode] = React.useState(true);
  const [showToast, setShowToast] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastType, setToastType] = React.useState<'success' | 'error'>('success');
  const [loading, setLoading] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  
  const [formData, setFormData] = React.useState({
<<<<<<< Updated upstream
    displayName: auth.currentUser?.displayName || '',
    email: auth.currentUser?.email || '',
=======
    displayName: '',
    email: '',
>>>>>>> Stashed changes
    modelThreshold: '0.75',
    alertThreshold: '3',
    retentionDays: '30',
    emailNotifications: true,
    pushNotifications: true,
    dataCollection: true
  });

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      if (auth.currentUser) {
        // Update profile information
        await updateProfile(auth.currentUser, {
          displayName: formData.displayName
        });

        // Update email if changed
        if (formData.email !== auth.currentUser.email) {
          await updateEmail(auth.currentUser, formData.email);
        }

        showNotification('Settings updated successfully', 'success');
      }
=======
      const { error } = await supabase.auth.updateUser({
        email: formData.email,
        data: {
          full_name: formData.displayName
        }
      });

      if (error) throw error;
      showNotification('Settings updated successfully', 'success');
>>>>>>> Stashed changes
    } catch (error: any) {
      showNotification(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev]
    }));
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-white">
      {/* Toast Notification */}
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
          toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toastType === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{toastMessage}</span>
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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-gray-400">Manage your account and application preferences</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Account Settings */}
            <div className="bg-[#151F32] rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Display Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-4 py-2 bg-[#1E293B] border border-[#2D3B4E] rounded-lg focus:outline-none focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-[#1E293B] border border-[#2D3B4E] rounded-lg focus:outline-none focus:border-primary-400"
                  />
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="bg-[#151F32] rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                Appearance
              </h2>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Dark Mode</span>
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    darkMode ? 'bg-primary-500' : 'bg-gray-600'
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

            {/* AI Model Configuration */}
            <div className="bg-[#151F32] rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                AI Model Configuration
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Detection Threshold
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={formData.modelThreshold}
                    onChange={(e) => setFormData({ ...formData, modelThreshold: e.target.value })}
                    className="w-full h-2 bg-[#1E293B] rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-gray-400 mt-1">
                    <span>0</span>
                    <span>{formData.modelThreshold}</span>
                    <span>1</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Alert Threshold (violations/hour)
                  </label>
                  <input
                    type="number"
                    value={formData.alertThreshold}
                    onChange={(e) => setFormData({ ...formData, alertThreshold: e.target.value })}
                    className="w-full px-4 py-2 bg-[#1E293B] border border-[#2D3B4E] rounded-lg focus:outline-none focus:border-primary-400"
                  />
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-[#151F32] rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Email Notifications</h3>
                    <p className="text-sm text-gray-400">Receive alerts via email</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('emailNotifications')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.emailNotifications ? 'bg-primary-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Push Notifications</h3>
                    <p className="text-sm text-gray-400">Receive alerts in browser</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('pushNotifications')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.pushNotifications ? 'bg-primary-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.pushNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy & Data */}
            <div className="bg-[#151F32] rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Privacy & Data
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Data Retention Period (days)
                  </label>
                  <input
                    type="number"
                    value={formData.retentionDays}
                    onChange={(e) => setFormData({ ...formData, retentionDays: e.target.value })}
                    className="w-full px-4 py-2 bg-[#1E293B] border border-[#2D3B4E] rounded-lg focus:outline-none focus:border-primary-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Data Collection</h3>
                    <p className="text-sm text-gray-400">Allow anonymous usage data collection</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('dataCollection')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.dataCollection ? 'bg-primary-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.dataCollection ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Data
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
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