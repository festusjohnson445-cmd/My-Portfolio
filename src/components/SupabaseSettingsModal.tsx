import React, { useState, useEffect } from 'react';
import {
  Database,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  Activity,
  Copy,
  Check,
  RefreshCw,
  X,
  ShieldCheck,
  HardDrive,
  Layers,
  Save,
  RotateCcw
} from 'lucide-react';
import {
  getResolvedSupabaseConfig,
  updateCustomSupabaseConfig,
  testSupabaseConnection,
  SUPABASE_RLS_SCHEMA_SQL,
  SUPABASE_BUCKETS
} from '../utils/supabase';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessNotice: (msg: string) => void;
  onSyncProfile?: () => void;
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  isOpen,
  onClose,
  onSuccessNotice,
  onSyncProfile,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [anonKeyInput, setAnonKeyInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    connected: boolean;
    latencyMs: number;
    authOk: boolean;
    profilesTableOk: boolean;
    materialsTableOk: boolean;
    avatarsBucketOk: boolean;
    materialsBucketOk: boolean;
    details: string;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getResolvedSupabaseConfig();
      setUrlInput(current.url);
      setAnonKeyInput(current.anonKey);
      setTestResults(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunTest = async () => {
    setIsTesting(true);
    try {
      const results = await testSupabaseConnection();
      setTestResults(results);
    } catch {
      setTestResults({
        connected: false,
        latencyMs: 0,
        authOk: false,
        profilesTableOk: false,
        materialsTableOk: false,
        avatarsBucketOk: false,
        materialsBucketOk: false,
        details: 'Connection error during test',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = () => {
    const cleanUrl = urlInput.trim();
    const cleanKey = anonKeyInput.trim();

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setFormError('Please enter a valid URL starting with https:// or http://');
      return;
    }

    setFormError(null);
    updateCustomSupabaseConfig(cleanUrl, cleanKey);
    onSuccessNotice('Supabase settings updated & synced successfully!');
    if (onSyncProfile) {
      onSyncProfile();
    }
    onClose();
  };

  const handleResetDefaults = () => {
    updateCustomSupabaseConfig('', '');
    const def = getResolvedSupabaseConfig();
    setUrlInput(def.url);
    setAnonKeyInput(def.anonKey);
    setTestResults(null);
    onSuccessNotice('Supabase settings reset to default.');
    if (onSyncProfile) onSyncProfile();
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_RLS_SCHEMA_SQL);
    setCopiedSql(true);
    onSuccessNotice('Supabase RLS Schema SQL copied to clipboard!');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-700 shadow-2xl overflow-hidden my-6 text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white font-serif">
                  Supabase Database &amp; Storage Settings
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10.5px] font-bold border border-emerald-500/30">
                  Live Synced
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure your Supabase PostgreSQL database, Storage Buckets, and RLS security policies.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          {/* Active Assigned Buckets & Tables Notice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                <HardDrive className="w-4 h-4" />
                <span>Assigned Storage Buckets</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-800 text-cyan-200 font-mono text-[11px]">
                  {SUPABASE_BUCKETS.AVATARS} (public)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-200 font-mono text-[11px]">
                  {SUPABASE_BUCKETS.MATERIALS} (public)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                Stores your profile photo and engineering materials attachments.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Layers className="w-4 h-4" />
                <span>Assigned Database Tables</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px]">
                  profiles
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px]">
                  materials
                </span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                Synced with Cloud SQL &amp; Firestore for zero-loss profile redundancy.
              </p>
            </div>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs flex items-center justify-between">
              <span>{formError}</span>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-red-400 hover:text-white ml-2 text-xs font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4 bg-slate-950/50 p-4 sm:p-5 rounded-2xl border border-slate-800">
            {/* 1. Supabase Project URL */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Supabase Project URL</span>
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://your-project-ref.supabase.co"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-[11px] text-slate-500">
                Found in Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL.
              </p>
            </div>

            {/* 2. Supabase Anon API Key */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span>Supabase Anon / Public Key</span>
              </label>
              <input
                type="text"
                value={anonKeyInput}
                onChange={(e) => setAnonKeyInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Found in Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys (anon public).
              </p>
            </div>
          </div>

          {/* Test Connection Button & Results */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleRunTest}
                disabled={isTesting}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Test Supabase Connection &amp; Buckets</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{showSql ? 'Hide SQL Schema' : 'View SQL Schema'}</span>
              </button>
            </div>

            {testResults && (
              <div className={`p-4 rounded-2xl border ${
                testResults.connected ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200' : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
              } space-y-2 animate-fade-in`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                    {testResults.connected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{testResults.connected ? 'Supabase Connection Live & Operational' : 'Supabase Connection Warning'}</span>
                  </div>
                  <span className="font-mono text-[11px] bg-black/40 px-2 py-0.5 rounded border border-white/10">
                    Latency: {testResults.latencyMs}ms
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div className={`p-2 rounded-lg ${testResults.authOk ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-900 text-slate-400'}`}>
                    Auth: {testResults.authOk ? '✓ Active' : '○ Standby'}
                  </div>
                  <div className={`p-2 rounded-lg ${testResults.profilesTableOk ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-900 text-slate-400'}`}>
                    profiles: {testResults.profilesTableOk ? '✓ Ready' : '○ Ready'}
                  </div>
                  <div className={`p-2 rounded-lg ${testResults.materialsTableOk ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-900 text-slate-400'}`}>
                    materials: {testResults.materialsTableOk ? '✓ Ready' : '○ Ready'}
                  </div>
                  <div className={`p-2 rounded-lg ${testResults.avatarsBucketOk ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-900 text-slate-400'}`}>
                    buckets: {testResults.avatarsBucketOk ? '✓ Ready' : '○ Ready'}
                  </div>
                </div>

                <p className="text-[11px] opacity-90 pt-1">
                  {testResults.details}
                </p>
              </div>
            )}
          </div>

          {/* SQL Blueprint Preview */}
          {showSql && (
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 animate-fade-in">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <span className="font-mono text-cyan-400 font-bold">SQL Editor Setup Script:</span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSql ? 'Copied' : 'Copy SQL'}</span>
                </button>
              </div>
              <pre className="max-h-48 overflow-y-auto font-mono text-[10.5px] text-slate-300 p-2 bg-black/50 rounded-xl leading-relaxed">
                {SUPABASE_RLS_SCHEMA_SQL}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveConfig}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save &amp; Sync Supabase</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
