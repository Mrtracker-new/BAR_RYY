import React from 'react';
import { Eye, Clock, Lock, Webhook, Server, Download } from 'lucide-react';

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
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="h-6 w-1 bg-amber-500 rounded-full"></div>
        <h2 className="text-lg font-semibold text-white tracking-wide">
          Security Protocols
        </h2>
      </div>

      {/* Storage Mode */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-amber-500 uppercase tracking-wider ml-1">Storage Configuration</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={`relative p-4 rounded-xl border transition-all cursor-pointer ${rules.storageMode === 'client'
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-white/5 border-white/5 hover:bg-white/10'
            }`}>
            <input
              type="radio"
              name="storageMode"
              value="client"
              checked={rules.storageMode === 'client' || !rules.storageMode}
              onChange={(e) => onRulesChange({ ...rules, storageMode: 'client' })}
              className="absolute opacity-0"
            />
            <div className="flex items-center space-x-3 mb-1">
              <Download size={18} className={rules.storageMode === 'client' ? 'text-amber-500' : 'text-zinc-500'} />
              <span className={`font-medium text-sm ${rules.storageMode === 'client' ? 'text-white' : 'text-zinc-400'}`}>Client-Side</span>
            </div>
            <p className="text-xs text-zinc-500">Download .bar file. View limits not guaranteed.</p>
          </label>

          <label className={`relative p-4 rounded-xl border transition-all cursor-pointer ${rules.storageMode === 'server'
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-white/5 border-white/5 hover:bg-white/10'
            }`}>
            <input
              type="radio"
              name="storageMode"
              value="server"
              checked={rules.storageMode === 'server'}
              onChange={(e) => onRulesChange({ ...rules, storageMode: 'server' })}
              className="absolute opacity-0"
            />
            <div className="flex items-center space-x-3 mb-1">
              <Server size={18} className={rules.storageMode === 'server' ? 'text-amber-500' : 'text-zinc-500'} />
              <span className={`font-medium text-sm ${rules.storageMode === 'server' ? 'text-white' : 'text-zinc-400'}`}>Server-Side</span>
            </div>
            <p className="text-xs text-zinc-500">Shareable link. Strict view limits & auto-delete.</p>
          </label>
        </div>
      </div>

      <div className="border-t border-white/5 my-6"></div>

      {/* Max Views - Only for Server-Side */}
      {rules.storageMode === 'server' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="text-zinc-500" size={16} />
              <label className="text-sm font-medium text-zinc-300">Self-Destruct Limit</label>
            </div>
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-xs font-mono rounded border border-amber-500/20">
              {rules.maxViews} VIEW{rules.maxViews > 1 ? 'S' : ''}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={rules.maxViews}
            onChange={(e) => handleMaxViewsChange(e.target.value)}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-zinc-900 border border-white/5 text-center">
          <p className="text-xs text-zinc-500">
            Switch to Server-Side for <span className="text-zinc-300">Self-Destruct</span> limits.
          </p>
        </div>
      )}

      {/* Expiry Time */}
      <div className="space-y-4 mt-6">
        <label className="text-xs font-medium text-amber-500 uppercase tracking-wider ml-1">Auto-Expiration</label>
        <div className="flex space-x-2">
          <input
            type="number"
            min="0"
            value={rules.expiryValue || 0}
            onChange={(e) => handleExpiryChange(e.target.value, rules.expiryUnit || 'minutes')}
            className="w-24 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-center text-white font-medium focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-zinc-700 sm:text-sm"
            placeholder="0"
          />
          <select
            value={rules.expiryUnit || 'minutes'}
            onChange={(e) => handleExpiryChange(rules.expiryValue || 0, e.target.value)}
            className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-zinc-300 text-sm focus:border-amber-500/50 focus:outline-none transition-all cursor-pointer"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>

      {/* Refresh Control - Only for Server-Side */}
      {rules.storageMode === 'server' && (
        <div className="space-y-4 mt-6">
          <label className="text-xs font-medium text-amber-500 uppercase tracking-wider ml-1">
            Refresh Control
          </label>

          {/* Radio button selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`relative p-4 rounded-xl border transition-all cursor-pointer ${(rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0)
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-white/5 border-white/5 hover:bg-white/10'
              }`}>
              <input
                type="radio"
                name="refreshControl"
                checked={(rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0)}
                onChange={() => onRulesChange({
                  ...rules,
                  viewRefreshMinutes: (rules.viewRefreshMinutes || 5),
                  autoRefreshSeconds: 0
                })}
                className="absolute opacity-0"
              />
              <div className="flex items-center space-x-3 mb-1">
                <Clock size={18} className={
                  (rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0)
                    ? 'text-amber-500'
                    : 'text-zinc-500'
                } />
                <span className={`font-medium text-sm ${(rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0)
                    ? 'text-white'
                    : 'text-zinc-400'
                  }`}>View Refresh Threshold</span>
              </div>
              <p className="text-xs text-zinc-500">Prevents rapid refreshes from consuming views</p>
            </label>

            <label className={`relative p-4 rounded-xl border transition-all cursor-pointer ${(rules.autoRefreshSeconds || 0) > 0
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-white/5 border-white/5 hover:bg-white/10'
              }`}>
              <input
                type="radio"
                name="refreshControl"
                checked={(rules.autoRefreshSeconds || 0) > 0}
                onChange={() => onRulesChange({
                  ...rules,
                  viewRefreshMinutes: 0,
                  autoRefreshSeconds: (rules.autoRefreshSeconds || 30)
                })}
                className="absolute opacity-0"
              />
              <div className="flex items-center space-x-3 mb-1">
                <Clock size={18} className={
                  (rules.autoRefreshSeconds || 0) > 0
                    ? 'text-amber-500'
                    : 'text-zinc-500'
                } />
                <span className={`font-medium text-sm ${(rules.autoRefreshSeconds || 0) > 0
                    ? 'text-white'
                    : 'text-zinc-400'
                  }`}>Auto-Refresh Interval</span>
              </div>
              <p className="text-xs text-zinc-500">Forces automatic page reload</p>
            </label>
          </div>

          {/* Show settings for selected option */}
          {(rules.viewRefreshMinutes || 0) > 0 || !(rules.autoRefreshSeconds || 0) ? (
            <div className="space-y-2">
              <select
                value={rules.viewRefreshMinutes || 0}
                onChange={(e) => onRulesChange({
                  ...rules,
                  viewRefreshMinutes: parseInt(e.target.value),
                  autoRefreshSeconds: 0
                })}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-zinc-300 text-sm focus:border-amber-500/50 focus:outline-none transition-all cursor-pointer"
              >
                <option value="0">Every access counts (default)</option>
                <option value="1">1 minute</option>
                <option value="5">5 minutes (recommended)</option>
                <option value="10">10 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
              </select>
              <p className="text-xs text-zinc-500 ml-1">
                Same user within this window = counts as one view
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={rules.autoRefreshSeconds || 0}
                onChange={(e) => onRulesChange({
                  ...rules,
                  viewRefreshMinutes: 0,
                  autoRefreshSeconds: parseInt(e.target.value)
                })}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-zinc-300 text-sm focus:border-amber-500/50 focus:outline-none transition-all cursor-pointer"
              >
                <option value="10">10 seconds (very strict)</option>
                <option value="30">30 seconds (recommended)</option>
                <option value="60">1 minute</option>
                <option value="120">2 minutes</option>
                <option value="300">5 minutes</option>
              </select>
              <p className="text-xs text-zinc-500 ml-1">
                Page reloads automatically to ensure file disappears when expired
              </p>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-white/5 my-6"></div>

      {/* Advanced Options */}
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="flex items-center space-x-2 text-sm text-zinc-300 font-medium">
            <Lock size={14} className="text-amber-500" />
            <span>Password Protection</span>
          </label>
          <input
            type="password"
            value={rules.password || ''}
            onChange={(e) => handlePasswordChange(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-zinc-700 focus:border-amber-500/50 focus:outline-none transition-all text-sm"
            placeholder="Optional access password..."
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-2 text-sm text-zinc-300 font-medium">
            <Webhook size={14} className="text-amber-500" />
            <span>Tamper Prevention Webhook</span>
          </label>
          <input
            type="url"
            value={rules.webhookUrl || ''}
            onChange={(e) => handleWebhookChange(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-zinc-700 focus:border-amber-500/50 focus:outline-none transition-all text-sm"
            placeholder="https://discord.com/api/webhooks/..."
          />
        </div>

        {rules.storageMode === 'server' && (
          <>
            <label className="flex items-center space-x-3 p-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer border border-transparent hover:border-white/5">
              <input
                type="checkbox"
                checked={rules.viewOnly || false}
                onChange={(e) => onRulesChange({ ...rules, viewOnly: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-600 bg-transparent text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
              />
              <div className="flex flex-col">
                <span className="text-sm text-zinc-300 font-medium">View Only Mode</span>
                <span className="text-xs text-zinc-500">Recipients can view the file but cannot download it.</span>
              </div>
            </label>

            <label className="flex items-center space-x-3 p-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer border border-transparent hover:border-white/5">
              <input
                type="checkbox"
                checked={rules.requireOtp || false}
                onChange={(e) => onRulesChange({ ...rules, requireOtp: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-600 bg-transparent text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
              />
              <span className="text-sm text-zinc-300">Require Email OTP (2FA)</span>
            </label>

            {rules.requireOtp && (
              <div className="mt-2 ml-1">
                <input
                  type="email"
                  value={rules.otpEmail || ''}
                  onChange={(e) => onRulesChange({ ...rules, otpEmail: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-zinc-700 focus:border-amber-500/50 focus:outline-none transition-all text-sm"
                  placeholder="recipient@example.com"
                  required={rules.requireOtp}
                />
                <p className="text-xs text-zinc-500 mt-1.5 ml-1">
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
