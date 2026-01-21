import React, { useState, useEffect } from "react";
import { Loader, CheckCircle, XCircle, Power, Clock } from "lucide-react";

const WakeUpButton = () => {
    const [status, setStatus] = useState("idle"); // idle, loading, success, error, cooldown
    const [cooldownTime, setCooldownTime] = useState(0);

    // Rate limiting: 30 seconds cooldown between requests
    const COOLDOWN_DURATION = 30000; // 30 seconds
    const COOLDOWN_KEY = 'wakeup_last_attempt';

    // Check if user is on cooldown
    const isOnCooldown = () => {
        const lastAttempt = localStorage.getItem(COOLDOWN_KEY);
        if (!lastAttempt) return false;

        const timeSinceLastAttempt = Date.now() - parseInt(lastAttempt, 10);
        return timeSinceLastAttempt < COOLDOWN_DURATION;
    };

    // Calculate remaining cooldown time
    const getRemainingCooldown = () => {
        const lastAttempt = localStorage.getItem(COOLDOWN_KEY);
        if (!lastAttempt) return 0;

        const timeSinceLastAttempt = Date.now() - parseInt(lastAttempt, 10);
        const remaining = COOLDOWN_DURATION - timeSinceLastAttempt;
        return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    };

    // Check cooldown on mount
    useEffect(() => {
        if (isOnCooldown()) {
            const remaining = getRemainingCooldown();
            setCooldownTime(remaining);
            setStatus("cooldown");
        }
    }, []);

    // Update cooldown timer
    useEffect(() => {
        if (status === "cooldown") {
            const interval = setInterval(() => {
                const remaining = getRemainingCooldown();
                setCooldownTime(remaining);

                if (remaining <= 0) {
                    setStatus("idle");
                    clearInterval(interval);
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [status]);

    const handleWakeUp = async () => {
        // Check rate limiting
        if (isOnCooldown()) {
            const remaining = getRemainingCooldown();
            setCooldownTime(remaining);
            setStatus("cooldown");
            return;
        }

        setStatus("loading");
        localStorage.setItem(COOLDOWN_KEY, Date.now().toString());

        try {
            // Get the actual backend URL - use env var or default to localhost:8000
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

            // Make a direct health check request to the backend server (not using axios instance)
            // This bypasses Vite proxy and ensures we're checking the actual backend
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

            const response = await fetch(`${backendUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
                mode: 'cors', // Explicitly handle CORS
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            setStatus("success");

            // Reset after 3 seconds, then go to cooldown
            setTimeout(() => {
                const remaining = getRemainingCooldown();
                if (remaining > 0) {
                    setCooldownTime(remaining);
                    setStatus("cooldown");
                } else {
                    setStatus("idle");
                }
            }, 3000);

        } catch (error) {
            // Clear the rate limit on error so user can retry
            localStorage.removeItem(COOLDOWN_KEY);

            setStatus("error");

            // Better error handling
            console.error('Wake up error:', error);

            // Reset after 3 seconds
            setTimeout(() => {
                setStatus("idle");
            }, 3000);
        }
    };

    const getButtonContent = () => {
        switch (status) {
            case "loading":
                return (
                    <div className="relative z-10 flex items-center gap-1">
                        <Loader className="w-5 h-5 animate-spin" />
                        <span>Waking...</span>
                    </div>
                );
            case "success":
                return (
                    <div className="relative z-10 flex items-center gap-1">
                        <CheckCircle className="w-5 h-5" />
                        <span>Ready!</span>
                    </div>
                );
            case "error":
                return (
                    <div className="relative z-10 flex items-center gap-1">
                        <XCircle className="w-5 h-5" />
                        <span>Failed - Retry</span>
                    </div>
                );
            case "cooldown":
                return (
                    <div className="relative z-10 flex items-center gap-1">
                        <Clock className="w-5 h-5" />
                        <span>Wait {cooldownTime}s</span>
                    </div>
                );
            default:
                return (
                    <div className="relative z-10 flex items-center gap-1">
                        <Power className="w-5 h-5" />
                        <span>Wake Server</span>
                    </div>
                );
        }
    };

    const getButtonStyles = () => {
        const baseStyles =
            "relative w-full sm:w-auto sm:min-w-[180px] px-8 py-3.5 rounded-xl font-semibold text-lg transition-all duration-500 flex items-center justify-center overflow-hidden group";

        switch (status) {
            case "loading":
                return `${baseStyles} bg-amber-500/10 border border-amber-500/30 text-amber-400 backdrop-blur-md shadow-lg shadow-amber-500/10 animate-pulse cursor-wait`;
            case "success":
                return `${baseStyles} bg-green-500/10 border border-green-500/30 text-green-400 backdrop-blur-md shadow-lg shadow-green-500/10 cursor-default`;
            case "error":
                return `${baseStyles} bg-red-500/10 border border-red-500/30 text-red-400 backdrop-blur-md shadow-lg shadow-red-500/10 hover:bg-red-500/20`;
            case "cooldown":
                return `${baseStyles} bg-blue-500/10 border border-blue-500/30 text-blue-400 backdrop-blur-md shadow-lg shadow-blue-500/10 cursor-not-allowed`;
            default:
                return `${baseStyles} bg-white/5 border border-white/10 text-white backdrop-blur-md hover:bg-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-white/5`;
        }
    };

    const isDisabled = status === "loading" || status === "success" || status === "cooldown";

    return (
        <button
            onClick={handleWakeUp}
            disabled={isDisabled}
            className={getButtonStyles()}
            title={
                status === "cooldown"
                    ? `Please wait ${cooldownTime} seconds before trying again`
                    : "Wake up the Render server"
            }
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
            {getButtonContent()}
        </button>
    );
};

export default WakeUpButton;
