import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Zap,
  Lock,
  Clock,
  Ban,
  Smartphone,
  PackageOpen,
  Eye,
  Bell,
  ChevronRight,
  Terminal,
} from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const y = useTransform(scrollY, [0, 300], [0, -50]);

  const features = [
    {
      icon: Shield,
      title: "AES-256 Encryption",
      description: "Military-grade encryption used by governments.",
      color: "text-green-400",
      delay: 0.1,
    },
    {
      icon: Zap,
      title: "Self-Destruct",
      description: "Files vanish automatically after viewing.",
      color: "text-gold-500",
      delay: 0.2,
    },
    {
      icon: Lock,
      title: "Zero Knowledge",
      description: "We cannot see your data. Only you have the key.",
      color: "text-purple-400",
      delay: 0.3,
    },
    {
      icon: Clock,
      title: "Custom Expiry",
      description: "Set exact time limits for file availability.",
      color: "text-blue-400",
      delay: 0.4,
    },
  ];

  return (
    <div className="min-h-screen bg-dark-900 text-white font-sans selection:bg-gold-500/30 selection:text-gold-200 overflow-x-hidden">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-gold-500/5 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-gold-600/5 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
        {/* Simple CSS radial gradient if external image fails, blended with noise if possible */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
      </div>

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#F59E0B0A_1px,transparent_1px),linear-gradient(to_bottom,#F59E0B0A_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

      {/* Navbar */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "circOut" }}
        className="fixed top-0 w-full z-50 border-b border-dark-800/80 bg-dark-900/80 backdrop-blur-md"
      >
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => navigate('/')}>
            <div className="p-2 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg shadow-lg shadow-gold-500/20 group-hover:shadow-gold-500/40 transition-all duration-300">
              <PackageOpen className="text-black w-6 h-6" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">BAR Web</span>
          </div>
          <div className="flex items-center space-x-6">
            <a href="https://github.com/Mrtracker-new" target="_blank" rel="noreferrer" className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors">GitHub</a>
            <button
              onClick={() => navigate('/app')}
              className="px-6 py-2 bg-gold-500 hover:bg-gold-400 text-black font-semibold rounded-lg shadow-[0_0_20px_-5px_rgba(245,158,11,0.4)] hover:shadow-[0_0_25px_-5px_rgba(245,158,11,0.6)] transition-all duration-300 transform hover:scale-105"
            >
              Launch App
            </button>
          </div>
        </div>
      </motion.nav>

      <main className="relative pt-32 pb-20">

        {/* Hero Section */}
        <section className="container mx-auto px-6 text-center lg:min-h-[80vh] flex flex-col items-center justify-center">
          <motion.div style={{ opacity, y }} className="max-w-4xl mx-auto space-y-8">

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-gold-500/30 bg-gold-500/10 text-gold-400 text-xs tracking-wider uppercase font-medium mb-4"
            >
              <Terminal size={12} />
              <span>Secure File Transmission Protocol</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight"
            >
              <span className="block text-white mb-2">Burn After</span>
              <span className="bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 bg-clip-text text-transparent filter drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                Reading
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-light"
            >
              The most secure way to send sensitive documents.
              <br className="hidden md:block" />
              <span className="text-gray-300">Encrypted. Anonymous. Gone forever.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
            >
              <button
                onClick={() => navigate('/app')}
                className="group w-full sm:w-auto px-8 py-4 bg-white text-black font-bold text-lg rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center space-x-2 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
              >
                <span>Start Sealing</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => window.open('https://github.com/rolanlobo', '_blank')}
                className="w-full sm:w-auto px-8 py-4 bg-dark-800 text-gray-300 font-semibold text-lg rounded-xl border border-dark-700 hover:border-gold-500/30 hover:text-gold-400 transition-all"
              >
                Read Documentation
              </button>
            </motion.div>

          </motion.div>
        </section>

        {/* Features Staggered Grid */}
        <section className="container mx-auto px-6 py-20 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: feature.delay }}
                className="group p-6 bg-dark-800/50 backdrop-blur-sm border border-dark-700 rounded-2xl hover:bg-dark-800 hover:border-gold-500/20 transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-lg bg-dark-900 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/5`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Status Bar / Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="container mx-auto px-6 pt-10 border-t border-dark-800 text-center"
        >
          <div className="inline-flex items-center space-x-2 text-gold-500/50 text-sm font-mono uppercase tracking-widest">
            <span className="animate-pulse">●</span>
            <span>System Operational</span>
          </div>
          <p className="text-gray-600 text-sm mt-4">
            &copy; 2025 BAR Web. Zero logs policy enforced.
          </p>
        </motion.div>

      </main>
    </div>
  );
};

export default LandingPage;
