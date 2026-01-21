import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Zap,
  Lock,
  Clock,
  PackageOpen,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import WakeUpButton from "./WakeUpButton";

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Shield,
      title: "AES-256 Encryption",
      description: "Military-grade encryption used by governments.",
      gradient: "from-emerald-500 to-green-600",
      borderColor: "group-hover:border-emerald-500/30",
      iconBg: "bg-emerald-500/10 group-hover:bg-emerald-500/20",
      iconColor: "text-emerald-400",
    },
    {
      icon: Zap,
      title: "Self-Destruct",
      description: "Files vanish automatically after viewing.",
      gradient: "from-amber-500 to-orange-600",
      borderColor: "group-hover:border-amber-500/30",
      iconBg: "bg-amber-500/10 group-hover:bg-amber-500/20",
      iconColor: "text-amber-400",
    },
    {
      icon: Lock,
      title: "Zero Knowledge",
      description: "We cannot see your data. Only you have the key.",
      gradient: "from-purple-500 to-violet-600",
      borderColor: "group-hover:border-purple-500/30",
      iconBg: "bg-purple-500/10 group-hover:bg-purple-500/20",
      iconColor: "text-purple-400",
    },
    {
      icon: Clock,
      title: "Custom Expiry",
      description: "Set exact time limits for file availability.",
      gradient: "from-blue-500 to-cyan-600",
      borderColor: "group-hover:border-blue-500/30",
      iconBg: "bg-blue-500/10 group-hover:bg-blue-500/20",
      iconColor: "text-blue-400",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0d0d0d] to-[#121212] text-white font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">

      {/* Enhanced Background Elements - Minimal & Subtle */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gradient Orbs - Static, just for depth */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] opacity-40" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] opacity-30" />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-purple-500/5" />
      </div>

      {/* Modern Grid Overlay */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none z-0" />

      {/* Glassmorphic Navbar */}
      <nav className="fixed top-0 w-full z-50 glass-navbar">
        <div className="container mx-auto px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="p-2.5 bg-gradient-to-br from-amber-500/10 to-amber-600/10 rounded-xl group-hover:from-amber-500/20 group-hover:to-amber-600/20 transition-all duration-300 border border-amber-500/20">
              <PackageOpen className="text-amber-500 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">BAR Web</span>
          </div>
          <div className="flex items-center space-x-4 sm:space-x-6">
            <a href="https://rolan-rnr.netlify.app" target="_blank" rel="noreferrer" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors duration-300">Portfolio</a>
            <a href="https://github.com/Mrtracker-new/BAR_RYY" target="_blank" rel="noreferrer" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors duration-300">GitHub</a>
          </div>
        </div>
      </nav>

      <main className="relative pt-32 pb-20 z-10">

        {/* Hero Section with Glassmorphism */}
        <section className="container mx-auto px-6 text-center min-h-[65vh] flex flex-col items-center justify-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-5xl mx-auto"
          >
            {/* Status Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-white/20 glass-card text-zinc-300 text-xs font-medium mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Secure File Transmission Protocol</span>
            </motion.div>

            {/* Glass Hero Card */}
            <div className="glass-hero rounded-3xl p-8 sm:p-12 mb-8">
              <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-6 leading-[0.9]">
                <span className="block gradient-text-amber glow-text">Burn After</span>
                <span className="block text-zinc-400 mt-2">Reading</span>
              </h1>

              <p className="text-xl md:text-2xl text-zinc-300 max-w-2xl mx-auto leading-relaxed text-balance font-light">
                The most secure way to send sensitive documents.
                <br />
                <span className="text-amber-400/80">Encrypted, anonymous, and designed to disappear.</span>
              </p>
            </div>

            {/* CTA Section */}
            <div className="flex flex-col items-center justify-center gap-4 pt-4">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/app')}
                  className="group w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-lg rounded-2xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/20 hover:shadow-2xl hover:shadow-amber-500/30 border border-amber-400/50"
                >
                  <span>Start Sealing</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
                <WakeUpButton />
              </div>

              <p className="text-xs text-zinc-500 max-w-md text-center mt-3 px-4 py-2 glass-card rounded-lg">
                💤 Server sleeps after inactivity (free tier). Click "Wake Server" if idle (~50s wake time).
              </p>
            </div>
          </motion.div>
        </section>

        {/* Features Grid with Glass Cards */}
        <section className="container mx-auto px-6 py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-center mb-12 gradient-text-primary"
          >
            Security Features
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className={`group relative p-8 glass-card rounded-3xl transition-all duration-300 border-2 border-white/5 ${feature.borderColor}`}
              >
                {/* Top accent line - clean with subtle glow */}
                <div className={`absolute -top-px left-4 right-4 h-1 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full shadow-lg`} />

                <div className={`w-14 h-14 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-6 transition-all duration-300`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>

                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-white group-hover:to-zinc-300 transition-all duration-300">
                  {feature.title}
                </h3>

                <p className="text-base text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors duration-300">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="container mx-auto px-6 pt-20 mt-12 border-t border-white/10 text-center">
          <div className="glass-card inline-block px-6 py-3 rounded-full">
            <p className="text-zinc-400 text-sm">
              &copy; 2025 <span className="text-amber-400 font-semibold">BAR Web</span>. Built for privacy.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
};

export default LandingPage;
