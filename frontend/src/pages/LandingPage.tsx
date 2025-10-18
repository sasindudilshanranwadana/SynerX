import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getStoredTheme, toggleTheme } from '../lib/theme';
import { Activity, AlertTriangle, BarChart3, Brain, FileText, Github, Grid2x2 as Grid, Linkedin, Lock, Mail, Moon, Shield, Sun, Twitter, Camera, Database, Code, Users, BarChart as ChartBar, Eye, Menu, X } from 'lucide-react';

function LandingPage() {
  const [darkMode, setDarkMode] = React.useState(() => getStoredTheme() === 'dark');
  const [user, setUser] = React.useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleThemeToggle = () => {
    const newTheme = toggleTheme(darkMode ? 'dark' : 'light');
    setDarkMode(newTheme === 'dark');
  };

  const isLoggedIn = user !== null;

  const objectives = [
    {
      icon: <Camera className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'Video Analysis',
      description: 'Advanced vehicle detection and tracking at level crossings using YOLOv8 and computer vision'
    },
    {
      icon: <ChartBar className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'Behavior Analysis',
      description: 'Monitor and analyze driver compliance with safety measures and signage'
    },
    {
      icon: <Eye className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'Real-time Monitoring',
      description: 'Process and analyze traffic footage in real-time for immediate insights'
    },
    {
      icon: <Shield className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'Privacy Protection',
      description: 'Ensure data privacy through automated anonymization of sensitive information'
    }
  ];

  const features = [
    {
      icon: <Brain className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'YOLOv8 Integration',
      description: 'State-of-the-art object detection for accurate vehicle tracking'
    },
    {
      icon: <Activity className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'Statistical Analysis',
      description: 'Advanced analytics for traffic patterns and behavior'
    },
    {
      icon: <Database className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'Edge Processing',
      description: 'Local processing for enhanced privacy and reduced latency'
    },
    {
      icon: <Lock className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'Data Security',
      description: 'Robust security measures for sensitive information'
    },
    {
      icon: <Grid className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'Interactive Dashboard',
      description: 'Real-time visualization of traffic analytics'
    },
    {
      icon: <Code className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: 'API Integration',
      description: 'Seamless integration with external systems'
    }
  ];

  const teamMembers = [
    {
      name: 'Sasindu Dilshan Ranwadana',
      role: 'Team Leader, Scrum Master, Developer',
      id: '104509653',
      github: 'https://github.com/sasindudilshanranwadana'
    },
    {
      name: 'Quang Vinh Le',
      role: 'QA, Developer, Documentation',
      id: '104097488',
      github: 'https://github.com/quangvinhlee'
    },
    {
      name: 'Franco Octavio Jimenez Perez',
      role: 'QA, Developer, Documentation, Communications',
      id: '104173896',
      github: 'https://github.com/Osovich'
    },
    {
      name: 'Janith Athuluwage',
      role: 'Developer, Documentation, QA',
      id: '104798312',
      github: 'https://github.com/janith14'
    },
    {
      name: 'Thiviru Thejan',
      role: 'Developer, Documentation, QA',
      id: '104321637',
      github: 'https://github.com/tthejan'
    },
    {
      name: 'Risinu Cooray',
      role: 'Developer, Documentation, QA',
      id: '104333137',
      github: 'https://github.com/risinu-c'
    }
  ];

  const timeline = [
    {
      quarter: 'Sprint 1',
      title: 'Project Setup & Planning',
      status: 'Completed',
      tasks: 'Repository setup, requirements gathering, and team organization'
    },
    {
      quarter: 'Sprint 2',
      title: 'Data Collection & Processing',
      status: 'Completed',
      tasks: 'Video data collection, preprocessing, and initial model training'
    },
    {
      quarter: 'Sprint 3',
      title: 'Core Development',
      status: 'Completed',
      tasks: 'YOLOv8 integration, dashboard development, and API implementation'
    },
    {
      quarter: 'Sprint 4',
      title: 'Testing & Optimization',
      status: 'Completed',
      tasks: 'System testing, performance optimization, and stakeholder feedback'
    },
    {
      quarter: 'Sprint 5',
      title: 'Deployment',
      status: 'In Progress',
      tasks: 'Production deployment, final testing, and system go-live'
    }
  ];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-neural-900 text-white' : 'bg-neural-100 text-gray-900'}`}>
      {/* Navigation */}
      <nav className={`fixed w-full z-50 backdrop-blur-sm border-b ${
        darkMode
          ? 'bg-neural-900/80 border-primary-500/10'
          : 'bg-white/80 border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4 sm:space-x-8">
              <span className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-primary-400' : 'text-primary-600'} animate-float`}>Project 49</span>
              <div className="hidden md:flex space-x-4 lg:space-x-6">
                <a href="#about" className={`text-sm lg:text-base ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>About</a>
                <a href="#objectives" className={`text-sm lg:text-base ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>Objectives</a>
                <a href="#features" className={`text-sm lg:text-base ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>Features</a>
                <a href="#team" className={`text-sm lg:text-base ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>Team</a>
                <a href="#timeline" className={`text-sm lg:text-base ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>Timeline</a>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <a
                href="https://github.com/sasindudilshanranwadana/SynerX"
                target="_blank"
                rel="noopener noreferrer"
                className={`hidden sm:block p-2 rounded-lg transition-all duration-300 ${
                  darkMode
                    ? 'text-gray-300 hover:text-white hover:bg-neural-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <Github className="w-5 h-5" />
              </a>
              <button
                onClick={handleThemeToggle}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  darkMode
                    ? 'bg-neural-800 text-gray-200 hover:bg-neural-700'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {darkMode ? <Sun className="w-5 h-5 animate-pulse-glow" /> : <Moon className="w-5 h-5 animate-pulse-glow" />}
              </button>
              {isLoggedIn ? (
                <Link
                  to="/dashboard"
                  className={`hidden sm:inline-block px-4 lg:px-6 py-2 rounded-lg text-sm lg:text-base font-medium transition-all duration-300 animate-glow ${
                    darkMode
                      ? 'bg-primary-500 hover:bg-primary-600 text-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className={`hidden sm:inline-block px-4 lg:px-6 py-2 rounded-lg text-sm lg:text-base font-medium transition-all duration-300 animate-glow ${
                    darkMode
                      ? 'bg-primary-500 hover:bg-primary-600 text-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  Sign In
                </Link>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`md:hidden p-2 rounded-lg transition-all duration-300 ${
                  darkMode
                    ? 'text-gray-300 hover:text-white hover:bg-neural-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className={`md:hidden border-t ${
            darkMode ? 'border-primary-500/10 bg-neural-900' : 'border-gray-200 bg-white'
          }`}>
            <div className="px-4 py-4 space-y-3">
              <a
                href="#about"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                  darkMode ? 'text-gray-300 hover:text-white hover:bg-neural-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                About
              </a>
              <a
                href="#objectives"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                  darkMode ? 'text-gray-300 hover:text-white hover:bg-neural-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Objectives
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                  darkMode ? 'text-gray-300 hover:text-white hover:bg-neural-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Features
              </a>
              <a
                href="#team"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                  darkMode ? 'text-gray-300 hover:text-white hover:bg-neural-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Team
              </a>
              <a
                href="#timeline"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                  darkMode ? 'text-gray-300 hover:text-white hover:bg-neural-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Timeline
              </a>
              <a
                href="https://github.com/sasindudilshanranwadana/SynerX"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                  darkMode ? 'text-gray-300 hover:text-white hover:bg-neural-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Github className="w-5 h-5" />
                GitHub
              </a>
              {isLoggedIn ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block text-center px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 ${
                    darkMode
                      ? 'bg-primary-500 hover:bg-primary-600 text-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block text-center px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 ${
                    darkMode
                      ? 'bg-primary-500 hover:bg-primary-600 text-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 sm:pt-24 md:pt-32 pb-16 sm:pb-20 md:pb-24 neural-background">
        <div className="absolute inset-0 grid-pattern opacity-20"></div>
        <div className="absolute inset-0 neural-grid"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <div className={`inline-block px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-medium mb-6 sm:mb-8 animate-float ${
            darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
          }`}>
            AI-Powered Road Safety Analysis
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 animate-float leading-tight">
            Project 49
          </h1>
          <h2 className={`text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold mb-4 sm:mb-6 animate-float animation-delay-2000 ${darkMode ? 'text-primary-400' : 'text-primary-600'} leading-tight px-2`}>
            Road-User Behaviour Analysis Using AI & Computer Vision
          </h2>
          <p className={`text-base sm:text-lg md:text-xl mb-6 sm:mb-8 md:mb-10 max-w-3xl mx-auto animate-float animation-delay-4000 ${darkMode ? 'text-gray-400' : 'text-gray-600'} px-4`}>
            Enhancing road safety through intelligent video analytics at level crossings
          </p>
          <div className="flex justify-center px-4">
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 rounded-lg text-base sm:text-lg font-medium transition-all duration-300 animate-glow ${
                  darkMode
                    ? 'bg-primary-500 hover:bg-primary-600 text-white'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/auth"
                className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 rounded-lg text-base sm:text-lg font-medium transition-all duration-300 animate-glow ${
                  darkMode
                    ? 'bg-primary-500 hover:bg-primary-600 text-white'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-12 items-center">
            <div>
              <div className={`inline-block px-4 py-1 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-float ${
                darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
              }`}>
                About the Project
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 animate-float animation-delay-2000">Revolutionizing Road Safety with AI</h2>
              <p className={`mb-4 sm:mb-6 text-sm sm:text-base animate-float animation-delay-4000 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Project 49 addresses the critical need for effective analysis of driver behavior at level crossings.
                Working with key stakeholders like VicRoads, Department of Transport, and V/Line, we're developing
                an innovative solution that provides meaningful insights from real-world traffic footage.
              </p>
              <p className={`text-sm sm:text-base animate-float animation-delay-4000 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Our system processes traffic camera footage to detect vehicles, measure speed profiles, assess compliance
                behavior, and visualize data through an interactive dashboard, enabling data-driven decisions for road
                safety improvements.
              </p>
            </div>
            <div className="relative">
              <div className={`absolute inset-0 rounded-xl ${
                darkMode ? 'bg-primary-500/10' : 'bg-primary-600/10'
              } blur-3xl -z-10 animate-pulse-glow`}></div>
              <img
                src="https://iqehkneolpesaqznkqjm.supabase.co/storage/v1/object/sign/assets/m6-motorway-trim-result.gif?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83YmM1YjM5OS00ZDQwLTRiMDktOGE3Yi1kOWMxNzlkNjcyM2UiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvbTYtbW90b3J3YXktdHJpbS1yZXN1bHQuZ2lmIiwiaWF0IjoxNzU4NzMwMDYyLCJleHAiOjMxNTUzNTg3MzAwNjJ9.pKZVb8o3SVRrZ_N5WGWNcrRI59hyZ-tcNongThzTQs4"
                alt="Traffic Analysis with AI Detection"
                className="rounded-xl shadow-2xl relative z-10 animate-float object-cover h-[250px] sm:h-[300px] md:h-[400px] w-full max-w-full"
              />
              <div className="mt-4 sm:mt-6 md:mt-8 text-center relative z-10 text-gray-300">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">Project 49</h2>
                <p className="text-sm sm:text-base text-gray-400">Road-User Behaviour Analysis Using AI & Computer Vision</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Objectives Section */}
      <section id="objectives" className={`py-12 sm:py-16 md:py-20 lg:py-24 ${darkMode ? 'bg-neural-800/50' : 'bg-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <div className={`inline-block px-4 py-1 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-float ${
              darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
            }`}>
              Project Goals
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold animate-float animation-delay-2000">Key Objectives</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {objectives.map((objective, index) => (
              <div
                key={index}
                className={`p-4 sm:p-6 rounded-xl transition-all duration-300 hover:scale-105 animate-float ${
                  darkMode
                    ? 'bg-neural-800/50 hover:bg-neural-700/50'
                    : 'bg-white hover:bg-gray-50 shadow-lg'
                }`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className={`p-3 rounded-lg inline-block mb-4 animate-pulse-glow ${
                  darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
                }`}>
                  {objective.icon}
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-2">{objective.title}</h3>
                <p className={`text-sm sm:text-base ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{objective.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-16 md:py-20 lg:py-24 neural-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <div className={`inline-block px-4 py-1 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-float ${
              darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
            }`}>
              System Features
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold animate-float animation-delay-2000">Technical Capabilities</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`p-4 sm:p-6 rounded-xl transition-all duration-300 hover:scale-105 animate-float ${
                  darkMode
                    ? 'bg-neural-800/50 hover:bg-neural-700/50'
                    : 'bg-white hover:bg-gray-50 shadow-lg'
                }`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className={`p-3 rounded-lg inline-block mb-4 animate-pulse-glow ${
                  darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
                }`}>
                  {feature.icon}
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-2">{feature.title}</h3>
                <p className={`text-sm sm:text-base ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className={`py-12 sm:py-16 md:py-20 lg:py-24 ${darkMode ? 'bg-neural-800/50' : 'bg-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <div className={`inline-block px-4 py-1 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-float ${
              darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
            }`}>
              Meet SynerX
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold animate-float animation-delay-2000">Our Team</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className={`text-center p-4 sm:p-6 rounded-xl transition-all duration-300 hover:scale-105 animate-float ${
                  darkMode
                    ? 'bg-neural-800/50 hover:bg-neural-700/50'
                    : 'bg-white hover:bg-gray-50 shadow-lg'
                }`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32 mb-4">
                  <div className={`absolute inset-0 rounded-full blur-xl animate-pulse-glow ${
                    darkMode ? 'bg-primary-500/20' : 'bg-primary-600/20'
                  }`}></div>
                  <div className={`w-full h-full rounded-full bg-gradient-to-br ${
                    darkMode ? 'from-neural-700 to-neural-800' : 'from-gray-100 to-gray-200'
                  } flex items-center justify-center text-2xl sm:text-3xl font-bold relative z-10`}>
                    {member.name.charAt(0)}
                  </div>
                  <div className={`absolute inset-0 rounded-full ring-2 animate-glow ${
                    darkMode ? 'ring-primary-500' : 'ring-primary-600'
                  }`}></div>
                </div>
                <h3 className="text-sm sm:text-base lg:text-lg font-semibold">{member.name}</h3>
                <p className={`text-xs sm:text-sm mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                  {member.id}
                </p>
                <p className={`text-xs sm:text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {member.role}
                </p>
                <div className="flex justify-center">
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <Github className="w-5 h-5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section id="timeline" className="py-12 sm:py-16 md:py-20 lg:py-24 neural-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <div className={`inline-block px-4 py-1 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-float ${
              darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
            }`}>
              Development Progress
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold animate-float animation-delay-2000">Project Timeline</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
            {timeline.map((item, index) => (
              <div
                key={index}
                className={`p-4 sm:p-6 rounded-xl transition-all duration-300 hover:scale-105 animate-float ${
                  darkMode
                    ? 'bg-neural-800/50 hover:bg-neural-700/50'
                    : 'bg-white hover:bg-gray-50 shadow-lg'
                }`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className={`text-base sm:text-lg font-semibold mb-2 ${
                  darkMode ? 'text-primary-400' : 'text-primary-600'
                }`}>
                  {item.quarter}
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-2">{item.title}</h3>
                <p className={`text-xs sm:text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {item.tasks}
                </p>
                <p className={`text-xs sm:text-sm font-medium ${
                  item.status === 'Completed'
                    ? 'text-green-500'
                    : item.status === 'In Progress'
                    ? darkMode ? 'text-primary-400' : 'text-primary-600'
                    : darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {item.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 sm:py-10 md:py-12 ${darkMode ? 'bg-neural-800/50' : 'bg-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 md:gap-12">
            <div className="animate-float">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Swinburne</h3>
              <p className={`text-sm sm:text-base ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                A research project by Swinburne University of Technology
              </p>
            </div>
            <div className="animate-float animation-delay-2000">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><a href="#about" className={`text-sm sm:text-base transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>About</a></li>
                <li><a href="#objectives" className={`text-sm sm:text-base transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Objectives</a></li>
                <li><a href="#features" className={`text-sm sm:text-base transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Features</a></li>
                <li><a href="#team" className={`text-sm sm:text-base transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Team</a></li>
              </ul>
            </div>
            <div className="animate-float animation-delay-4000">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Contact</h3>
              <p className={`mb-4 text-sm sm:text-base ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                For inquiries, please contact our team at Swinburne University
              </p>
              <div className="flex space-x-4">
                <a href="#" className={`transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className={`transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                  <Mail className="w-5 h-5" />
                </a>
                <a
                  href="https://github.com/sasindudilshanranwadana/SynerX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <Github className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
          <div className={`mt-6 sm:mt-8 md:mt-12 pt-6 sm:pt-8 border-t ${darkMode ? 'border-neural-700' : 'border-gray-200'} text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <p className="text-sm sm:text-base">© 2024 Project 49. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
