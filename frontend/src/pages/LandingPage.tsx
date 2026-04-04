import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Activity, Shield, Zap, Lock, BarChart3, MapPin, Brain, Users, TrendingUp, Camera, Eye } from 'lucide-react';
import ParticleBackground from '../components/visuals/ParticleBackground';
import logoImage from '../assets/logo.jpeg';

export default function LandingPage() {
    return (
        <div className="relative min-h-screen bg-[#0a0b10] text-white overflow-hidden">
            <ParticleBackground />

            {/* Navbar */}
            <nav className="relative z-10 flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-2">
                    <img 
                        src={logoImage} 
                        alt="ObservAI Logo" 
                        className="w-8 h-8 rounded-lg object-contain"
                    />
                    <span className="text-xl font-bold tracking-tight">ObservAI</span>
                </div>
                <div className="flex items-center gap-6">
                    <Link to="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                        Login
                    </Link>
                    <Link
                        to="/register"
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-sm font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/30 border border-blue-500/30 mb-8 backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span className="text-sm font-medium text-blue-200">AI-Powered Analytics</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-gray-400">
                        See the Unseen.
                    </h1>

                    <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Real-time customer analytics for cafes and restaurants. Track visitor flow, demographics, and peak hours from your existing cameras.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            to="/register"
                            className="group relative px-8 py-4 bg-white text-black rounded-full font-semibold text-lg transition-all hover:scale-105"
                        >
                            Start 14-Day Free Trial
                            <ArrowRight className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            <div className="absolute inset-0 rounded-full bg-white blur-lg opacity-30 group-hover:opacity-50 transition-opacity -z-10" />
                        </Link>

                        <Link
                            to="/demo"
                            className="px-8 py-4 bg-white/5 border border-white/10 rounded-full font-semibold text-lg hover:bg-white/10 transition-all backdrop-blur-sm"
                        >
                            View Demo Dashboard
                        </Link>
                    </div>
                </motion.div>

                {/* Features Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-6xl mx-auto text-left"
                >
                    {[
                        {
                            icon: Lock,
                            title: "Secure Access",
                            desc: "Authenticated access for authorized managers only."
                        },
                        {
                            icon: BarChart3,
                            title: "Real-Time Dashboard",
                            desc: "Live visitor counts, demographics, and occupancy heatmaps."
                        },
                        {
                            icon: MapPin,
                            title: "Zone Labeling",
                            desc: "Define entrance and exit zones for accurate traffic flow analysis."
                        },
                        {
                            icon: Brain,
                            title: "AI Insights",
                            desc: "Behavioral analysis and decision-support recommendations."
                        },
                        {
                            icon: Users,
                            title: "Demographics",
                            desc: "Track gender and age distribution with interactive charts."
                        },
                        {
                            icon: Eye,
                            title: "Behavior Tracking",
                            desc: "Monitor customer movement patterns and queue density."
                        },
                        {
                            icon: TrendingUp,
                            title: "Historical Data",
                            desc: "Review trends and export data for deeper analysis."
                        },
                        {
                            icon: Camera,
                            title: "Multi-Camera",
                            desc: "Monitor multiple camera feeds simultaneously."
                        },
                        {
                            icon: Shield,
                            title: "Privacy First",
                            desc: "GDPR-compliant with automatic face blurring."
                        }
                    ].map((feature, idx) => (
                        <div key={idx} className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
                            <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center mb-4 text-blue-400">
                                <feature.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </motion.div>

                {/* How It Works Section */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-32 max-w-5xl mx-auto w-full"
                >
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-400">
                            How It Works
                        </h2>
                        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                            Get started in minutes.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                        {[
                            {
                                step: "1",
                                title: "Authenticate",
                                desc: "Log in with secure credentials."
                            },
                            {
                                step: "2",
                                title: "Access Dashboard",
                                desc: "View real-time analytics from camera feeds."
                            },
                            {
                                step: "3",
                                title: "View Analytics",
                                desc: "Monitor visitor counts and demographics."
                            },
                            {
                                step: "4",
                                title: "Label Zones",
                                desc: "Define entrance and exit zones."
                            },
                            {
                                step: "5",
                                title: "Get Insights",
                                desc: "Receive AI-generated recommendations."
                            }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.5 + idx * 0.1 }}
                                className="text-center"
                            >
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                                    {item.step}
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
