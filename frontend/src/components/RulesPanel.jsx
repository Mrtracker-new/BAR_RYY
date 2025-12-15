import React from 'react';
import { Eye, Clock, Lock, Webhook, ShieldAlert, Server, Download, Mail } from 'lucide-react';

const RulesPanel = ({ rules, onRulesChange }) => {
  const handleMaxViewsChange = (value) => {
    onRulesChange({ ...rules, maxViews: parseInt(value) || 1 });
  };

  const handleExpiryChange = (value, unit) => {
    const multipliers = { minutes: 1, hours: 60, days: 1440 };
    const minutes = parseInt(value) * multipliers[unit] || 0;
    onRulesChange({ ...rules, expiryMinutes: minutes, expiryUnit: unit, expiryValue: value });
  };

  const handlePasswordChange = (value) => {
    onRulesChange({ ...rules, password: value });
  };

  const handleWebhookChange = (value) => {
    onRulesChange({ ...rules, webhookUrl: value });
  };

  return (

    <div className="space-y-8">
      <div className="flex items-center space-x-3 mb-6">
        <div className="h-8 w-1 bg-gold-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
        <h2 className="text-xl font-bold text-white tracking-wide">
          Security Protocols
        </h2>
      </div>

      {/* Storage Mode */}
      <div className="group space-y-3 sm:space-y-4">
        <label className="text-xs font-mono text-gold-500 uppercase tracking-widest ml-1">Storage Configuration</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <label className={`relative p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${rules.storageMode === 'client'
              ? 'bg-gold-500/10 border-gold-500/40 shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]'
              : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
            }`}>
            <input
              type="radio"
              name="storageMode"
              value="client"
              checked={rules.storageMode === 'client' || !rules.storageMode}
              onChange={(e) => onRulesChange({ ...rules, storageMode: 'client' })}
              className="absolute opacity-0"
            />
            <div className="flex items-center space-x-3 mb-1 sm:mb-2">
              <Download size={18} className={rules.storageMode === 'client' ? 'text-gold-500' : 'text-gray-500'} />
              <span className={`font-semibold text-sm sm:text-base ${rules.storageMode === 'client' ? 'text-white' : 'text-gray-400'}`}>Client-Side</span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">Download .bar file. View limits not guaranteed.</p>
          </label>

          <label className={`relative p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${rules.storageMode === 'server'
              ? 'bg-gold-500/10 border-gold-500/40 shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]'
              : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
            }`}>
            <input
              type="radio"
              name="storageMode"
              value="server"
              checked={rules.storageMode === 'server'}
              onChange={(e) => onRulesChange({ ...rules, storageMode: 'server' })}
              className="absolute opacity-0"
            />
            <div className="flex items-center space-x-3 mb-1 sm:mb-2">
              <Server size={18} className={rules.storageMode === 'server' ? 'text-gold-500' : 'text-gray-500'} />
              <span className={`font-semibold text-sm sm:text-base ${rules.storageMode === 'server' ? 'text-white' : 'text-gray-400'}`}>Server-Side</span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">Shareable link. Strict view limits & auto-delete.</p>
          </label>
        </div>
      </div>

      <div className="border-t border-white/5 my-6"></div>

      {/* Max Views - Only for Server-Side */}
      {rules.storageMode === 'server' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="text-gray-400" size={16} />
              <label className="text-sm font-semibold text-gray-300">Self-Destruct Limit</label>
            </div>
            <span className="px-3 py-1 bg-gold-500/20 text-gold-500 text-xs font-mono rounded">
              {rules.maxViews} VIEW{rules.maxViews > 1 ? 'S' : ''}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={rules.maxViews}
            onChange={(e) => handleMaxViewsChange(e.target.value)}
            className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-gold-500"
          />
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white/5 border border-dashed border-white/10 text-center">
          <p className="text-xs text-gray-500">
            To enable <span className="text-gray-300 font-semibold">Self-Destruct</span> views, switch to Server-Side storage.
          </p>
        </div>
      )}

      {/* Expiry Time */}
      <div className="space-y-4 mt-6">
        <label className="text-xs font-mono text-gold-500 uppercase tracking-widest ml-1">Auto-Expiration</label>
        <div className="flex space-x-2">
          <input
            type="number"
            min="0"
            value={rules.expiryValue || 0}
            onChange={(e) => handleExpiryChange(e.target.value, rules.expiryUnit || 'minutes')}
            className="w-24 bg-dark-800 border border-white/10 rounded-lg px-4 py-3 text-center text-white font-bold text-lg focus:border-gold-500/50 focus:outline-none focus:ring-1 focus:ring-gold-500/50 transition-all placeholder-gray-700"
            placeholder="0"
          />
          <select
            value={rules.expiryUnit || 'minutes'}
            onChange={(e) => handleExpiryChange(rules.expiryValue || 0, e.target.value)}
            className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-4 py-3 text-gray-300 font-medium focus:border-gold-500/50 focus:outline-none transition-all cursor-pointer"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>

      <div className="border-t border-white/5 my-6"></div>

      {/* Advanced Options */}
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="flex items-center space-x-2 text-sm text-gray-300 font-medium">
            <Lock size={14} className="text-gold-500" />
            <span>Password Protection</span>
          </label>
          <input
            type="password"
            value={rules.password || ''}
            onChange={(e) => handlePasswordChange(e.target.value)}
            className="w-full bg-dark-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-700 focus:border-gold-500/50 focus:outline-none transition-all text-sm"
            placeholder="Optional access password..."
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-2 text-sm text-gray-300 font-medium">
            <Webhook size={14} className="text-gold-500" />
            <span>Tamper Prevention Webhook</span>
          </label>
          <input
            type="url"
            value={rules.webhookUrl || ''}
            onChange={(e) => handleWebhookChange(e.target.value)}
            className="w-full bg-dark-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-700 focus:border-gold-500/50 focus:outline-none transition-all text-sm"
            placeholder="https://discord.com/api/webhooks/..."
          />
        </div>

        {rules.storageMode === 'server' && (
          <>
            <label className="flex items-center space-x-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10">
              <input
                type="checkbox"
                checked={rules.requireOtp || false}
                onChange={(e) => onRulesChange({ ...rules, requireOtp: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-transparent text-gold-500 focus:ring-gold-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">Require Email One-Time-Password (2FA)</span>
            </label>

            {rules.requireOtp && (
              <div className="mt-3 ml-1 animate-fade-in-down">
                <input
                  type="email"
                  value={rules.otpEmail || ''}
                  onChange={(e) => onRulesChange({ ...rules, otpEmail: e.target.value })}
                  className="w-full bg-dark-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-700 focus:border-gold-500/50 focus:outline-none transition-all text-sm"
                  placeholder="recipient@example.com"
                  required={rules.requireOtp}
                />
                <p className="text-xs text-gray-500 mt-2 ml-1">
                  A 6-digit code will be sent to this email.
                </p>
              </div>
            )}
          </>
        )}
      </div>

    </div>

  );
};

export default RulesPanel;
