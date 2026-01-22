import React from 'react';
import { Loader2, Server, Lock, Shield, Eye } from 'lucide-react';

const STAGE_CONFIG = {
    connecting: {
        icon: Server,
        label: 'Connecting',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/30',
        progress: 25,
    },
    authenticating: {
        icon: Shield,
        label: 'Authenticating',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        borderColor: 'border-purple-500/30',
        progress: 50,
    },
    decrypting: {
        icon: Lock,
        label: 'Decrypting',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        borderColor: 'border-amber-500/30',
        progress: 75,
    },
    rendering: {
        icon: Eye,
        label: 'Rendering',
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
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
            <div className={`flex items-center justify-center space-x-3 p-4 rounded-xl border ${stageConfig?.bgColor || 'bg-zinc-800/50'} ${stageConfig?.borderColor || 'border-white/10'}`}>
                <Icon className={`${stageConfig?.color || 'text-zinc-400'} animate-pulse`} size={24} />
                <div className="text-left flex-1">
                    <p className={`font-semibold text-sm ${stageConfig?.color || 'text-white'}`}>
                        {stageConfig?.label || 'Processing'}
                    </p>
                    <p className="text-zinc-400 text-xs mt-0.5">{displayMessage}</p>
                    {estimatedTime && (
                        <p className="text-zinc-500 text-xs mt-1">
                            Estimated time: ~{estimatedTime}s
                        </p>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative">
                <div className="h-2 bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
                    <div
                        className={`h-full transition-all duration-700 ease-out ${stageConfig?.color === 'text-blue-400' ? 'bg-blue-500' :
                                stageConfig?.color === 'text-purple-400' ? 'bg-purple-500' :
                                    stageConfig?.color === 'text-amber-400' ? 'bg-amber-500' :
                                        stageConfig?.color === 'text-green-400' ? 'bg-green-500' :
                                            'bg-zinc-500'
                            } shadow-lg`}
                        style={{ width: `${displayProgress}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-zinc-500">
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
                                            ? 'bg-zinc-700 border-zinc-600'
                                            : 'bg-zinc-900 border-zinc-800'
                                    }`}
                            >
                                <StageIcon
                                    size={14}
                                    className={`${isActive ? config.color : isCompleted ? 'text-zinc-400' : 'text-zinc-600'
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
