import React from 'react';
import { Lock, Shield, Zap } from 'lucide-react';

const ContainerAnimation = ({ isSealing }) => {
  if (!isSealing) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-dark-800 border-2 border-gold-500 rounded-xl p-12 max-w-md w-full mx-4 terminal-glow">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 border-4 border-gold-500/30 rounded-full animate-ping"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 border-4 border-gold-500 rounded-full animate-spin border-t-transparent"></div>
            </div>
            <div className="relative flex items-center justify-center pt-8">
              <Lock className="text-gold-500 animate-pulse" size={64} />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-gold-500 text-shadow-gold">
              Sealing Container
            </h3>
            
            <div className="space-y-2 text-left">
              <div className="flex items-center space-x-3 text-gray-300">
                <Shield className="text-green-500 animate-pulse" size={20} />
                <span className="font-mono text-sm">Encrypting file data...</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-300">
                <Zap className="text-yellow-500 animate-pulse" size={20} />
                <span className="font-mono text-sm">Applying security rules...</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-300">
                <Lock className="text-gold-500 animate-pulse" size={20} />
                <span className="font-mono text-sm">Generating .BAR container...</span>
              </div>
            </div>

            <div className="mt-6 h-2 bg-dark-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold-600 to-gold-400 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContainerAnimation;
