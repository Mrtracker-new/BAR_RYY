import React, { useState, useEffect } from 'react';
import axios from '../config/axios';
import { BarChart3, Globe, Smartphone, Clock, Eye, MapPin, RefreshCw, X } from 'lucide-react';

const AnalyticsDashboard = ({ token, analyticsKey, onClose }) => {
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
      const response = await axios.get(`${backendUrl}/analytics/${token}`, {
        // Transmit the analytics key as a custom header rather than a query
        // parameter.  Query parameters are logged verbatim in server access
        // logs, stored in browser history, and forwarded in the Referer header
        // to any third-party resources on the page — none of which is
        // acceptable for a secret credential.
        headers: { 'X-Analytics-Key': analyticsKey },
      });
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
      <div className="fixed inset-0 bg-[#2A2018]/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#B4791E] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[#55483A] text-sm">Loading insights...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#2A2018]/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
        <div className="bg-[#FAF4E6] border border-red-500/20 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <h3 className="text-lg font-bold text-[#B33A2E] mb-2">Unavailable</h3>
          <p className="text-[#55483A] text-sm mb-6">{error}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-[#F1E8D3] hover:bg-[#E6D9BC] text-[#2A2018] font-medium rounded-xl transition-all text-sm"
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
    <div className="fixed inset-0 bg-[#2A2018]/40 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#FAF4E6] border border-[#3c2d14]/12 rounded-2xl w-full max-w-5xl my-4 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#3c2d14]/12 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#B4791E]/10 rounded-lg">
              <BarChart3 className="text-[#B4791E]" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2A2018] tracking-tight">Analytics</h2>
              <p className="text-xs text-[#857358] font-mono truncate max-w-[200px] sm:max-w-md">
                {file.filename}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2.5 text-[#55483A] hover:text-[#2A2018] hover:bg-[#3c2d14]/6 rounded-lg transition-all"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 text-[#55483A] hover:text-[#2A2018] hover:bg-[#3c2d14]/6 rounded-lg transition-all"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#F1E8D3] rounded-xl p-5 border border-[#3c2d14]/12">
              <div className="flex items-center space-x-2 mb-2 text-[#55483A]">
                <Eye size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Total Views</span>
              </div>
              <p className="text-3xl font-bold text-[#2A2018] tracking-tight">{total_accesses}</p>
              <p className="text-xs text-[#857358] mt-1">
                {file.current_views} / {file.max_views} limit
              </p>
            </div>

            <div className="bg-[#F1E8D3] rounded-xl p-5 border border-[#3c2d14]/12">
              <div className="flex items-center space-x-2 mb-2 text-[#55483A]">
                <Globe size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Unique IPs</span>
              </div>
              <p className="text-3xl font-bold text-[#2A2018] tracking-tight">{unique_ips}</p>
              <p className="text-xs text-[#857358] mt-1">Different visitors</p>
            </div>

            <div className="bg-[#F1E8D3] rounded-xl p-5 border border-[#3c2d14]/12">
              <div className="flex items-center space-x-2 mb-2 text-[#55483A]">
                <MapPin size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Counties</span>
              </div>
              <p className="text-3xl font-bold text-[#2A2018] tracking-tight">{countries.length}</p>
              <p className="text-xs text-[#857358] mt-1">Global reach</p>
            </div>

            <div className="bg-[#F1E8D3] rounded-xl p-5 border border-[#3c2d14]/12">
              <div className="flex items-center space-x-2 mb-2 text-[#55483A]">
                <Smartphone size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Devices</span>
              </div>
              <p className="text-3xl font-bold text-[#2A2018] tracking-tight">
                {Object.keys(device_types).length}
              </p>
              <p className="text-xs text-[#857358] mt-1">Platforms</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Device Breakdown */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#2A2018] flex items-center">
                <Smartphone className="mr-2 text-[#B4791E]" size={16} />
                Device Types
              </h3>
              <div className="space-y-2">
                {Object.entries(device_types).map(([device, count]) => (
                  <div key={device} className="bg-[#F1E8D3] rounded-lg p-3 border border-[#3c2d14]/12 flex justify-between items-center">
                    <span className="text-[#55483A] text-sm">{device || 'Unknown'}</span>
                    <span className="text-[#2A2018] font-mono font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(device_types).length === 0 && (
                  <p className="text-sm text-[#A2916F] italic">No device data yet.</p>
                )}
              </div>
            </div>

            {/* Countries */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#2A2018] flex items-center">
                <MapPin className="mr-2 text-[#B4791E]" size={16} />
                Locations
              </h3>
              <div className="flex flex-wrap gap-2">
                {countries.map((country) => (
                  <span
                    key={country}
                    className="px-3 py-1.5 bg-[#F1E8D3] border border-[#3c2d14]/12 rounded-md text-sm text-[#2A2018]"
                  >
                    {country}
                  </span>
                ))}
                {countries.length === 0 && (
                  <p className="text-sm text-[#A2916F] italic">No location data yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Access Logs */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#2A2018] flex items-center">
              <Clock className="mr-2 text-[#B4791E]" size={16} />
              Recent Activity
            </h3>
            <div className="overflow-hidden rounded-xl border border-[#3c2d14]/12">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F1E8D3] text-[#55483A] uppercase text-xs">
                  <tr>
                    <th className="p-4 font-medium">Time</th>
                    <th className="p-4 font-medium">Location</th>
                    <th className="p-4 font-medium">Device</th>
                    <th className="p-4 font-medium text-right">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3c2d14]/12 bg-[#FAF4E6]">
                  {access_logs.slice(0, 10).map((log, idx) => (
                    <tr key={idx} className="hover:bg-[#F1E8D3] transition-colors">
                      <td className="p-4 text-[#2A2018] whitespace-nowrap">
                        {new Date(log.accessed_at).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4 text-[#2A2018]">
                        {log.city && log.country ? `${log.city}, ${log.country}` : log.country || '-'}
                      </td>
                      <td className="p-4 text-[#55483A]">{log.device_type || '-'}</td>
                      <td className="p-4 text-[#857358] font-mono text-xs text-right opacity-50">{log.ip_address}</td>
                    </tr>
                  ))}
                  {access_logs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-[#A2916F] italic">
                        No activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {access_logs.length > 10 && (
              <p className="text-center text-[#857358] text-xs mt-2">
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
