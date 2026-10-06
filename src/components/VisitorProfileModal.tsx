import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, User, Trash2, CheckCircle2 } from 'lucide-react';
import { compressAvatarToWebP } from '../utils/profileState';

export interface VisitorMessagingProfile {
  name: string;
  avatarUrl?: string;
  roleOrCompany?: string;
  avatarColor?: string;
}

interface VisitorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: VisitorMessagingProfile;
  onSave: (updated: VisitorMessagingProfile) => void;
}

const PRESET_COLORS = [
  'bg-slate-700',
  'bg-cyan-800',
  'bg-emerald-700',
  'bg-indigo-700',
  'bg-rose-700',
  'bg-amber-700',
  'bg-teal-700',
];

export const VisitorProfileModal: React.FC<VisitorProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSave,
}) => {
  const [name, setName] = useState(currentProfile.name || '');
  const [role, setRole] = useState(currentProfile.roleOrCompany || '');
  const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatarUrl || '');
  const [avatarColor, setAvatarColor] = useState(currentProfile.avatarColor || 'bg-slate-700');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentProfile.name || '');
      setRole(currentProfile.roleOrCompany || '');
      setAvatarUrl(currentProfile.avatarUrl || '');
      setAvatarColor(currentProfile.avatarColor || 'bg-slate-700');
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      // Compress to 400x400 WebP format at 80% quality
      const compressed = await compressAvatarToWebP(file, 400, 0.80);
      setAvatarUrl(compressed.dataUrl);
    } catch (err) {
      console.warn('Avatar compression failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim() || 'Visitor',
      roleOrCompany: role.trim() || 'Visitor Direct Chat',
      avatarUrl: avatarUrl || undefined,
      avatarColor,
    });
    onClose();
  };

  const displayName = name.trim() || 'Visitor';
  const initialLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-md w-full p-5 sm:p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-xl bg-[#243346] text-white flex items-center justify-center shadow-xs">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Edit Messaging Profile
            </h3>
            <p className="text-xs text-slate-500">
              Customize your identity and avatar for chatting with Festus
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Avatar Section */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="relative group mb-3">
              {/* Avatar circle */}
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-200 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full ${avatarColor} text-white font-bold text-2xl flex items-center justify-center`}>
                    {initialLetter}
                  </div>
                )}
              </div>

              {/* Upload trigger badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#243346] hover:bg-[#1a2533] text-white shadow-md transition-colors cursor-pointer border-2 border-white"
                title="Change Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-lg bg-[#243346] hover:bg-[#1a2533] text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                {isUploading ? 'Compressing...' : 'Upload Profile Picture'}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="p-1.5 rounded-lg border border-slate-300 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                  title="Remove custom picture"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Avatar Color Presets if no photo is uploaded */}
            {!avatarUrl && (
              <div className="mt-3 flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-medium">Color:</span>
                {PRESET_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setAvatarColor(col)}
                    className={`w-4.5 h-4.5 rounded-full ${col} transition-transform cursor-pointer ${
                      avatarColor === col ? 'ring-2 ring-offset-1 ring-slate-900 scale-110' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Full Name Input */}
          <div>
            <label className="block font-bold text-slate-800 mb-1 text-xs">
              Your Name / Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sarah Jenkins, Lead Recruiter, Dr. Alan Cooper"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#243346] text-xs font-sans"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Festus will see this name next to your messages and in his inquiry list.
            </p>
          </div>

          {/* Company / Role Input */}
          <div>
            <label className="block font-bold text-slate-800 mb-1 text-xs">
              Company / Role / Subject (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Tesla Autopilot Team, Aerospace Consulting, Project Inquiry"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#243346] text-xs font-sans"
            />
          </div>

          {/* Live Preview of how it displays to Owner Festus */}
          <div className="p-3 rounded-xl bg-[#edf2f7] border border-slate-200">
            <span className="block font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-2">
              Preview (How Festus Sees You in His Inbox)
            </span>
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-2xs">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full ${avatarColor} text-white font-bold text-xs flex items-center justify-center`}>
                    {initialLetter}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate text-xs">{displayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{role || 'Visitor Inquiry'}</p>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                Verified
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#243346] hover:bg-[#1a2533] text-white font-bold cursor-pointer text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
