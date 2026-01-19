import React, { useState } from "react";
import { Loader, CheckCircle, XCircle, Power } from "lucide-react";

const WakeUpButton = () => {
    const [status, setStatus] = useState("idle"); // idle, loading, success, error

    const handleWakeUp = async () => {
        setStatus("loading");

        try {
            // Get the actual backend URL - use env var or default to localhost:8000
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

            // Make a direct health check request to the backend server (not using axios instance)
            // This bypasses Vite proxy and ensures we're checking the actual backend
            const response = await fetch(`${backendUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(60000) // 60 second timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            setStatus("success");

            // Reset after 2.5 seconds
            setTimeout(() => {
                setStatus("idle");
            }, 2500);
        } catch (error) {
            setStatus("error");

            // Reset after 2.5 seconds
            setTimeout(() => {
                setStatus("idle");
            }, 2500);
        }
    };

    const getButtonContent = () => {
        switch (status) {
            case "loading":
                return (
                    <>
                        <Loader className="w-5 h-5 animate-spin" />
                        <span>Waking...</span>
                    </>
                );
            case "success":
                return (
                    <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Ready!</span>
                    </>
                );
            case "error":
                return (
                    <>
                        <XCircle className="w-5 h-5" />
                        <span>Retry</span>
                    </>
                );
            default:
                return (
                    <>
                        <Power className="w-5 h-5" />
                        <span>Wake Server</span>
                    </>
                );
        }
    };

    const getButtonStyles = () => {
        const baseStyles =
            "relative w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-lg transition-all duration-500 flex items-center justify-center space-x-2 overflow-hidden group";

        switch (status) {
            case "loading":
                return `${baseStyles} bg-amber-500/10 border border-amber-500/30 text-amber-400 backdrop-blur-md shadow-lg shadow-amber-500/10 animate-pulse`;
            case "success":
                return `${baseStyles} bg-green-500/10 border border-green-500/30 text-green-400 backdrop-blur-md shadow-lg shadow-green-500/10`;
            case "error":
                return `${baseStyles} bg-red-500/10 border border-red-500/30 text-red-400 backdrop-blur-md shadow-lg shadow-red-500/10 hover:bg-red-500/20`;
            default:
                return `${baseStyles} bg-white/5 border border-white/10 text-white backdrop-blur-md hover:bg-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-white/5`;
        }
    };

    return (
        <button
            onClick={handleWakeUp}
            disabled={status === "loading" || status === "success"}
            className={getButtonStyles()}
            title="Wake up the Render server"
        >
            {/* Multi-layered glassmorphic background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-50" />

            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

            {/* Pulsing glow on loading */}
            {status === "loading" && (
                <div className="absolute inset-0 bg-amber-500/20 animate-pulse rounded-lg" />
            )}

            {/* Content */}
            <div className="relative z-10 flex items-center space-x-2">
                {getButtonContent()}
            </div>
        </button>
    );
};

export default WakeUpButton;
