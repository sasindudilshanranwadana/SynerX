import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { initializeTheme } from './lib/theme';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import Upload from './pages/Upload';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Playback from './pages/Playback';
import ConfirmationSuccess from './pages/ConfirmationSuccess';
import LoadingScreen from './components/LoadingScreen';

function App() {
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [pageLoading, setPageLoading] = React.useState(false);

  React.useEffect(() => {
    // Initialize theme on app start
    initializeTheme();

    // Get initial session and handle any errors
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Session retrieval error:', error.message);
          setUser(null);
        } else {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.warn('Failed to get session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Set up Supabase auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (loading) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
        <Route path="/upload" element={user ? <Upload /> : <Navigate to="/auth" />} />
        <Route path="/analytics" element={user ? <Analytics /> : <Navigate to="/auth" />} />
        <Route path="/playback" element={user ? <Playback /> : <Navigate to="/auth" />} />
        <Route path="/settings" element={user ? <Settings /> : <Navigate to="/auth" />} />
        <Route path="/auth" element={!user ? <Auth /> : <Navigate to="/dashboard" />} />
        <Route path="/confirmation-success" element={<ConfirmationSuccess />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;