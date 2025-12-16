import React from 'react';
import { Lock, Shield, Zap } from 'lucide-react';

const ContainerAnimation = ({ isSealing }) => {
  if (!isSealing) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
        <div className="text-center space-y-6">

          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-amber-500/20 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-amber-500 rounded-full border-t-transparent animate-spin"></div>
            <Lock className="absolute text-amber-500" size={24} />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Sealing Container
            </h3>

            <div className="space-y-3 text-left">
              <div className="flex items-center space-x-3 text-zinc-400">
                <Shield className="text-green-500/80" size={16} />
                <span className="text-sm">Encrypting file data...</span>
              </div>
              <div className="flex items-center space-x-3 text-zinc-400">
                <Zap className="text-amber-500/80" size={16} />
                <span className="text-sm">Applying security rules...</span>
              </div>
              <div className="flex items-center space-x-3 text-zinc-400">
                <Lock className="text-purple-500/80" size={16} />
                <span className="text-sm">Generating .BAR container...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContainerAnimation;
