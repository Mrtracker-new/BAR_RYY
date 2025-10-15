import React, { useState } from 'react';
import axios from 'axios';
import { Download, PackageOpen, AlertCircle } from 'lucide-react';
import FileUpload from './components/FileUpload';
import RulesPanel from './components/RulesPanel';
import ContainerAnimation from './components/ContainerAnimation';
import DecryptPage from './components/DecryptPage';

function App() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [rules, setRules] = useState({
    maxViews: 1,
    expiryMinutes: 0,
    expiryValue: 0,
    expiryUnit: 'minutes',
    password: '',
    webhookUrl: '',
    viewOnly: false
  });
  const [isSealing, setIsSealing] = useState(false);
  const [barResult, setBarResult] = useState(null);
  const [error, setError] = useState(null);
  const [showDecrypt, setShowDecrypt] = useState(false);

  const handleFileSelect = async (file) => {
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadedFile(file);
      setFileInfo(response.data);
    } catch (err) {
      setError('Failed to upload file: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileInfo(null);
    setBarResult(null);
    setError(null);
  };

  const handleSealContainer = async () => {
    if (!fileInfo) {
      setError('No file uploaded');
      return;
    }

    setIsSealing(true);
    setError(null);

    try {
      // Simulate sealing delay for better UX
      await new Promise(resolve => setTimeout(resolve, 2000));

      const sealData = {
        filename: fileInfo.filename,
        max_views: rules.maxViews,
        expiry_minutes: rules.expiryMinutes,
        password: rules.password || null,
        webhook_url: rules.webhookUrl || null,
        view_only: rules.viewOnly || false
      };

      const response = await axios.post('/seal', sealData);
      setBarResult(response.data);
      
      // Clear uploaded file state after successful seal
      setUploadedFile(null);
      setFileInfo(null);
    } catch (err) {
      setError('Failed to seal container: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSealing(false);
    }
  };

  const handleDownloadBar = () => {
    if (barResult) {
      window.open(`/download/${barResult.bar_id}`, '_blank');
    }
  };

  const handleReset = () => {
    setBarResult(null);
    setUploadedFile(null);
    setFileInfo(null);
    setError(null);
    setRules({
      maxViews: 1,
      expiryMinutes: 0,
      expiryValue: 0,
      expiryUnit: 'minutes',
      password: '',
      webhookUrl: '',
      viewOnly: false
    });
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <ContainerAnimation isSealing={isSealing} />
      
      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-800/50 backdrop-blur">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <PackageOpen className="text-gold-500" size={40} />
              <div>
                <h1 className="text-3xl font-bold text-gold-500 text-shadow-gold">
                  BAR Web
                </h1>
                <p className="text-gray-400 text-sm">Burn After Reading - Secure File Encryption</p>
              </div>
            </div>
            <button
              onClick={() => setShowDecrypt(!showDecrypt)}
              className="px-6 py-2 bg-gold-500/20 hover:bg-gold-500/30 text-gold-500 rounded-lg transition-all duration-300 border border-gold-500/30 hover:border-gold-500"
            >
              {showDecrypt ? '📦 Create Container' : '🔓 Decrypt .BAR'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {showDecrypt ? (
          <DecryptPage onBack={() => setShowDecrypt(false)} />
        ) : (
        <>
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center space-x-3">
            <AlertCircle className="text-red-500" size={24} />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {!barResult ? (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - File Upload */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gold-500 text-shadow-gold mb-4">
                  Upload File
                </h2>
                <FileUpload
                  onFileSelect={handleFileSelect}
                  uploadedFile={uploadedFile}
                  onRemove={handleRemoveFile}
                />
              </div>

              {uploadedFile && (
                <div className="border border-dark-700 rounded-lg p-6 bg-dark-800">
                  <h3 className="text-lg font-semibold text-gold-500 mb-4">Container Preview</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status:</span>
                      <span className="text-green-500 font-semibold">Ready to Seal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">File:</span>
                      <span className="text-white">{uploadedFile.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Views:</span>
                      <span className="text-white">{rules.maxViews}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Expiry:</span>
                      <span className="text-white">
                        {rules.expiryMinutes > 0 
                          ? `${rules.expiryValue} ${rules.expiryUnit}` 
                          : 'Never'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Password:</span>
                      <span className="text-white">{rules.password ? 'Protected' : 'None'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">View Only:</span>
                      <span className={rules.viewOnly ? 'text-yellow-500' : 'text-gray-500'}>
                        {rules.viewOnly ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Rules Panel */}
            <div className="border border-dark-700 rounded-lg p-6 bg-dark-800">
              <RulesPanel rules={rules} onRulesChange={setRules} />
              
              <button
                onClick={handleSealContainer}
                disabled={!uploadedFile || isSealing}
                className={`w-full mt-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 ${
                  uploadedFile && !isSealing
                    ? 'bg-gold-500 hover:bg-gold-600 text-black hover:scale-105 animate-glow'
                    : 'bg-dark-600 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSealing ? 'Sealing...' : '🔒 Seal & Generate .BAR'}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="border-2 border-gold-500 rounded-xl p-8 bg-dark-800 terminal-glow">
              <div className="text-center space-y-6">
                <div className="inline-block p-6 bg-gold-500/20 rounded-full">
                  <PackageOpen className="text-gold-500" size={64} />
                </div>
                
                <h2 className="text-3xl font-bold text-gold-500 text-shadow-gold">
                  Container Sealed Successfully!
                </h2>
                
                <div className="bg-dark-900 rounded-lg p-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Filename:</span>
                    <span className="text-white font-mono">{barResult.bar_filename}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">BAR ID:</span>
                    <span className="text-white font-mono">{barResult.bar_id.substring(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Max Views:</span>
                    <span className="text-white">{barResult.metadata.max_views}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Created:</span>
                    <span className="text-white">
                      {new Date(barResult.metadata.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' })} IST
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDownloadBar}
                  className="w-full py-4 bg-gold-500 hover:bg-gold-600 text-black font-bold text-lg rounded-lg transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-3"
                >
                  <Download size={24} />
                  <span>Download .BAR File</span>
                </button>

                <button
                  onClick={handleReset}
                  className="w-full py-3 border border-dark-600 hover:border-gold-500 text-gray-300 hover:text-gold-500 font-semibold rounded-lg transition-all duration-300"
                >
                  Create Another Container
                </button>

                <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ <strong>Important:</strong> Keep this .BAR file safe. Once the view limit is reached or it expires, the file will be permanently destroyed and cannot be recovered.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-700 mt-20">
        <div className="container mx-auto px-6 py-6 text-center text-gray-500 text-sm">
          <p>BAR Web - Burn After Reading © 2025</p>
          <p className="mt-2">Secure file encryption with self-destruct capabilities</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
