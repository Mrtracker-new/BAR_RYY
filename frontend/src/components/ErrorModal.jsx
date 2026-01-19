import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, X } from 'lucide-react';

const ErrorModal = ({ error, onClose }) => {
    // Auto-dismiss after 8 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                onClose();
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [error, onClose]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (error) {
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }
    }, [error, onClose]);

    return (
        <AnimatePresence>
            {error && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", duration: 0.5 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative max-w-md w-full"
                        >
                            {/* Glassmorphic Container */}
                            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-xl border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden">
                                {/* Accent Glow */}
                                <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 via-transparent to-transparent opacity-50 pointer-events-none" />

                                {/* Content */}
                                <div className="relative p-6 sm:p-8">
                                    {/* Close Button */}
                                    <button
                                        onClick={onClose}
                                        className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors group"
                                        aria-label="Close"
                                    >
                                        <X className="text-red-400 group-hover:text-red-300" size={20} />
                                    </button>

                                    {/* Icon */}
                                    <div className="flex items-center justify-center mb-4">
                                        <div className="p-3 bg-red-500/20 rounded-full">
                                            <XCircle className="text-red-400" size={48} />
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-3">
                                        Validation Error
                                    </h3>

                                    {/* Error Message */}
                                    <div className="bg-black/30 border border-red-500/20 rounded-xl p-4 mb-6">
                                        <p className="text-red-200 text-sm sm:text-base text-center leading-relaxed">
                                            {error}
                                        </p>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 px-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 hover:border-red-500/60 text-red-300 hover:text-red-200 font-medium rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
                                    >
                                        <span>Got it</span>
                                    </button>

                                    {/* Auto-dismiss indicator */}
                                    <p className="text-center text-red-400/60 text-xs mt-3">
                                        Auto-dismisses in 8 seconds • Press ESC to close
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ErrorModal;
