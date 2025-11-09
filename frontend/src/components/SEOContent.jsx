import React, { useState } from "react";
import { Shield, Lock, Eye, Clock, Zap, FileCheck, ChevronDown, ChevronUp } from "lucide-react";

const SEOContent = () => {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div className="max-w-7xl mx-auto mt-16 space-y-8">
      {/* Main SEO Content Section */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl p-8 border border-dark-700 shadow-2xl">
        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 bg-clip-text text-transparent mb-6">
          BAR - Burn After Reading: Secure Self-Destructing File Sharing
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed mb-6">
          <strong>BAR (Burn After Reading)</strong> is the ultimate secure file sharing platform for sending sensitive documents that self-destruct after viewing. 
          Whether you need to share confidential business documents, private photos, or classified information, BAR provides military-grade AES-256 encryption 
          combined with zero-knowledge security to ensure your files remain private and automatically delete after they've been accessed.
        </p>
        <p className="text-lg text-gray-300 leading-relaxed">
          Unlike traditional file sharing services, BAR specializes in <strong>temporary file sharing</strong> with built-in auto-deletion. 
          Set view limits, add password protection, and configure time-based expiry to ensure your sensitive data doesn't live longer than necessary. 
          Perfect for sharing contracts, legal documents, personal photos, or any confidential information that needs to disappear after being read.
        </p>
      </section>

      {/* Features Grid - Collapsible */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('features')}
          className="w-full p-6 flex items-center justify-between hover:bg-dark-700/50 transition-all"
        >
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent text-left">
            Why Choose BAR for Secure File Sharing?
          </h2>
          {openSection === 'features' ? (
            <ChevronUp className="text-purple-400 flex-shrink-0" size={28} />
          ) : (
            <ChevronDown className="text-purple-400 flex-shrink-0" size={28} />
          )}
        </button>
        {openSection === 'features' && (
        <div className="p-6 pt-0 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-gold-500/30 hover:border-gold-500/60 transition-all">
            <div className="p-3 bg-gold-500/20 rounded-lg w-fit mb-4">
              <Lock className="text-gold-500" size={28} />
            </div>
            <h3 className="text-xl font-bold text-gold-400 mb-3">Military-Grade Encryption</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Every file is encrypted with AES-256 encryption - the same standard used by banks and government agencies. 
              Your data is protected with zero-knowledge architecture, meaning even we can't access your files without the password.
            </p>
          </div>

          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-purple-500/30 hover:border-purple-500/60 transition-all">
            <div className="p-3 bg-purple-500/20 rounded-lg w-fit mb-4">
              <Eye className="text-purple-400" size={28} />
            </div>
            <h3 className="text-xl font-bold text-purple-400 mb-3">Self-Destructing Files</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Set files to automatically delete after being viewed once, twice, or any number of times. 
              Perfect for sharing sensitive information that needs to disappear after reading, just like in Mission Impossible.
            </p>
          </div>

          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-green-500/30 hover:border-green-500/60 transition-all">
            <div className="p-3 bg-green-500/20 rounded-lg w-fit mb-4">
              <Clock className="text-green-400" size={28} />
            </div>
            <h3 className="text-xl font-bold text-green-400 mb-3">Time-Based Auto-Expiry</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Configure files to expire after a specific time period - from 5 minutes to 24 hours or more. 
              Files automatically delete once the time limit is reached, ensuring temporary file access.
            </p>
          </div>

          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-blue-500/30 hover:border-blue-500/60 transition-all">
            <div className="p-3 bg-blue-500/20 rounded-lg w-fit mb-4">
              <Shield className="text-blue-400" size={28} />
            </div>
            <h3 className="text-xl font-bold text-blue-400 mb-3">Password Protection & 2FA</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Add an extra layer of security with password protection using PBKDF2 key derivation (100,000 iterations). 
              Enable two-factor authentication (2FA) via email OTP for maximum security on sensitive files.
            </p>
          </div>

          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-red-500/30 hover:border-red-500/60 transition-all">
            <div className="p-3 bg-red-500/20 rounded-lg w-fit mb-4">
              <Zap className="text-red-400" size={28} />
            </div>
            <h3 className="text-xl font-bold text-red-400 mb-3">Brute Force Protection</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Advanced security features prevent unauthorized access attempts with progressive delays and automatic lockouts after 5 failed password attempts. 
              Your encrypted files stay protected from brute force attacks.
            </p>
          </div>

          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-6 border border-yellow-500/30 hover:border-yellow-500/60 transition-all">
            <div className="p-3 bg-yellow-500/20 rounded-lg w-fit mb-4">
              <FileCheck className="text-yellow-400" size={28} />
            </div>
            <h3 className="text-xl font-bold text-yellow-400 mb-3">Secure File Deletion</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              When files expire or reach view limits, they're securely deleted with 3-pass overwrite to ensure no recovery is possible. 
              Your sensitive data is truly gone, leaving no traces behind.
            </p>
          </div>
        </div>
        )}
      </section>

      {/* Use Cases Section - Collapsible */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('usecases')}
          className="w-full p-6 flex items-center justify-between hover:bg-dark-700/50 transition-all"
        >
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent text-left">
            Perfect Use Cases for BAR
          </h2>
          {openSection === 'usecases' ? (
            <ChevronUp className="text-gold-400 flex-shrink-0" size={28} />
          ) : (
            <ChevronDown className="text-gold-400 flex-shrink-0" size={28} />
          )}
        </button>
        {openSection === 'usecases' && (
        <div className="p-6 pt-0 grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xl font-semibold text-gold-400 mb-3">🏢 Business & Enterprise</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Share confidential contracts and NDAs that expire after signing</li>
              <li>• Send sensitive financial reports with view limits</li>
              <li>• Distribute temporary access credentials securely</li>
              <li>• Share proprietary documents with automatic deletion</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-purple-400 mb-3">👤 Personal & Private</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Share private photos that self-destruct after viewing</li>
              <li>• Send passwords and sensitive information securely</li>
              <li>• Share medical documents with time-limited access</li>
              <li>• Transfer personal files without leaving permanent copies</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-green-400 mb-3">⚖️ Legal & Compliance</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Share legal documents with controlled access</li>
              <li>• Distribute case files with automatic expiration</li>
              <li>• Send compliance reports that delete after review</li>
              <li>• Share evidence files with tracked viewing</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-blue-400 mb-3">🔬 Research & Development</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Share research data with temporary collaborators</li>
              <li>• Distribute prototypes and designs securely</li>
              <li>• Send patent applications with controlled access</li>
              <li>• Share confidential research findings</li>
            </ul>
          </div>
        </div>
        )}
      </section>

      {/* How It Works Section - Collapsible */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('howto')}
          className="w-full p-6 flex items-center justify-between hover:bg-dark-700/50 transition-all"
        >
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent text-left">
            How BAR's Self-Destructing File Sharing Works
          </h2>
          {openSection === 'howto' ? (
            <ChevronUp className="text-purple-400 flex-shrink-0" size={28} />
          ) : (
            <ChevronDown className="text-purple-400 flex-shrink-0" size={28} />
          )}
        </button>
        {openSection === 'howto' && (
        <div className="p-6 pt-0 space-y-4 text-gray-300">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-black rounded-full flex items-center justify-center font-bold">1</div>
            <div>
              <h3 className="text-lg font-semibold text-gold-400 mb-2">Upload & Configure</h3>
              <p>Upload your file (up to 100MB) and configure security settings: storage mode, password protection, view limits, and expiry time.</p>
            </div>
          </div>
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-black rounded-full flex items-center justify-center font-bold">2</div>
            <div>
              <h3 className="text-lg font-semibold text-gold-400 mb-2">Encrypt & Seal</h3>
              <p>BAR encrypts your file with AES-256 encryption, applies HMAC-SHA256 tamper detection, and creates a secure .BAR container or shareable link.</p>
            </div>
          </div>
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-black rounded-full flex items-center justify-center font-bold">3</div>
            <div>
              <h3 className="text-lg font-semibold text-gold-400 mb-2">Share Securely</h3>
              <p>Share the generated link or .BAR file with recipients. They can access the file through password authentication and 2FA if enabled.</p>
            </div>
          </div>
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-black rounded-full flex items-center justify-center font-bold">4</div>
            <div>
              <h3 className="text-lg font-semibold text-gold-400 mb-2">Auto-Destruct</h3>
              <p>Once view limits are reached or expiry time passes, the file is securely deleted with 3-pass overwrite, ensuring complete data destruction.</p>
            </div>
          </div>
        </div>
        )}
      </section>

      {/* FAQ Section - Collapsible */}
      <section className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('faq')}
          className="w-full p-6 flex items-center justify-between hover:bg-dark-700/50 transition-all"
        >
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent text-left">
            Frequently Asked Questions About BAR
          </h2>
          {openSection === 'faq' ? (
            <ChevronUp className="text-gold-400 flex-shrink-0" size={28} />
          ) : (
            <ChevronDown className="text-gold-400 flex-shrink-0" size={28} />
          )}
        </button>
        {openSection === 'faq' && (
        <div className="p-6 pt-0 space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gold-400 mb-2">What does BAR stand for?</h3>
            <p className="text-gray-300">
              BAR stands for "Burn After Reading" - inspired by spy movies where secret messages self-destruct after being read. 
              Our platform brings this concept to digital file sharing with military-grade security.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gold-400 mb-2">How secure is BAR's encryption?</h3>
            <p className="text-gray-300">
              BAR uses AES-256 encryption (the same standard used by banks and governments), PBKDF2 key derivation with 100,000 iterations, 
              HMAC-SHA256 tamper detection, and zero-knowledge architecture. Without the password, your files are mathematically impossible to decrypt.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gold-400 mb-2">Can I recover a file after it self-destructs?</h3>
            <p className="text-gray-300">
              No. Once a file reaches its view limit or expires, BAR performs secure deletion with 3-pass overwrite, making recovery impossible. 
              This ensures your sensitive data is truly gone.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gold-400 mb-2">Is BAR free to use?</h3>
            <p className="text-gray-300">
              Yes! BAR is completely free to use with all security features included: encryption, password protection, self-destruct, 2FA, and more. 
              No hidden fees or premium tiers.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gold-400 mb-2">What's the difference between client-side and server-side storage?</h3>
            <p className="text-gray-300">
              Client-side storage generates a downloadable .BAR file that you can share via email or other channels, but view limits can't be enforced. 
              Server-side storage creates a shareable link with strictly enforced view limits and automatic deletion - recommended for sensitive files.
            </p>
          </div>
        </div>
        )}
      </section>

      {/* Keywords Footer for SEO - Hidden from view but readable by search engines */}
      <section className="sr-only" aria-hidden="true">
        <p>
          Keywords: burn after reading, self-destruct files, secure file sharing, encrypted file transfer, 
          temporary file sharing, confidential file sharing, auto-delete files, BAR encryption, mission impossible files, 
          zero-knowledge encryption, password protected files, AES-256 encryption, self-destructing messages
        </p>
      </section>
    </div>
  );
};

export default SEOContent;
