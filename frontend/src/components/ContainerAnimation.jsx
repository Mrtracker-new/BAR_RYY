import React from 'react';
import { Lock, Shield, Zap } from 'lucide-react';

const ContainerAnimation = ({ isSealing }) => {
  if (!isSealing) return null;

  return (
    <div className="fixed inset-0 bg-[#2A2018]/35 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#FAF4E6] border border-[#3c2d14]/16 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
        <div className="text-center space-y-6">

          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-[#B4791E]/25 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-[#B4791E] rounded-full border-t-transparent animate-spin"></div>
            <Lock className="absolute text-[#B4791E]" size={24} />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#2A2018]">
              Sealing Container
            </h3>

            <div className="space-y-3 text-left">
              <div className="flex items-center space-x-3 text-[#55483A]">
                <Shield className="text-[#3F7D3A]/80" size={16} />
                <span className="text-sm">Encrypting file data...</span>
              </div>
              <div className="flex items-center space-x-3 text-[#55483A]">
                <Zap className="text-[#B4791E]/80" size={16} />
                <span className="text-sm">Applying security rules...</span>
              </div>
              <div className="flex items-center space-x-3 text-[#55483A]">
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
