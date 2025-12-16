import React, { useState, useEffect } from 'react';
import axios from '../config/axios';
import { BarChart3, Globe, Smartphone, Clock, Eye, MapPin, RefreshCw, X } from 'lucide-react';

const AnalyticsDashboard = ({ token, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [token]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await axios.get(`${backendUrl}/analytics/${token}`);
      setAnalytics(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-zinc-400 text-sm">Loading insights...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-6">
        <div className="bg-zinc-900 border border-red-500/20 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <h3 className="text-lg font-bold text-red-400 mb-2">Unavailable</h3>
          <p className="text-zinc-400 text-sm mb-6">{error}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-all text-sm"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const { file, access_logs, total_accesses, unique_ips, countries, device_types } = analytics;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-white/5 rounded-2xl w-full max-w-5xl my-4 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <BarChart3 className="text-amber-500" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Analytics</h2>
              <p className="text-xs text-zinc-500 font-mono truncate max-w-[200px] sm:max-w-md">
                {file.filename}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-800/50 rounded-xl p-5 border border-white/5">
              <div className="flex items-center space-x-2 mb-2 text-zinc-400">
                <Eye size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Total Views</span>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">{total_accesses}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {file.current_views} / {file.max_views} limit
              </p>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-5 border border-white/5">
              <div className="flex items-center space-x-2 mb-2 text-zinc-400">
                <Globe size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Unique IPs</span>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">{unique_ips}</p>
              <p className="text-xs text-zinc-500 mt-1">Different visitors</p>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-5 border border-white/5">
              <div className="flex items-center space-x-2 mb-2 text-zinc-400">
                <MapPin size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Counties</span>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">{countries.length}</p>
              <p className="text-xs text-zinc-500 mt-1">Global reach</p>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-5 border border-white/5">
              <div className="flex items-center space-x-2 mb-2 text-zinc-400">
                <Smartphone size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Devices</span>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">
                {Object.keys(device_types).length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Platforms</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Device Breakdown */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-300 flex items-center">
                <Smartphone className="mr-2 text-amber-500" size={16} />
                Device Types
              </h3>
              <div className="space-y-2">
                {Object.entries(device_types).map(([device, count]) => (
                  <div key={device} className="bg-zinc-800/30 rounded-lg p-3 border border-white/5 flex justify-between items-center">
                    <span className="text-zinc-400 text-sm">{device || 'Unknown'}</span>
                    <span className="text-white font-mono font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(device_types).length === 0 && (
                  <p className="text-sm text-zinc-600 italic">No device data yet.</p>
                )}
              </div>
            </div>

            {/* Countries */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-300 flex items-center">
                <MapPin className="mr-2 text-amber-500" size={16} />
                Locations
              </h3>
              <div className="flex flex-wrap gap-2">
                {countries.map((country) => (
                  <span
                    key={country}
                    className="px-3 py-1.5 bg-zinc-800/30 border border-white/5 rounded-md text-sm text-zinc-300"
                  >
                    {country}
                  </span>
                ))}
                {countries.length === 0 && (
                  <p className="text-sm text-zinc-600 italic">No location data yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Access Logs */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300 flex items-center">
              <Clock className="mr-2 text-amber-500" size={16} />
              Recent Activity
            </h3>
            <div className="overflow-hidden rounded-xl border border-white/5">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs">
                  <tr>
                    <th className="p-4 font-medium">Time</th>
                    <th className="p-4 font-medium">Location</th>
                    <th className="p-4 font-medium">Device</th>
                    <th className="p-4 font-medium text-right">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-zinc-900/50">
                  {access_logs.slice(0, 10).map((log, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="p-4 text-zinc-300 whitespace-nowrap">
                        {new Date(log.accessed_at).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4 text-zinc-300">
                        {log.city && log.country ? `${log.city}, ${log.country}` : log.country || '-'}
                      </td>
                      <td className="p-4 text-zinc-400">{log.device_type || '-'}</td>
                      <td className="p-4 text-zinc-500 font-mono text-xs text-right opacity-50">{log.ip_address}</td>
                    </tr>
                  ))}
                  {access_logs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-zinc-600 italic">
                        No activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {access_logs.length > 10 && (
              <p className="text-center text-zinc-500 text-xs mt-2">
                Showing last 10 of {access_logs.length} events
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
