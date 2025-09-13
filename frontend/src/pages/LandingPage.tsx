import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getStoredTheme, toggleTheme } from '../lib/theme';
import { Activity, AlertTriangle, BarChart3, Brain, FileText, Github, Grid, Linkedin, Lock, Mail, Moon, Shield, Sun, Twitter, Camera, Database, Code, Users, BarChart as ChartBar, Eye } from 'lucide-react';

function LandingPage() {
  const [darkMode, setDarkMode] = React.useState(() => getStoredTheme() === 'dark');
  const [user, setUser] = React.useState<any>(null);

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
      icon: <Camera className="w-6 h-6" />, 
      title: 'Video Analysis', 
      description: 'Advanced vehicle detection and tracking at level crossings using YOLOv8 and computer vision' 
    },
    { 
      icon: <ChartBar className="w-6 h-6" />, 
      title: 'Behavior Analysis', 
      description: 'Monitor and analyze driver compliance with safety measures and signage' 
    },
    { 
      icon: <Eye className="w-6 h-6" />, 
      title: 'Real-time Monitoring', 
      description: 'Process and analyze traffic footage in real-time for immediate insights' 
    },
    { 
      icon: <Shield className="w-6 h-6" />, 
      title: 'Privacy Protection', 
      description: 'Ensure data privacy through automated anonymization of sensitive information' 
    }
  ];

  const features = [
    { 
      icon: <Brain className="w-6 h-6" />, 
      title: 'YOLOv8 Integration', 
      description: 'State-of-the-art object detection for accurate vehicle tracking' 
    },
    { 
      icon: <Activity className="w-6 h-6" />, 
      title: 'Statistical Analysis', 
      description: 'Advanced analytics for traffic patterns and behavior' 
    },
    { 
      icon: <Database className="w-6 h-6" />, 
      title: 'Edge Processing', 
      description: 'Local processing for enhanced privacy and reduced latency' 
    },
    { 
      icon: <Lock className="w-6 h-6" />, 
      title: 'Data Security', 
      description: 'Robust security measures for sensitive information' 
    },
    { 
      icon: <Grid className="w-6 h-6" />, 
      title: 'Interactive Dashboard', 
      description: 'Real-time visualization of traffic analytics' 
    },
    { 
      icon: <Code className="w-6 h-6" />, 
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
            <div className="flex items-center space-x-8">
              <span className={`text-xl font-bold ${darkMode ? 'text-primary-400' : 'text-primary-600'} animate-float`}>Project 49</span>
              <div className="hidden md:flex space-x-6">
                <a href="#about" className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>About</a>
                <a href="#objectives" className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>Objectives</a>
                <a href="#features" className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>Features</a>
                <a href="#team" className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>Team</a>
                <a href="#timeline" className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-300`}>Timeline</a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="https://github.com/sasindudilshanranwadana/SynerX"
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 rounded-lg transition-all duration-300 ${
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
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 animate-glow ${
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
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 animate-glow ${
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
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 neural-background">
        <div className="absolute inset-0 grid-pattern opacity-20"></div>
        <div className="absolute inset-0 neural-grid"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <div className={`inline-block px-6 py-2 rounded-full text-sm font-medium mb-8 animate-float ${
            darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
          }`}>
            AI-Powered Road Safety Analysis
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 animate-float">
            Project 49
          </h1>
          <h2 className={`text-2xl md:text-3xl font-semibold mb-6 animate-float animation-delay-2000 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
            Road-User Behaviour Analysis Using AI & Computer Vision
          </h2>
          <p className={`text-xl mb-10 max-w-3xl mx-auto animate-float animation-delay-4000 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Enhancing road safety through intelligent video analytics at level crossings
          </p>
          <div className="flex justify-center">
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className={`px-8 py-3 rounded-lg text-lg font-medium transition-all duration-300 animate-glow ${
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
                className={`px-8 py-3 rounded-lg text-lg font-medium transition-all duration-300 animate-glow ${
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
      <section id="about" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className={`inline-block px-4 py-1 rounded-full text-sm font-medium mb-6 animate-float ${
                darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
              }`}>
                About the Project
              </div>
              <h2 className="text-3xl font-bold mb-6 animate-float animation-delay-2000">Revolutionizing Road Safety with AI</h2>
              <p className={`mb-6 animate-float animation-delay-4000 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Project 49 addresses the critical need for effective analysis of driver behavior at level crossings. 
                Working with key stakeholders like VicRoads, Department of Transport, and V/Line, we're developing 
                an innovative solution that provides meaningful insights from real-world traffic footage.
              </p>
              <p className={`animate-float animation-delay-4000 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
                src="https://github.com/sasindudilshanranwadana/SynerX/blob/web/public/m6-motorway-trim-result.gif?raw=true" 
                alt="Traffic Analysis with AI Detection" 
                className="rounded-xl shadow-2xl relative z-10 animate-float"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Objectives Section */}
      <section id="objectives" className={`py-24 ${darkMode ? 'bg-neural-800/50' : 'bg-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className={`inline-block px-4 py-1 rounded-full text-sm font-medium mb-6 animate-float ${
              darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
            }`}>
              Project Goals
            </div>
            <h2 className="text-3xl font-bold animate-float animation-delay-2000">Key Objectives</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {objectives.map((objective, index) => (
              <div
                key={index}
                className={`p-6 rounded-xl transition-all duration-300 hover:scale-105 animate-float ${
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
                <h3 className="text-xl font-semibold mb-2">{objective.title}</h3>
                <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{objective.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 neural-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className={`inline-block px-4 py-1 rounded-full text-sm font-medium mb-6 animate-float ${
              darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
            }`}>
              System Features
            </div>
            <h2 className="text-3xl font-bold animate-float animation-delay-2000">Technical Capabilities</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`p-6 rounded-xl transition-all duration-300 hover:scale-105 animate-float ${
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
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className={`py-24 ${darkMode ? 'bg-neural-800/50' : 'bg-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className={`inline-block px-4 py-1 rounded-full text-sm font-medium mb-6 animate-float ${
              darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
            }`}>
              Meet SynerX
            </div>
            <h2 className="text-3xl font-bold animate-float animation-delay-2000">Our Team</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <div 
                key={index} 
                className={`text-center p-6 rounded-xl transition-all duration-300 hover:scale-105 animate-float ${
                  darkMode 
                    ? 'bg-neural-800/50 hover:bg-neural-700/50' 
                    : 'bg-white hover:bg-gray-50 shadow-lg'
                }`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="relative mx-auto w-32 h-32 mb-4">
                  <div className={`absolute inset-0 rounded-full blur-xl animate-pulse-glow ${
                    darkMode ? 'bg-primary-500/20' : 'bg-primary-600/20'
                  }`}></div>
                  <div className={`w-full h-full rounded-full bg-gradient-to-br ${
                    darkMode ? 'from-neural-700 to-neural-800' : 'from-gray-100 to-gray-200'
                  } flex items-center justify-center text-3xl font-bold relative z-10`}>
                    {member.name.charAt(0)}
                  </div>
                  <div className={`absolute inset-0 rounded-full ring-2 animate-glow ${
                    darkMode ? 'ring-primary-500' : 'ring-primary-600'
                  }`}></div>
                </div>
                <h3 className="text-lg font-semibold">{member.name}</h3>
                <p className={`text-sm mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                  {member.id}
                </p>
                <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
      <section id="timeline" className="py-24 neural-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className={`inline-block px-4 py-1 rounded-full text-sm font-medium mb-6 animate-float ${
              darkMode ? 'bg-primary-500/10 text-primary-400' : 'bg-primary-600/10 text-primary-600'
            }`}>
              Development Progress
            </div>
            <h2 className="text-3xl font-bold animate-float animation-delay-2000">Project Timeline</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {timeline.map((item, index) => (
              <div
                key={index}
                className={`p-6 rounded-xl transition-all duration-300 hover:scale-105 animate-float ${
                  darkMode 
                    ? 'bg-neural-800/50 hover:bg-neural-700/50' 
                    : 'bg-white hover:bg-gray-50 shadow-lg'
                }`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className={`text-lg font-semibold ${
                  darkMode ? 'text-primary-400' : 'text-primary-600'
                }`}>
                  {item.quarter}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {item.tasks}
                </p>
                <p className={`text-sm font-medium ${
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
      <footer className={`py-12 ${darkMode ? 'bg-neural-800/50' : 'bg-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="animate-float">
              <h3 className="text-xl font-bold mb-4">Swinburne</h3>
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                A research project by Swinburne University of Technology
              </p>
            </div>
            <div className="animate-float animation-delay-2000">
              <h3 className="text-xl font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><a href="#about" className={`transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>About</a></li>
                <li><a href="#objectives" className={`transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Objectives</a></li>
                <li><a href="#features" className={`transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Features</a></li>
                <li><a href="#team" className={`transition-colors duration-300 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Team</a></li>
              </ul>
            </div>
            <div className="animate-float animation-delay-4000">
              <h3 className="text-xl font-bold mb-4">Contact</h3>
              <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
          <div className={`mt-12 pt-8 border-t ${darkMode ? 'border-neural-700' : 'border-gray-200'} text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <p>© 2024 Project 49. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;