import React from 'react';
import { Eye, Clock, Lock, Webhook, ShieldAlert, Server, Download } from 'lucide-react';

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
      <h2 className="text-2xl font-bold text-gold-500 text-shadow-gold mb-6">
        Security Rules
      </h2>

      {/* Storage Mode */}
      <div className="space-y-3 bg-dark-700 border border-dark-600 rounded-lg p-4">
        <label className="text-lg text-gray-300 font-semibold">Storage Mode</label>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer group">
            <input
              type="radio"
              name="storageMode"
              value="client"
              checked={rules.storageMode === 'client' || !rules.storageMode}
              onChange={(e) => onRulesChange({ ...rules, storageMode: 'client' })}
              className="mt-1 w-5 h-5 rounded-full border-dark-600 bg-dark-700 text-gold-500 focus:ring-gold-500 focus:ring-2 cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Download size={18} className="text-gold-500" />
                <span className="text-gray-200 font-medium group-hover:text-gold-400">Client-Side (Download File)</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Download .bar file and share it manually. Simple but view limits can be bypassed by keeping copies.
              </p>
            </div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer group">
            <input
              type="radio"
              name="storageMode"
              value="server"
              checked={rules.storageMode === 'server'}
              onChange={(e) => onRulesChange({ ...rules, storageMode: 'server' })}
              className="mt-1 w-5 h-5 rounded-full border-dark-600 bg-dark-700 text-gold-500 focus:ring-gold-500 focus:ring-2 cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Server size={18} className="text-gold-500" />
                <span className="text-gray-200 font-medium group-hover:text-gold-400">Server-Side (Shareable Link)</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Get a shareable link. View limits properly enforced. File stored on server until destroyed.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Max Views - Only for Server-Side */}
      {rules.storageMode === 'server' ? (
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Eye className="text-gold-500" size={20} />
            <label className="text-lg text-gray-300">Self-Destruct After Views</label>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="1"
              max="5"
              value={rules.maxViews}
              onChange={(e) => handleMaxViewsChange(e.target.value)}
              className="flex-1 h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
            <span className="text-2xl font-bold text-gold-500 w-12 text-center">
              {rules.maxViews}
            </span>
          </div>
          <p className="text-sm text-gray-500">File will be destroyed after {rules.maxViews} view(s)</p>
        </div>
      ) : (
        <div className="space-y-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Eye className="text-yellow-500" size={20} />
            <label className="text-lg text-yellow-400 font-semibold">View Count Limit Unavailable</label>
          </div>
          <p className="text-sm text-yellow-300">
            View count tracking doesn't work with client-side mode (users can keep copies of the .bar file). 
            Switch to <strong>Server-Side</strong> storage to enable proper view limit enforcement.
          </p>
        </div>
      )}

      {/* Expiry Time */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <Clock className="text-gold-500" size={20} />
          <label className="text-lg text-gray-300">Auto-Expire After</label>
        </div>
        <div className="flex items-center space-x-3">
          <input
            type="number"
            min="0"
            value={rules.expiryValue || 0}
            onChange={(e) => handleExpiryChange(e.target.value, rules.expiryUnit || 'minutes')}
            className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-gold-500 focus:outline-none"
            placeholder="0 = Never"
          />
          <select
            value={rules.expiryUnit || 'minutes'}
            onChange={(e) => handleExpiryChange(rules.expiryValue || 0, e.target.value)}
            className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-gold-500 focus:outline-none"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
        <p className="text-sm text-gray-500">
          {rules.expiryMinutes > 0 ? `Expires in ${rules.expiryValue} ${rules.expiryUnit}` : 'No expiration set'}
        </p>
      </div>

      {/* Password Protection */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <Lock className="text-gold-500" size={20} />
          <label className="text-lg text-gray-300">Password Protection (Optional)</label>
        </div>
        <input
          type="password"
          value={rules.password || ''}
          onChange={(e) => handlePasswordChange(e.target.value)}
          className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-gold-500 focus:outline-none"
          placeholder="Leave empty for no password"
        />
        <p className="text-sm text-gray-500">
          {rules.password ? 'Password protection enabled' : 'No password protection'}
        </p>
      </div>

      {/* Tamper Alert Webhook */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <Webhook className="text-gold-500" size={20} />
          <label className="text-lg text-gray-300">Tamper Alert Webhook (Optional)</label>
        </div>
        <input
          type="url"
          value={rules.webhookUrl || ''}
          onChange={(e) => handleWebhookChange(e.target.value)}
          className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-gold-500 focus:outline-none"
          placeholder="https://your-webhook-url.com"
        />
        <p className="text-sm text-gray-500">
          {rules.webhookUrl ? 'Webhook configured for tampering alerts' : 'No webhook configured'}
        </p>
      </div>

      {/* View Only Mode */}
      <div className="space-y-3 border-t border-dark-600 pt-6">
        <div className="flex items-center space-x-3">
          <ShieldAlert className="text-gold-500" size={20} />
          <label className="text-lg text-gray-300">View Only Mode</label>
        </div>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={rules.viewOnly || false}
            onChange={(e) => onRulesChange({ ...rules, viewOnly: e.target.checked })}
            className="w-5 h-5 rounded border-dark-600 bg-dark-700 text-gold-500 focus:ring-gold-500 focus:ring-2 cursor-pointer"
          />
          <span className="text-gray-300">
            Enable view-only mode for supported file types
          </span>
        </label>
        <p className="text-sm text-gray-500">
          {rules.viewOnly ? (
            <span className="text-yellow-400">
              ⚠️ Enabled: Files can only be viewed in browser (no downloads for .txt, .pdf, images, videos)
            </span>
          ) : (
            'Disabled: Files can be downloaded normally'
          )}
        </p>
      </div>
    </div>
  );
};

export default RulesPanel;
