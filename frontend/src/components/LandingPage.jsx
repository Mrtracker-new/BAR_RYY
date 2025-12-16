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
      color: "text-amber-500",
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
    <div className="min-h-screen bg-[#0d0d0d] text-white font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">

      {/* Subtle Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-amber-500/5 to-transparent opacity-60" />
      </div>

      {/* Modern Grid Overlay */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
              <PackageOpen className="text-amber-500 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-white">BAR Web</span>
          </div>
          <div className="flex items-center space-x-4">
            <a href="https://github.com/Mrtracker-new" target="_blank" rel="noreferrer" className="hidden sm:inline-block text-sm text-zinc-400 hover:text-white transition-colors">GitHub</a>
            <button
              onClick={() => navigate('/app')}
              className="px-5 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Launch App
            </button>
          </div>
        </div>
      </nav>

      <main className="relative pt-32 pb-20 z-10">

        {/* Hero Section */}
        <section className="container mx-auto px-6 text-center min-h-[60vh] flex flex-col items-center justify-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-zinc-400 text-xs font-medium mb-4">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span>Secure File Transmission Protocol</span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter text-balance">
              <span className="block text-white">Burn After</span>
              <span className="text-zinc-500">Reading</span>
            </h1>

            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed text-balance">
              The most secure way to send sensitive documents.
              Encrypted, anonymous, and designed to disappear.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
              <button
                onClick={() => navigate('/app')}
                className="w-full sm:w-auto px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-lg rounded-xl transition-all flex items-center justify-center space-x-2"
              >
                <span>Start Sealing</span>
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => window.open('https://github.com/Mrtracker-new', '_blank')}
                className="w-full sm:w-auto px-8 py-3.5 bg-transparent border border-zinc-700 hover:bg-zinc-800 text-white font-medium text-lg rounded-xl transition-all"
              >
                Documentation
              </button>
            </div>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group p-6 bg-zinc-900/50 border border-white/5 rounded-2xl hover:bg-zinc-900 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4">
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Simple Footer Text */}
        <div className="container mx-auto px-6 pt-20 border-t border-white/5 text-center">
          <p className="text-zinc-600 text-sm">
            &copy; 2025 BAR Web. Built for privacy.
          </p>
        </div>

      </main>
    </div>
  );
};

export default LandingPage;
