import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Activity, Shield, Zap } from 'lucide-react';
import ParticleBackground from '../components/visuals/ParticleBackground';

export default function LandingPage() {
    return (
        <div className="relative min-h-screen bg-[#0a0b10] text-white overflow-hidden">
            <ParticleBackground />

            {/* Navbar */}
            <nav className="relative z-10 flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Activity className="w-5 h-5 text-white" />
                    </div>
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
                        <span className="text-sm font-medium text-blue-200">Next-Gen Camera Analytics</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-gray-400">
                        See the Unseen.
                    </h1>

                    <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Transform standard CCTV feeds into real-time business intelligence using advanced computer vision. No expensive hardware required.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            to="/register"
                            className="group relative px-8 py-4 bg-white text-black rounded-full font-semibold text-lg transition-all hover:scale-105"
                        >
                            Start Free Trial
                            <ArrowRight className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            <div className="absolute inset-0 rounded-full bg-white blur-lg opacity-30 group-hover:opacity-50 transition-opacity -z-10" />
                        </Link>

                        <Link
                            to="/demo"
                            className="px-8 py-4 bg-white/5 border border-white/10 rounded-full font-semibold text-lg hover:bg-white/10 transition-all backdrop-blur-sm"
                        >
                            View Live Demo
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
                            icon: Zap,
                            title: "Real-time Processing",
                            desc: "Analyze feeds instantly with <100ms latency using optimized edge computing."
                        },
                        {
                            icon: Shield,
                            title: "Privacy First",
                            desc: "GDPR-compliant processing. Faces are blurred automatically at the source."
                        },
                        {
                            icon: Activity,
                            title: "Actionable Insights",
                            desc: "Convert foot traffic into conversion rates and staffing recommendations."
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
            </main>
        </div>
    );
}
