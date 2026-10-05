import React, { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Link as LinkIcon, Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import { processAndCompressProfileImage } from '../utils/imageCompressor';

interface ProfilePhotoUploaderProps {
  currentAvatar: string;
  onAvatarChanged: (newAvatar: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  currentAvatar,
  onAvatarChanged,
  disabled = false,
  compact = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file || disabled) return;
    if (!file.type.startsWith('image/')) {
      setStatusMessage('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Optimizing photo for fast profile loading...');

    try {
      const compressedDataUrl = await processAndCompressProfileImage(file, 360, 0.88);
      onAvatarChanged(compressedDataUrl);
      setStatusMessage('Profile photo updated successfully!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Photo optimization error:', err);
      setStatusMessage('Failed to process image. Please try another photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleApplyUrl = async () => {
    if (!urlInput.trim() || disabled) return;
    setIsProcessing(true);
    setStatusMessage('Fetching image from URL...');

    try {
      const compressed = await processAndCompressProfileImage(urlInput.trim(), 360, 0.88);
      onAvatarChanged(compressed);
      setUrlInput('');
      setShowUrlField(false);
      setStatusMessage('Photo updated from image URL!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      onAvatarChanged(urlInput.trim());
      setShowUrlField(false);
      setStatusMessage('Image URL applied!');
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePhoto = () => {
    if (disabled) return;
    onAvatarChanged('');
    setStatusMessage('Profile photo removed.');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const displayImage = currentAvatar && currentAvatar.trim() ? currentAvatar : '';

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative group shrink-0">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-cyan-800/40 shadow-sm bg-slate-900 flex items-center justify-center">
            {displayImage ? (
              <img src={displayImage} alt="Profile Avatar" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-7 h-7 text-slate-500" />
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isProcessing}
            className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white shadow-md cursor-pointer transition-colors border border-white"
            title="Upload Photo"
          >
            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleInputChange}
          accept="image/*"
          className="hidden"
        />

        <div className="space-y-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isProcessing}
            className="px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Processing...' : 'Upload Photo'}</span>
          </button>

          {displayImage && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold block transition-colors cursor-pointer"
            >
              Remove Photo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm space-y-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-cyan-800" />
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
            Profile Photo &amp; Avatar Upload
          </h4>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">JPG, PNG, WebP · Max 10MB</span>
      </div>

      {/* Main Upload Zone */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Left: Avatar Preview */}
        <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-cyan-800/40 shadow-md bg-slate-900 flex items-center justify-center">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt="Profile Avatar Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                  <ImageIcon className="w-8 h-8 text-slate-400 mb-1" />
                  <span className="text-[10px] font-medium text-slate-500">No Photo</span>
                </div>
              )}
            </div>

            {/* Overlaid Camera Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
              className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-cyan-800 hover:bg-cyan-900 text-white shadow-lg cursor-pointer transition-all border-2 border-white"
              title="Upload New Photo"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
          </div>

          <span className="text-[11px] font-semibold text-slate-600 mt-2">
            {displayImage ? 'Current Profile Avatar' : 'Default Engineer Portrait'}
          </span>
        </div>

        {/* Right: Drag & Drop Upload Target & Actions */}
        <div className="md:col-span-8 space-y-3">
          {/* Drag & Drop Target Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-1.5 ${
              isDragging
                ? 'border-cyan-700 bg-cyan-50/80 scale-[1.01]'
                : 'border-slate-300 bg-white hover:border-cyan-700 hover:bg-slate-100/70'
            }`}
          >
            <Upload className="w-5 h-5 text-cyan-800" />
            <div>
              <p className="text-xs font-bold text-slate-800">
                Click to browse photo file, or drag and drop image here
              </p>
              <p className="text-[11px] text-slate-500">
                Optimized automatically for high-res rendering across web &amp; mobile
              </p>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleInputChange}
            accept="image/*"
            className="hidden"
          />

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-800 hover:bg-cyan-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Compressing Photo...' : 'Choose Image File'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUrlField(!showUrlField)}
              disabled={disabled || isProcessing}
              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <LinkIcon className="w-3.5 h-3.5 text-slate-600" />
              <span>Paste Image URL</span>
            </button>

            {displayImage && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={disabled || isProcessing}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 border border-rose-200 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Remove Photo</span>
              </button>
            )}
          </div>

          {/* Optional Direct URL Input Field */}
          {showUrlField && (
            <div className="flex items-center gap-2 pt-2 animate-fade-in">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://images.unsplash.com/... or CDN URL"
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                disabled={!urlInput.trim() || isProcessing}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply URL</span>
              </button>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <p className="text-[11px] font-semibold text-cyan-900 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-lg animate-fade-in">
              {statusMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
