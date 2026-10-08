import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, User, Trash2, CheckCircle2, Key, History, AlertCircle, Copy, Check } from 'lucide-react';
import { compressAvatarToWebP } from '../utils/profileState';
import {
  uploadVisitorAvatarToSupabaseBucket,
  saveVisitorProfileToSupabase,
  supabase,
} from '../utils/supabase';

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
  onSave: (updated: VisitorMessagingProfile, accessKey: string) => void;
  visitorId?: string;
  isMandatory?: boolean;
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
  visitorId,
  isMandatory = false,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'restore'>('create');
  
  // Create profile state
  const [name, setName] = useState(currentProfile.name || '');
  const [role, setRole] = useState(currentProfile.roleOrCompany || '');
  const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatarUrl || '');
  const [avatarColor, setAvatarColor] = useState(currentProfile.avatarColor || 'bg-slate-700');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore session state
  const [enteredKey, setEnteredKey] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsLoading] = useState(false);

  // Copy helper inside modal
  const [copiedKey, setCopiedKey] = useState(false);

  const activeVisitorId = visitorId || localStorage.getItem('fesline_visitor_access_key') || '';

  useEffect(() => {
    if (isOpen) {
      setName(currentProfile.name || '');
      setRole(currentProfile.roleOrCompany || '');
      setAvatarUrl(currentProfile.avatarUrl || '');
      setAvatarColor(currentProfile.avatarColor || 'bg-slate-700');
      setRestoreError(null);
      setEnteredKey('');
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      // 1. Compress to 400x400 WebP format at 80% quality
      const compressed = await compressAvatarToWebP(file, 400, 0.80);

      // Determine upload ID
      let uploadId = activeVisitorId;
      if (!uploadId) {
        uploadId = `temp_${Date.now()}`;
      }

      // 2. Upload custom profile photo directly to Supabase Storage avatars bucket
      const uploadRes = await uploadVisitorAvatarToSupabaseBucket(compressed.dataUrl, uploadId);
      if (uploadRes && uploadRes.publicUrl) {
        setAvatarUrl(uploadRes.publicUrl);
      } else {
        setAvatarUrl(compressed.dataUrl);
      }
    } catch (err) {
      console.warn('Avatar upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit Profile Form: Manage guest visitor state entirely via localStorage without Supabase Auth
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = name.trim() || 'Visitor';
    const roleSubject = role.trim() || 'Visitor Direct Chat';

    setIsLoading(true);
    setRestoreError(null);

    try {
      // 1. Generate or use persistent visitor_id (visitor_ + crypto.randomUUID())
      // 2. Strict Session Reset & Id Generation:
      // When a user submits the "InChat" profile setup form to register a new identity,
      // DO NOT update or mutate the existing visitor profile row.
      // Generate a brand-new visitor_id ('visitor_' + crypto.randomUUID()) and matching conversation_id ('conv_' + new visitor_id)
      const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const accessKey = `visitor_${uuid}`;

      // 2. Ensure single-thread conversation_id ('conv_' + visitor_id) is persisted directly in localStorage
      const convId = `conv_${accessKey}`;
      localStorage.setItem('conversation_id', convId);
      localStorage.setItem('fesline_current_conversation_id', convId);

      const updatedProfile: VisitorMessagingProfile = {
        name: displayName,
        roleOrCompany: roleSubject,
        avatarUrl: avatarUrl || undefined,
        avatarColor,
      };

      // 3. Persist visitor_id, conversation_id, display_name, avatar_url, and role_subject directly in localStorage
      localStorage.setItem('visitor_id', accessKey);
      localStorage.setItem('conversation_id', convId);
      localStorage.setItem('display_name', displayName);
      localStorage.setItem('avatar_url', avatarUrl || '');
      localStorage.setItem('role_subject', roleSubject);
      localStorage.setItem('visitor_profile', JSON.stringify(updatedProfile));
      localStorage.setItem('fesline_visitor_messaging_profile', JSON.stringify(updatedProfile));
      localStorage.setItem('fesline_visitor_access_key', accessKey);
      localStorage.setItem('fesline_current_visitor_id', accessKey);

      // 4. Save visitor profile to Supabase database wrapped in try/catch without wiping local state
      try {
        await saveVisitorProfileToSupabase({
          visitor_id: accessKey,
          display_name: displayName,
          role_subject: roleSubject,
          avatar_url: avatarUrl || '',
          avatar_color: avatarColor,
        });
      } catch (dbErr) {
        console.error('[Supabase Visitor Profile Save Error]:', dbErr);
      }

      onSave(updatedProfile, accessKey);
      onClose();
    } catch (err: any) {
      console.error('Submit profile error:', err);
      setRestoreError(err?.message || 'Failed to establish visitor credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Restore Session via Visitor ID / Key
  const handleRestoreSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const keyToSearch = enteredKey.trim();
    if (!keyToSearch) {
      setRestoreError('Please enter your Visitor ID.');
      return;
    }

    setIsLoading(true);
    setRestoreError(null);

    try {
      // 1. Direct query visitor_profiles by visitor_id without referencing non-existent id column
      const { data, error } = await supabase
        .from('visitor_profiles')
        .select('*')
        .eq('visitor_id', keyToSearch)
        .maybeSingle();

      if (error) {
        console.error('Supabase query error on restore:', error);
        throw error;
      }

      if (!data) {
        setRestoreError('Visitor ID not found. Please verify the ID or create a new profile.');
        return;
      }

      const restoredProfile: VisitorMessagingProfile = {
        name: data.display_name || data.name || 'Visitor',
        roleOrCompany: data.role_subject || data.role_or_company || 'Visitor Direct Chat',
        avatarUrl: data.avatar_url || '',
        avatarColor: data.avatar_color || 'bg-slate-700',
      };

      // 2. Persist visitor_id, display_name, and profile details directly in localStorage
      localStorage.setItem('visitor_id', keyToSearch);
      localStorage.setItem('display_name', restoredProfile.name);
      localStorage.setItem('visitor_profile', JSON.stringify(restoredProfile));
      localStorage.setItem('fesline_visitor_messaging_profile', JSON.stringify(restoredProfile));
      localStorage.setItem('fesline_visitor_access_key', keyToSearch);
      localStorage.setItem('fesline_current_visitor_id', keyToSearch);

      onSave(restoredProfile, keyToSearch);
      onClose();
    } catch (err: any) {
      console.error('Restore profile error:', err);
      setRestoreError(err?.message || 'Error occurred while restoring profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = name.trim() || 'Visitor';
  const initialLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/65 backdrop-blur-xs animate-fade-in font-sans">
      {/* Compact reduced padding container */}
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-4 sm:p-5 relative max-h-[90vh] overflow-y-auto">
        
        {/* Close/Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 p-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 transition-colors cursor-pointer"
          title="Close Setup"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-[#243346] text-white flex items-center justify-center shadow-xs shrink-0">
            <Key className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">
              InChat Profile Setup
            </h3>
            <p className="text-[10.5px] text-slate-400 truncate">
              Set your name & avatar or load a saved session
            </p>
          </div>
        </div>

        {/* Active Key Display */}
        {activeVisitorId && (
          <div className="mb-3.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Key className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-500 whitespace-nowrap">Your Visitor ID:</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-150 text-cyan-800 font-mono font-bold text-[10px] tracking-wider truncate max-w-[170px]">
                {activeVisitorId}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(activeVisitorId);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              className="p-1 rounded bg-white hover:bg-slate-150 border border-slate-250 text-slate-500 hover:text-slate-800 cursor-pointer shadow-2xs shrink-0"
              title="Copy Visitor ID"
            >
              {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex rounded-md bg-slate-100 p-0.5 mb-3.5 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-1 rounded font-semibold transition-all cursor-pointer ${
              activeTab === 'create' 
                ? 'bg-white text-slate-950 shadow-xs' 
                : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            Create Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-1 rounded font-semibold transition-all cursor-pointer ${
              activeTab === 'restore' 
                ? 'bg-white text-slate-950 shadow-xs' 
                : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            Restore Session
          </button>
        </div>

        {/* Compact Error Alert */}
        {restoreError && (
          <div className="mb-3.5 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10.5px] flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="font-semibold leading-tight">{restoreError}</span>
          </div>
        )}

        {/* TAB 1: CREATE OR UPDATE DETAILS */}
        {activeTab === 'create' && (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-[11px]">
            {/* Reduced Compact Avatar upload container */}
            <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-lg border border-slate-150">
              <div className="relative group mb-2 shrink-0">
                {/* Compact circle */}
                <div className="w-13 h-14 rounded-full overflow-hidden border border-slate-200 shadow-xs bg-slate-200 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : null}
                  <div className={`w-full h-full ${avatarColor} text-white font-bold text-lg flex items-center justify-center`}>
                    {initialLetter}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1 rounded-full bg-[#243346] hover:bg-[#1a2533] text-white shadow-md cursor-pointer border border-white"
                  title="Upload Image"
                >
                  <Camera className="w-2.5 h-2.5" />
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-2 py-1 rounded bg-[#243346] hover:bg-[#1a2533] text-white font-semibold text-[9.5px] cursor-pointer"
                >
                  {isUploading ? 'Uploading...' : 'Upload Avatar'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="p-1 rounded border border-slate-300 hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Minimal Preset Colors picker */}
              {!avatarUrl && (
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 font-medium">Color:</span>
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setAvatarColor(col)}
                      className={`w-3 h-3 rounded-full ${col} transition-all cursor-pointer ${
                        avatarColor === col ? 'ring-1 ring-offset-1 ring-slate-900 scale-110' : 'hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Display Name Input */}
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">
                Your Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. David Miller"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#243346] text-[11px] font-sans"
              />
            </div>

            {/* Role / Subject Input */}
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">
                Role / Subject (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Tesla Autopilot Team, Hiring Manager"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#243346] text-[11px] font-sans"
              />
            </div>

            {/* Live Preview Display */}
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-150">
              <span className="block font-bold text-slate-400 text-[8.5px] uppercase tracking-wider mb-1">
                Inbox Preview
              </span>
              <div className="flex items-center gap-2 p-1 rounded bg-white border border-slate-200">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 shadow-3xs">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full ${avatarColor} text-white font-bold text-[9px] flex items-center justify-center`}>
                      {initialLetter}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 truncate text-[10px] leading-tight">{displayName}</p>
                  <p className="text-[8px] text-slate-400 truncate leading-none">{role || 'Visitor Inquiry'}</p>
                </div>
                <span className="text-[8px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-250 shrink-0">
                  Verified
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRestoring || isUploading}
                className="px-3.5 py-1 rounded bg-[#243346] hover:bg-[#1a2533] text-white font-bold cursor-pointer flex items-center gap-1 shadow-xs transition-all"
              >
                {isRestoring ? 'Saving...' : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Save Profile & Start Chat</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: RESTORE CONVERSATION */}
        {activeTab === 'restore' && (
          <form onSubmit={handleRestoreSession} className="space-y-3.5 text-[11px]">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-150 text-slate-700 leading-relaxed text-[10px]">
              <span className="font-bold text-slate-800 flex items-center gap-1 mb-0.5">
                <History className="w-3 h-3 text-cyan-600" /> Restore Account
              </span>
              Enter your saved Visitor ID (e.g. <span className="font-mono font-bold text-[9px]">visitor_...</span>) to restore your identity and message history instantly.
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">
                Visitor ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. visitor_9b1deb4d..."
                value={enteredKey}
                onChange={(e) => setEnteredKey(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#243346] text-[11px] font-mono font-semibold text-center"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRestoring}
                className="px-3.5 py-1 rounded bg-[#243346] hover:bg-[#1a2533] text-white font-bold cursor-pointer flex items-center gap-1 shadow-xs transition-all"
              >
                {isRestoring ? 'Restoring...' : 'Restore Session'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
