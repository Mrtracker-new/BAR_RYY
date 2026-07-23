import React from 'react';
import { Loader2, Server, Lock, Shield, Eye } from 'lucide-react';

const STAGE_CONFIG = {
    connecting: {
        icon: Server,
        label: 'Connecting',
        color: 'text-[#2C4A6E]',
        bgColor: 'bg-[#2C4A6E]/12',
        borderColor: 'border-[#2C4A6E]/30',
        progress: 25,
    },
    authenticating: {
        icon: Shield,
        label: 'Authenticating',
        color: 'text-[#6B3FA0]',
        bgColor: 'bg-[#6B3FA0]/12',
        borderColor: 'border-[#6B3FA0]/30',
        progress: 50,
    },
    decrypting: {
        icon: Lock,
        label: 'Decrypting',
        color: 'text-[#CE9530]',
        bgColor: 'bg-[#B4791E]/20',
        borderColor: 'border-[#B4791E]/30',
        progress: 75,
    },
    rendering: {
        icon: Eye,
        label: 'Rendering',
        color: 'text-[#3F7D3A]',
        bgColor: 'bg-[#3F7D3A]/20',
        borderColor: 'border-green-500/30',
        progress: 100,
    },
};

const LoadingStages = ({
    currentStage = 'connecting',
    message,
    estimatedTime = null,
    progress = null
}) => {
    const stageConfig = STAGE_CONFIG[currentStage];
    const Icon = stageConfig?.icon || Loader2;
    const displayProgress = progress !== null ? progress : stageConfig?.progress || 0;

    // Default messages if not provided
    const defaultMessages = {
        connecting: 'Waking up server...',
        authenticating: 'Authenticating request...',
        decrypting: 'Decrypting file...',
        rendering: 'Rendering preview...',
    };

    const displayMessage = message || defaultMessages[currentStage] || 'Processing...';

    return (
        <div className="space-y-4 py-2">
            {/* Main Loading Icon and Status */}
            <div className={`flex items-center justify-center space-x-3 p-4 rounded-xl border ${stageConfig?.bgColor || 'bg-[#F1E8D3]'} ${stageConfig?.borderColor || 'border-[#3c2d14]/16'}`}>
                <Icon className={`${stageConfig?.color || 'text-[#55483A]'} animate-pulse`} size={24} />
                <div className="text-left flex-1">
                    <p className={`font-semibold text-sm ${stageConfig?.color || 'text-[#2A2018]'}`}>
                        {stageConfig?.label || 'Processing'}
                    </p>
                    <p className="text-[#55483A] text-xs mt-0.5">{displayMessage}</p>
                    {estimatedTime && (
                        <p className="text-[#857358] text-xs mt-1">
                            Estimated time: ~{estimatedTime}s
                        </p>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative">
                <div className="h-2 bg-[#F1E8D3] rounded-full overflow-hidden border border-[#3c2d14]/10">
                    <div
                        className={`h-full transition-all duration-700 ease-out ${stageConfig?.color === 'text-[#2C4A6E]' ? 'bg-[#2C4A6E]' :
                                stageConfig?.color === 'text-[#6B3FA0]' ? 'bg-[#6B3FA0]' :
                                    stageConfig?.color === 'text-[#CE9530]' ? 'bg-[#B4791E]' :
                                        stageConfig?.color === 'text-[#3F7D3A]' ? 'bg-[#3F7D3A]' :
                                            'bg-[#C3B48F]'
                            } shadow-lg`}
                        style={{ width: `${displayProgress}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-[#857358]">
                    <span className={currentStage === 'connecting' ? stageConfig?.color : ''}>Connect</span>
                    <span className={currentStage === 'authenticating' ? stageConfig?.color : ''}>Auth</span>
                    <span className={currentStage === 'decrypting' ? stageConfig?.color : ''}>Decrypt</span>
                    <span className={currentStage === 'rendering' ? stageConfig?.color : ''}>Render</span>
                </div>
            </div>

            {/* Stage Indicators */}
            <div className="flex justify-between items-center px-1">
                {Object.entries(STAGE_CONFIG).map(([stage, config], index) => {
                    const StageIcon = config.icon;
                    const isActive = currentStage === stage;
                    const isCompleted = displayProgress > config.progress - 25;

                    return (
                        <div key={stage} className="flex flex-col items-center space-y-1">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 ${isActive
                                        ? `${config.bgColor} ${config.borderColor} scale-110`
                                        : isCompleted
                                            ? 'bg-[#E6D9BC] border-[#D8C9A6]'
                                            : 'bg-[#FAF4E6] border-[#E6D9BC]'
                                    }`}
                            >
                                <StageIcon
                                    size={14}
                                    className={`${isActive ? config.color : isCompleted ? 'text-[#55483A]' : 'text-[#A2916F]'
                                        } ${isActive ? 'animate-pulse' : ''}`}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LoadingStages;
