import React from "react";
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
  Key,
  Bell,
} from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Shield,
      title: "AES-256 Encryption",
      description: "Military-grade encryption used by banks and governments",
      color: "text-green-400",
      bgColor: "bg-green-500/20",
      borderColor: "border-green-500/30",
    },
    {
      icon: Zap,
      title: "Self-Destruct Files",
      description: "Files automatically delete after viewing or expiration",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
      borderColor: "border-yellow-500/30",
    },
    {
      icon: Lock,
      title: "Password Protection",
      description: "Zero-knowledge encryption with PBKDF2 key derivation",
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
      borderColor: "border-purple-500/30",
    },
    {
      icon: Clock,
      title: "Time-Based Expiry",
      description: "Set custom expiration times for your sensitive files",
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/30",
    },
    {
      icon: Ban,
      title: "Brute Force Protection",
      description: "Progressive delays and lockouts prevent password attacks",
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
    },
    {
      icon: Smartphone,
      title: "2FA Support",
      description: "Email OTP authentication for enhanced security",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
      borderColor: "border-cyan-500/30",
    },
    {
      icon: Eye,
      title: "View Limits",
      description: "Control exactly how many times files can be accessed",
      color: "text-orange-400",
      bgColor: "bg-orange-500/20",
      borderColor: "border-orange-500/30",
    },
    {
      icon: Bell,
      title: "Webhook Alerts",
      description: "Real-time Discord/Slack notifications for file events",
      color: "text-pink-400",
      bgColor: "bg-pink-500/20",
      borderColor: "border-pink-500/30",
    },
  ];

  return (
    <div className="min-h-screen bg-dark-900 text-white overflow-hidden">
      {/* Animated Background - Subtle gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold-600/5 rounded-full blur-3xl animate-float-slow" style={{animationDelay: '3s'}}></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gold-400/3 rounded-full blur-3xl animate-float-slow" style={{animationDelay: '1.5s'}}></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-dark-700 bg-dark-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="p-2 bg-gradient-to-br from-gold-500 to-gold-600 rounded-xl shadow-lg shadow-gold-500/20 transition-all duration-300 hover:shadow-gold-500/40 hover:scale-105">
              <PackageOpen className="text-black" size={28} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 bg-clip-text text-transparent">
                BAR Web
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm font-medium">
                🔒 Burn After Reading
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative">
        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Main Title */}
            <div className="space-y-4">
              <h2 className="text-5xl sm:text-7xl md:text-8xl font-black bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 bg-clip-text text-transparent">
                BAR
              </h2>
              <div className="flex items-center justify-center space-x-2 sm:space-x-3">
                <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-gold-500 to-transparent"></div>
                <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-300">
                  Burn After Reading
                </p>
                <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-gold-500 to-transparent"></div>
              </div>
            </div>

            {/* Description */}
            <p className="text-lg sm:text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Send files that{" "}
              <span className="text-gold-400 font-semibold">self-destruct</span>{" "}
              after viewing. Mission Impossible-style file sharing with{" "}
              <span className="text-gold-400 font-semibold">
                military-grade encryption
              </span>
              . No traces. No recovery. Just like the movies.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto py-8">
              <div className="p-4 bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl border border-dark-700 hover:border-gold-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-2xl sm:text-3xl font-bold text-gold-500">
                  AES-256
                </div>
                <div className="text-xs sm:text-sm text-gray-400 mt-1">
                  Encryption
                </div>
              </div>
              <div className="p-4 bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl border border-dark-700 hover:border-gold-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-2xl sm:text-3xl font-bold text-gold-500">
                  100K
                </div>
                <div className="text-xs sm:text-sm text-gray-400 mt-1">
                  PBKDF2 Iterations
                </div>
              </div>
              <div className="p-4 bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl border border-dark-700 hover:border-gold-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-2xl sm:text-3xl font-bold text-gold-500">
                  100MB
                </div>
                <div className="text-xs sm:text-sm text-gray-400 mt-1">
                  Max File Size
                </div>
              </div>
              <div className="p-4 bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl border border-dark-700 hover:border-gold-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-2xl sm:text-3xl font-bold text-gold-500">
                  Zero
                </div>
                <div className="text-xs sm:text-sm text-gray-400 mt-1">
                  Knowledge
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => navigate("/app")}
              className="group relative inline-flex items-center space-x-3 px-8 sm:px-12 py-4 sm:py-6 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-bold text-lg sm:text-xl rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-gold-500/30 hover:shadow-xl hover:shadow-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-dark-900"
            >
              <span>🔥</span>
              <span>Start Hiding</span>
              <span className="transform transition-transform duration-200 ease-out group-hover:translate-x-1">
                →
              </span>
            </button>

            <p className="text-sm text-gray-500">
              No sign-up required • Free forever • Open source
            </p>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent mb-4">
                Fort Knox-Level Security
              </h3>
              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
                Every feature designed to keep your sensitive files secure and
                self-destructing on your terms
              </p>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className={`group p-6 bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border ${feature.borderColor} hover:border-gold-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-gold-500/10`}
                  >
                    <div
                      className={`inline-flex p-3 ${feature.bgColor} rounded-xl mb-4 group-hover:scale-105 transition-all duration-300 ease-out`}
                    >
                      <Icon className={`${feature.color} transition-transform duration-300 group-hover:rotate-3`} size={24} />
                    </div>
                    <h4
                      className={`font-bold text-base sm:text-lg mb-2 ${feature.color}`}
                    >
                      {feature.title}
                    </h4>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent mb-4">
                How It Works
              </h3>
              <p className="text-lg sm:text-xl text-gray-400">
                Simple, secure, and self-destructing
              </p>
            </div>

            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "Upload Your File",
                  description:
                    "Drag and drop any file up to 100MB. Your file is encrypted immediately.",
                  icon: "📤",
                },
                {
                  step: "2",
                  title: "Set Security Rules",
                  description:
                    "Choose storage mode, set password, view limits, expiry time, and more.",
                  icon: "⚙️",
                },
                {
                  step: "3",
                  title: "Share Securely",
                  description:
                    "Get a shareable link or download the encrypted .BAR file to share.",
                  icon: "🔗",
                },
                {
                  step: "4",
                  title: "Auto-Destruct",
                  description:
                    "File self-destructs after reaching view limit or expiry time. No traces left.",
                  icon: "💥",
                },
              ].map((step, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-4 sm:space-x-6 p-6 bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700 hover:border-gold-500/50 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-gold-500 to-gold-600 rounded-xl text-2xl sm:text-3xl font-bold text-black shadow-lg">
                      {step.step}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-2xl">{step.icon}</span>
                      <h4 className="text-lg sm:text-xl font-bold text-gold-400">
                        {step.title}
                      </h4>
                    </div>
                    <p className="text-gray-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Final CTA */}
            <div className="text-center mt-12 sm:mt-16">
              <button
                onClick={() => navigate("/app")}
                className="group inline-flex items-center space-x-3 px-10 sm:px-14 py-4 sm:py-5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-bold text-lg sm:text-xl rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-gold-500/30 hover:shadow-xl hover:shadow-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-dark-900"
              >
                <span>🚀</span>
                <span>Try It Now</span>
                <span className="transform transition-transform duration-200 ease-out group-hover:translate-x-1">
                  →
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-dark-700 mt-12 sm:mt-20">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-sm sm:text-base">
          <p>BAR Web - Burn After Reading © 2025</p>
          <p className="mt-2 text-xs sm:text-sm">
            Secure file encryption with self-destruct capabilities
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
