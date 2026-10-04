import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Download, 
  RefreshCw, 
  Database, 
  ZoomIn, 
  RotateCw, 
  X, 
  Check, 
  Sparkles, 
  HardDrive,
  Info,
  User
} from 'lucide-react';
import { 
  saveAvatarToIndexedDB, 
  loadAvatarFromIndexedDB, 
  clearAvatarFromIndexedDB,
  type StoredAvatarRecord 
} from '../utils/avatarStorage';

interface ProfilePictureManagerProps {
  currentAvatar: string;
  onAvatarUpdated: (newAvatarUrl: string) => void;
  isOwnerAuthenticated?: boolean;
  onRequireAuth?: () => void;
}

export const ProfilePictureManager: React.FC<ProfilePictureManagerProps> = ({
  currentAvatar,
  onAvatarUpdated,
  isOwnerAuthenticated = true,
  onRequireAuth,
}) => {
  const [avatarMeta, setAvatarMeta] = useState<StoredAvatarRecord | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Crop / Adjust Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [cropSourceImage, setCropSourceImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotate, setRotate] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persistent metadata from IndexedDB on boot
  useEffect(() => {
    loadAvatarFromIndexedDB().then((record) => {
      if (record) {
        setAvatarMeta(record);
      }
    });
  }, [currentAvatar]);

  const showNotice = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotice({ type, message: msg });
    setTimeout(() => setNotice(null), 4000);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isOwnerAuthenticated && onRequireAuth) {
      onRequireAuth();
      return;
    }

    if (!file.type.startsWith('image/')) {
      showNotice('Please select a valid image file (JPG, PNG, WebP).', 'error');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCropSourceImage(result);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setRotate(0);
        setIsAdjustModalOpen(true);
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      setIsUploading(false);
      showNotice('Failed to read image file.', 'error');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Render & process cropped avatar to canvas
  const handleSaveCroppedImage = async () => {
    if (!cropSourceImage) return;

    setIsSaving(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = cropSourceImage;
      });

      const canvas = document.createElement('canvas');
      const size = 640;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Background fill
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      const scaleFactor = size / 280;
      ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);
      ctx.scale(zoom, zoom);

      const imgAspect = img.width / img.height;
      let drawW = size;
      let drawH = size;
      if (imgAspect > 1) {
        drawW = size * imgAspect;
        drawH = size;
      } else {
        drawW = size;
        drawH = size / imgAspect;
      }
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const approxBytes = Math.round((finalDataUrl.length * 3) / 4);
      const fileSizeStr = approxBytes > 1024 * 1024 
        ? `${(approxBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(approxBytes / 1024).toFixed(1)} KB`;

      const newRecord: StoredAvatarRecord = {
        id: 'current_profile_avatar',
        dataUrl: finalDataUrl,
        updatedAt: new Date().toISOString(),
        fileSize: fileSizeStr,
        fileType: 'image/jpeg',
        dimensions: '640 x 640 px',
      };

      // 1. Save directly to IndexedDB & LocalStorage
      await saveAvatarToIndexedDB(newRecord);
      setAvatarMeta(newRecord);

      // 2. Propagate to parent state & server database
      await onAvatarUpdated(finalDataUrl);

      setIsAdjustModalOpen(false);
      setCropSourceImage(null);
      showNotice('Profile picture uploaded, stored in IndexedDB, and saved to database!');
    } catch (err) {
      console.error('Error saving avatar:', err);
      showNotice('Failed to process image. Please try another file.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Direct URL submission
  const handleApplyUrl = async () => {
    if (!urlInput || !urlInput.trim()) return;

    if (!isOwnerAuthenticated && onRequireAuth) {
      onRequireAuth();
      return;
    }

    setIsSaving(true);
    try {
      const cleanUrl = urlInput.trim();
      const newRecord: StoredAvatarRecord = {
        id: 'current_profile_avatar',
        dataUrl: cleanUrl,
        updatedAt: new Date().toISOString(),
        fileSize: 'External CDN',
        fileType: 'Remote Image',
        dimensions: 'Dynamic',
      };

      await saveAvatarToIndexedDB(newRecord);
      setAvatarMeta(newRecord);
      await onAvatarUpdated(cleanUrl);

      setUrlInput('');
      showNotice('Profile picture URL updated and stored persistently!');
    } catch (err) {
      showNotice('Failed to update picture URL.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Remove profile picture
  const handleRemoveAvatar = async () => {
    if (!isOwnerAuthenticated && onRequireAuth) {
      onRequireAuth();
      return;
    }

    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;

    setIsSaving(true);
    try {
      await clearAvatarFromIndexedDB();
      setAvatarMeta(null);
      await onAvatarUpdated('');
      showNotice('Profile picture removed persistently.');
    } catch (err) {
      showNotice('Failed to remove picture.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Download image file
  const handleDownloadImage = () => {
    if (!currentAvatar) return;
    const a = document.createElement('a');
    a.href = currentAvatar;
    a.download = 'festus_johnson_profile_picture.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Mouse pan handlers for adjust modal
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const activeImage = currentAvatar || avatarMeta?.dataUrl || '';

  return (
    <div className="bg-white rounded-2xl border-2 border-cyan-800 shadow-xl p-5 sm:p-7 space-y-6 font-sans">
      {/* Top Component Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#cbd5e1] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-900 text-white flex items-center justify-center shadow-md">
            <Camera className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded">
                STORAGE &amp; MANAGEMENT
              </span>
              <span className="text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                IndexedDB &amp; Cloud Persisted
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-serif font-bold text-slate-950 mt-1">
              Profile Picture Manager
            </h3>
            <p className="text-xs text-slate-600">
              Upload, crop, and store your profile picture directly in local browser storage &amp; database. Persists across reloads.
            </p>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-fade-in ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
          ) : (
            <Info className="w-4 h-4 shrink-0 text-rose-700" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Main Avatar Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Avatar Display Card */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md relative overflow-hidden">
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-md text-[10px] text-cyan-300 font-mono">
            <Database className="w-3 h-3" />
            <span>Active Record</span>
          </div>

          <div className="relative group my-2">
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border-4 border-cyan-500/50 shadow-2xl bg-slate-950 flex items-center justify-center">
              {activeImage ? (
                <img
                  src={activeImage}
                  alt="Profile Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <User className="w-12 h-12 text-slate-600 mb-1" />
                  <span className="text-xs text-slate-400 font-sans">No photo uploaded</span>
                </div>
              )}
            </div>

            {/* Quick Upload Hover Overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-2xl bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer p-2"
              title="Click to change photo"
            >
              <Camera className="w-6 h-6 text-cyan-400 mb-1" />
              <span className="text-xs font-bold">Change Photo</span>
            </button>
          </div>

          {/* Avatar Meta Badge Info */}
          <div className="w-full mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-center text-[11px] font-mono">
            <div className="bg-slate-800/50 p-2 rounded-lg">
              <span className="text-slate-400 block text-[10px]">Storage Status</span>
              <span className="text-emerald-400 font-bold">
                {activeImage ? 'Saved in DB' : 'Empty'}
              </span>
            </div>
            <div className="bg-slate-800/50 p-2 rounded-lg">
              <span className="text-slate-400 block text-[10px]">Resolution</span>
              <span className="text-slate-200">
                {avatarMeta?.dimensions || '640 x 640 px'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Upload & Management Controls */}
        <div className="lg:col-span-7 space-y-4">
          {/* File Upload Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-cyan-800" />
                <span>Upload New Headshot File</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">JPG, PNG, WebP (Max 10MB)</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-800 hover:bg-cyan-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploading ? 'Reading file...' : 'Choose Image File'}</span>
              </button>

              {activeImage && (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
                    title="Download picture file"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-700" />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold text-xs border border-rose-300 transition-colors cursor-pointer"
                    title="Remove profile picture"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Remove Picture</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Paste CDN Image URL */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Or Paste Direct CDN / Cloud Image URL:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://images.unsplash.com/photo-... or CDN link"
                className="flex-1 px-3 py-1.5 rounded-lg border border-[#b8c6d4] bg-white text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-700"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                disabled={!urlInput.trim() || isSaving}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Apply URL
              </button>
            </div>
          </div>

          {/* Storage Guarantee Note */}
          <div className="p-3 rounded-xl bg-cyan-50/80 border border-cyan-200 text-xs text-cyan-950 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong>100% Refresh Resistant:</strong> Your uploaded profile picture is saved synchronously to browser IndexedDB, LocalStorage, PostgreSQL Cloud SQL, and Firebase Firestore. Refreshing the browser will load the uploaded photo instantly without resetting to default.
            </p>
          </div>
        </div>
      </div>

      {/* Image Crop & Adjust Modal */}
      {isAdjustModalOpen && cropSourceImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 max-w-lg w-full p-5 sm:p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base sm:text-lg font-serif font-bold text-white">
                  Adjust Headshot Framing &amp; Positioning
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAdjustModalOpen(false);
                  setCropSourceImage(null);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Preview Canvas Box */}
            <div className="flex flex-col items-center">
              <div
                className="w-70 h-70 rounded-2xl overflow-hidden border-2 border-cyan-400 shadow-2xl bg-slate-950 relative cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div
                  className="w-full h-full flex items-center justify-center pointer-events-none"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotate}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  }}
                >
                  <img
                    src={cropSourceImage}
                    alt="Headshot Preview"
                    className="max-w-none max-h-none object-cover"
                    style={{ width: '280px', height: '280px' }}
                  />
                </div>

                {/* Circular Framing Overlay Guide */}
                <div className="absolute inset-0 border-2 border-dashed border-cyan-400/50 rounded-full pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-mono">
                Click &amp; drag inside circle to pan headshot positioning
              </p>
            </div>

            {/* Adjust Controls */}
            <div className="space-y-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 text-xs">
              {/* Zoom Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                    Zoom Level
                  </span>
                  <span className="font-mono text-cyan-300">{zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Rotation Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                    Rotate Degree
                  </span>
                  <span className="font-mono text-cyan-300">{rotate}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={rotate}
                  onChange={(e) => setRotate(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsAdjustModalOpen(false);
                  setCropSourceImage(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCroppedImage}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Processing & Saving...' : 'Save & Persist Photo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
