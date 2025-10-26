import React, { useState, useEffect } from 'react';
import axios from '../config/axios';
import { BarChart3, Globe, Smartphone, Clock, Eye, MapPin, RefreshCw } from 'lucide-react';

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
        <div className="text-gold-500 text-xl">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-dark-800 border border-red-500 rounded-xl p-8 max-w-md">
          <h3 className="text-xl font-bold text-red-500 mb-4">Error</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gold-500 hover:bg-gold-600 text-black font-bold rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const { file, access_logs, total_accesses, unique_ips, countries, device_types } = analytics;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-dark-800 border border-gold-500 rounded-xl w-full max-w-6xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <div className="flex items-center space-x-3">
            <BarChart3 className="text-gold-500" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-gold-500">Analytics Dashboard</h2>
              <p className="text-sm text-gray-400 font-mono truncate max-w-md">
                {file.filename}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="px-4 py-2 bg-gold-500/20 hover:bg-gold-500/30 text-gold-500 rounded-lg transition-all flex items-center space-x-2 border border-gold-500/30"
              title="Refresh analytics"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg transition-all"
            >
              Close
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-dark-900">
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Eye className="text-blue-400" size={20} />
              <span className="text-gray-400 text-sm">Total Views</span>
            </div>
            <p className="text-3xl font-bold text-white">{total_accesses}</p>
            <p className="text-xs text-gray-500 mt-1">
              {file.current_views} / {file.max_views} limit
            </p>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Globe className="text-green-400" size={20} />
              <span className="text-gray-400 text-sm">Unique IPs</span>
            </div>
            <p className="text-3xl font-bold text-white">{unique_ips}</p>
            <p className="text-xs text-gray-500 mt-1">Different visitors</p>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="text-purple-400" size={20} />
              <span className="text-gray-400 text-sm">Countries</span>
            </div>
            <p className="text-3xl font-bold text-white">{countries.length}</p>
            <p className="text-xs text-gray-500 mt-1">Locations</p>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Smartphone className="text-orange-400" size={20} />
              <span className="text-gray-400 text-sm">Devices</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {Object.keys(device_types).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Device types</p>
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="p-6 border-t border-dark-700">
          <h3 className="text-lg font-semibold text-gold-500 mb-4 flex items-center">
            <Smartphone className="mr-2" size={20} />
            Device Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(device_types).map(([device, count]) => (
              <div key={device} className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                <p className="text-gray-400 text-sm">{device}</p>
                <p className="text-2xl font-bold text-white">{count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div className="p-6 border-t border-dark-700">
          <h3 className="text-lg font-semibold text-gold-500 mb-4 flex items-center">
            <MapPin className="mr-2" size={20} />
            Geographic Distribution
          </h3>
          <div className="flex flex-wrap gap-2">
            {countries.map((country) => (
              <span
                key={country}
                className="px-3 py-1 bg-dark-900 border border-dark-700 rounded-full text-sm text-gray-300"
              >
                🌍 {country}
              </span>
            ))}
          </div>
        </div>

        {/* Access Logs */}
        <div className="p-6 border-t border-dark-700">
          <h3 className="text-lg font-semibold text-gold-500 mb-4 flex items-center">
            <Clock className="mr-2" size={20} />
            Recent Access Log
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left p-3 text-gray-400 font-medium">Timestamp</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Location</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Device</th>
                  <th className="text-left p-3 text-gray-400 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {access_logs.slice(0, 10).map((log, idx) => (
                  <tr key={idx} className="border-b border-dark-800 hover:bg-dark-900">
                    <td className="p-3 text-gray-300">
                      {new Date(log.accessed_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-gray-300">
                      {log.city && log.country ? `${log.city}, ${log.country}` : log.country || 'Unknown'}
                    </td>
                    <td className="p-3 text-gray-300">{log.device_type || 'Unknown'}</td>
                    <td className="p-3 text-gray-400 font-mono text-xs">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {access_logs.length > 10 && (
            <p className="text-center text-gray-500 text-sm mt-4">
              Showing 10 of {access_logs.length} total accesses
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
