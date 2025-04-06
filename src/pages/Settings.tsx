import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Moon,
  Sun, 
  Shield, 
  Sliders, 
  Bell, 
  Save,
  Trash2,
  Mail,
  Edit3,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Settings = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isEditingName, setIsEditingName] = useState(false);
  
  // AI Model Settings
  const [modelSettings, setModelSettings] = useState({
    confidenceThreshold: 0.75,
    detectionInterval: 500,
    alertThreshold: 3
  });

  // Privacy Settings
  const [privacySettings, setPrivacySettings] = useState({
    retentionDays: 30,
    autoDelete: true,
    shareAnalytics: true
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailAlerts: true,
    pushNotifications: true,
    dailyReport: false
  });

  const handleSaveSettings = () => {
    // Implementation for saving settings
    console.log('Saving settings...');
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400 dark:text-gray-400">
          Manage your account and system preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Account Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#0F172A] p-6 rounded-xl border border-gray-200 dark:border-gray-800"
        >
          <div className="flex items-center gap-3 mb-6">
            <User className="w-6 h-6 text-cyan-500" />
            <h2 className="text-xl font-semibold">Account Settings</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-gray-600 dark:text-gray-400 mb-2">Profile Picture</label>
              <div className="flex items-center gap-4">
                <img
                  src={user?.photoURL || 'https://via.placeholder.com/80'}
                  alt="Profile"
                  className="w-20 h-20 rounded-full ring-2 ring-cyan-500/30"
                />
                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  Change Photo
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-600 dark:text-gray-400 mb-2">Display Name</label>
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2"
                  />
                ) : (
                  <p>{displayName}</p>
                )}
                <button
                  onClick={() => setIsEditingName(!isEditingName)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Edit3 className="w-5 h-5 text-cyan-500" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-600 dark:text-gray-400 mb-2">Email Address</label>
              <p>{user?.email}</p>
            </div>
          </div>
        </motion.div>

        {/* Appearance Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-[#0F172A] p-6 rounded-xl border border-gray-200 dark:border-gray-800"
        >
          <div className="flex items-center gap-3 mb-6">
            {theme === 'dark' ? (
              <Moon className="w-6 h-6 text-cyan-500" />
            ) : (
              <Sun className="w-6 h-6 text-cyan-500" />
            )}
            <h2 className="text-xl font-semibold">Appearance</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1">Dark Mode</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Toggle dark/light theme</p>
              </div>
              <button
                onClick={toggleTheme}
                className={`w-14 h-7 rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-cyan-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                    theme === 'dark' ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Rest of the settings sections... */}
      </div>

      {/* Save Button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleSaveSettings}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white shadow-lg transition-colors"
      >
        <Save className="w-5 h-5" />
        <span>Save Changes</span>
      </motion.button>
    </div>
  );
};

export default Settings;