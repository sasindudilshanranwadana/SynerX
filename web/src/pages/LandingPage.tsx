import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Shield, 
  LineChart, 
  Bell, 
  Grid, 
  FileText,
  Github,
  Twitter,
  Linkedin,
  Moon,
  Sun,
  LogIn,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const LandingPage = () => {
  const { signInWithGoogle, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const objectives = [
    { 
      icon: Activity,
      title: 'Detect & Track',
      description: 'Advanced vehicle detection and tracking using computer vision'
    },
    { 
      icon: LineChart,
      title: 'Measure Compliance',
      description: 'Monitor speed and manage compliance at crossings'
    },
    { 
      icon: Grid,
      title: 'Pattern Analysis',
      description: 'Visualize and analyze behavior patterns'
    },
    { 
      icon: Shield,
      title: 'Support Decisions',
      description: 'Provide data-driven insights for safety improvements'
    }
  ];

  const features = [
    { 
      icon: Grid,
      title: 'YOLOv8 Integration',
      description: 'State-of-the-art object detection'
    },
    { 
      icon: Activity,
      title: 'Heatmap Generation',
      description: 'Visual analysis of traffic patterns'
    },
    { 
      icon: FileText,
      title: 'PDF Report Export',
      description: 'Comprehensive data reporting'
    },
    { 
      icon: Shield,
      title: 'Edge Privacy',
      description: 'On-device processing for privacy'
    },
    { 
      icon: Bell,
      title: 'Real-Time Alerts',
      description: 'Immediate notification system'
    },
    { 
      icon: LineChart,
      title: 'Advanced Analytics',
      description: 'Deep insights and analysis'
    }
  ];

  const team = [
    {
      name: 'Sasindu Dilshan Ranwadana',
      role: 'Team Leader, Scrum Master, Developer',
      studentId: '104509653',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?fit=crop&w=500&h=500',
      social: { github: '#', linkedin: '#' }
    },
    {
      name: 'Quang Vinh Le',
      role: 'QA, Developer, Documentation',
      studentId: '104097488',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fit=crop&w=500&h=500',
      social: { github: '#', linkedin: '#' }
    },
    {
      name: 'Franco Octavio Jimenez Perez',
      role: 'QA, Developer, Documentation, Communications',
      studentId: '104173896',
      image: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?fit=crop&w=500&h=500',
      social: { github: '#', linkedin: '#' }
    },
    {
      name: 'Janith Athuluwage',
      role: 'Developer, Documentation, QA',
      studentId: '104798312',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?fit=crop&w=500&h=500',
      social: { github: '#', linkedin: '#' }
    },
    {
      name: 'Thiviru Thejan',
      role: 'Developer, Documentation, QA',
      studentId: '104321637',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fit=crop&w=500&h=500',
      social: { github: '#', linkedin: '#' }
    },
    {
      name: 'Risinu Cooray',
      role: 'Developer, Documentation, QA',
      studentId: '104333137',
      image: 'https://images.unsplash.com/photo-1463453091185-61582044d556?fit=crop&w=500&h=500',
      social: { github: '#', linkedin: '#' }
    }
  ];

  const timeline = [
    { quarter: 'Q1 2024', title: 'Project Initiation', status: 'Completed' },
    { quarter: 'Q2 2024', title: 'Data Collection', status: 'In Progress' },
    { quarter: 'Q3 2024', title: 'Model Development', status: 'Upcoming' },
    { quarter: 'Q4 2024', title: 'System Deployment', status: 'Planned' }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B1121] text-gray-900 dark:text-white transition-colors duration-200">
      <nav className="fixed w-full z-50 bg-white/80 dark:bg-[#0B1121]/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <a href="#" className="text-xl font-bold text-cyan-500">Project 49</a>
          <div className="flex items-center space-x-8">
            <a href="#about" className="hover:text-cyan-500 transition-colors">About</a>
            <a href="#objectives" className="hover:text-cyan-500 transition-colors">Objectives</a>
            <a href="#features" className="hover:text-cyan-500 transition-colors">Features</a>
            <a href="#team" className="hover:text-cyan-500 transition-colors">Team</a>
            <a href="#timeline" className="hover:text-cyan-500 transition-colors">Timeline</a>
            <a
              href="https://github.com/sasindudilshanranwadana/SynerX/tree/main"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-500 transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded-full transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in</span>
              </button>
            )}
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              {theme === 'dark' ? (
                <Sun size={20} className="text-yellow-500" />
              ) : (
                <Moon size={20} className="text-gray-700" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-bold mb-6"
          >
            Project 49
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl text-cyan-500 mb-8"
          >
            Road-User Behaviour Analysis Using AI & Computer Vision
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto"
          >
            Enhancing road safety through intelligent video analytics at level crossings
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex justify-center"
          >
            {user ? (
              <button 
                onClick={() => navigate('/dashboard')} 
                className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-full font-medium transition-colors flex items-center space-x-2"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Go to Dashboard</span>
              </button>
            ) : (
              <button 
                onClick={() => navigate('/auth')} 
                className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-full font-medium transition-colors"
              >
                Get Started
              </button>
            )}
          </motion.div>
        </div>
        
        {/* Background Animation */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1a365d,#0B1121)] dark:opacity-100 opacity-10 transition-opacity duration-200" />
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute bg-cyan-500/20"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: '1px',
                height: '1px',
              }}
              animate={{
                scale: [1, 3, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">About the Project</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Project 49 is a cutting-edge research initiative that leverages artificial
                intelligence and computer vision to analyze and improve road user
                behavior at level crossings. In collaboration with VicRoads, the
                Department of Transport, and V/Line, we're developing innovative
                solutions for transportation safety.
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                Our system uses advanced AI algorithms to process video footage,
                detect potential safety risks, and provide actionable insights to
                transportation authorities.
              </p>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1617471346061-5d329ab9c574?auto=format&fit=crop&w=800&q=80" 
                alt="Traffic Intersection" 
                className="rounded-lg shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0B1121] via-transparent to-transparent transition-colors duration-200" />
            </div>
          </div>
        </div>
      </section>

      {/* Objectives Section */}
      <section id="objectives" className="py-20 bg-gray-50 dark:bg-white/5 transition-colors duration-200">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Project Objectives</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {objectives.map((objective, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-cyan-500/20 hover:border-cyan-500/50 transition-colors"
              >
                <objective.icon className="w-12 h-12 text-cyan-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">{objective.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{objective.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">System Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-cyan-500/50 transition-all duration-300"
              >
                <feature.icon className="w-12 h-12 text-cyan-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="py-20 bg-gray-50 dark:bg-white/5 transition-colors duration-200">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-500/50" />
                </div>
                <h3 className="text-xl font-semibold">{member.name}</h3>
                <p className="text-cyan-500 mb-1">{member.role}</p>
                <p className="text-sm text-gray-500 mb-4">Student ID: {member.studentId}</p>
                <div className="flex justify-center space-x-4">
                  <a href={member.social.github} className="text-gray-400 hover:text-cyan-500">
                    <Github size={20} />
                  </a>
                  <a href={member.social.linkedin} className="text-gray-400 hover:text-cyan-500">
                    <Linkedin size={20} />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section id="timeline" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Project Timeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {timeline.map((phase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="p-6 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div className="text-cyan-500 mb-2">{phase.quarter}</div>
                  <h3 className="text-xl font-semibold mb-2">{phase.title}</h3>
                  <span className="text-sm px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-500">
                    {phase.status}
                  </span>
                </div>
                {index < timeline.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-[2px] bg-gray-200 dark:bg-gray-800" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-gray-800 transition-colors duration-200">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <img
                src="https://www.swinburne.edu.au/media/swinburneeduau/style-assets/images/logos/swinburne-logo-white.png"
                alt="Swinburne University"
                className="h-8 mb-4 dark:opacity-100 opacity-50"
              />
              <p className="text-gray-600 dark:text-gray-400">
                A research project by Swinburne University of Technology
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li><a href="#about" className="hover:text-cyan-500">About</a></li>
                <li><a href="#features" className="hover:text-cyan-500">Features</a></li>
                <li><a href="#team" className="hover:text-cyan-500">Team</a></li>
                <li><a href="#timeline" className="hover:text-cyan-500">Timeline</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                For inquiries, please contact Project Lead<br />
                Chris McCarthy at Swinburne University
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-cyan-500">
                  <Twitter size={20} />
                </a>
                <a href="#" className="text-gray-400 hover:text-cyan-500">
                  <Github size={20} />
                </a>
                <a href="#" className="text-gray-400 hover:text-cyan-500">
                  <Linkedin size={20} />
                </a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-gray-600 dark:text-gray-400">
            <p>© 2024 Project 49. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;