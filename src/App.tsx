import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import Upload from './pages/Upload';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Progress from './pages/Progress';
import ProgressBoard from './pages/ProgressBoard';
import Settings from './pages/Settings';
import LoadingScreen from './components/LoadingScreen';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function App() {
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [pageLoading, setPageLoading] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Add loading state for route changes
  React.useEffect(() => {
    const handleStart = () => setPageLoading(true);
    const handleComplete = () => setPageLoading(false);

    window.addEventListener('beforeunload', handleStart);
    window.addEventListener('load', handleComplete);

    return () => {
      window.removeEventListener('beforeunload', handleStart);
      window.removeEventListener('load', handleComplete);
    };
  }, []);

  if (loading || pageLoading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route 
          path="/dashboard/*" 
          element={user ? <Dashboard /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/upload" 
          element={user ? <Upload /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/analytics" 
          element={user ? <Analytics /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/reports" 
          element={user ? <Reports /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/progress" 
          element={user ? <Progress /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/progress/board" 
          element={user ? <ProgressBoard /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/settings" 
          element={user ? <Settings /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/auth" 
          element={!user ? <Auth /> : <Navigate to="/dashboard" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;