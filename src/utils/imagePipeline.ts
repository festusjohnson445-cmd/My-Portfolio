/**
 * Automated Profile Picture Image Processing & Upload Pipeline
 *
 * Requirements:
 * 1. Accept common image uploads (JPEG, PNG, HEIC, WebP).
 * 2. Automatically crop to a perfect square and resize down to 500x500 pixels (high-DPI / Retina optimized).
 * 3. Convert processed image into modern WebP format.
 * 4. Automated encoder quality target of 80% (0.80) to maximize visual clarity with minimal byte size.
 * 5. Direct upload and persistence to the Supabase Storage 'avatars' bucket.
 * 6. Production-grade error handling for corrupted or unreadable image uploads.
 */

import heic2any from 'heic2any';
import { supabase, SUPABASE_BUCKETS } from './supabase';

export interface ImageCropParameters {
  /** Offset X in viewport pixels */
  offsetX: number;
  /** Offset Y in viewport pixels */
  offsetY: number;
  /** Zoom scale multiplier (1.0 = base scale) */
  zoom: number;
  /** Size of square viewport in UI (pixels) */
  viewportSize: number;
  /** Rotation angle in degrees (0, 90, 180, 270) */
  rotation?: number;
}

export interface LoadedImageDetails {
  image: HTMLImageElement;
  fileType: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  dataUrl: string;
}

export interface ProcessedAvatarResult {
  webpBlob: Blob;
  previewDataUrl: string;
  outputWidth: number;
  outputHeight: number;
  sizeBytes: number;
  mimeType: string;
}

/**
 * 1. Safe Image Loader & Validator
 * Validates file headers, handles HEIC/HEIF conversion, and catches corrupted image files.
 */
export async function loadAndValidateImageFile(file: File): Promise<LoadedImageDetails> {
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name);

  let processedBlob: Blob = file;

  // If HEIC/HEIF, convert to JPEG blob using heic2any
  if (isHeic) {
    try {
      const conversionResult = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.95,
      });
      processedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
    } catch (heicErr: any) {
      console.error('[HEIC Conversion Error]:', heicErr);
      throw new Error(
        'Failed to decode HEIC image. The file may be corrupted or from an unsupported iOS format.'
      );
    }
  }

  // Read blob into Data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Corrupted image file: unable to read raw file stream from device.'));
    };
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Corrupted image file: unexpected binary format.'));
      }
    };
    reader.readAsDataURL(processedBlob);
  });

  // Decode into HTMLImageElement and verify dimensions and integrity
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onerror = () => {
      reject(
        new Error(
          'Corrupted or unreadable image. Please verify the file is not damaged and try another photo.'
        )
      );
    };

    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        reject(
          new Error(
            'Invalid image dimensions detected. The file appears to be empty or corrupted.'
          )
        );
        return;
      }
      resolve(img);
    };

    img.src = dataUrl;
  });

  const fileType = isHeic ? 'HEIC (Converted to JPEG)' : (file.type || 'image/jpeg').toUpperCase().replace('IMAGE/', '');

  return {
    image,
    fileType,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    originalSizeBytes: file.size,
    dataUrl,
  };
}

/**
 * 2. Automated Crop, Resize (500x500), and WebP @ 80% Quality Pipeline
 * Converts the user-positioned workspace framing into a clean, ultra-sharp 500x500 WebP asset.
 */
export async function executeAvatarPipeline(
  image: HTMLImageElement,
  cropParams: ImageCropParameters,
  targetDimension = 500,
  encoderQuality = 0.80
): Promise<ProcessedAvatarResult> {
  const { offsetX, offsetY, zoom, viewportSize } = cropParams;

  // Offscreen canvas fixed at high-DPI 500x500 pixels
  const canvas = document.createElement('canvas');
  canvas.width = targetDimension;
  canvas.height = targetDimension;

  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) {
    throw new Error('Canvas 2D context not available on this device.');
  }

  // Use highest quality bicubic interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Base dimensions of the image in the UI viewport
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  // Calculate base scale to fit the image into the viewport
  const baseScale = Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
  const currentScale = baseScale * zoom;

  const scaledWidth = naturalWidth * currentScale;
  const scaledHeight = naturalHeight * currentScale;

  // The center of the viewport relative to the image
  // Source coordinate calculation
  const destScale = targetDimension / viewportSize;

  // Fill canvas with neutral background to prevent transparency artifacts
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetDimension, targetDimension);

  // Apply transformation matching the UI positioning
  ctx.save();
  // Translate to center of 500x500 canvas
  ctx.translate(targetDimension / 2, targetDimension / 2);
  // Apply rotation if specified
  if (cropParams.rotation) {
    ctx.rotate((cropParams.rotation * Math.PI) / 180);
  }
  // Apply the user offset scaled to 500x500
  ctx.translate(offsetX * destScale, offsetY * destScale);
  // Draw the image scaled to destination size
  const drawW = scaledWidth * destScale;
  const drawH = scaledHeight * destScale;
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Export to WebP at 80% quality target
  let mimeType = 'image/webp';
  let webpBlob: Blob | null = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', encoderQuality);
  });

  // Fallback to JPEG at 80% if WebP encoding is not supported by environment
  if (!webpBlob || webpBlob.size === 0) {
    mimeType = 'image/jpeg';
    webpBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', encoderQuality);
    });
  }

  if (!webpBlob) {
    throw new Error('Failed to encode 500x500 avatar image.');
  }

  const previewDataUrl = canvas.toDataURL(mimeType, encoderQuality);

  return {
    webpBlob,
    previewDataUrl,
    outputWidth: targetDimension,
    outputHeight: targetDimension,
    sizeBytes: webpBlob.size,
    mimeType,
  };
}

/**
 * 3. Save Output to Supabase Storage 'avatars' Bucket and Update Profile
 */
export async function uploadOptimizedAvatarToSupabase(
  blob: Blob,
  ownerUid?: string
): Promise<{ publicUrl: string; storagePath: string }> {
  // Validate active session
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !sessionData?.session?.user) {
    throw new Error('Active owner session required to upload profile picture. Please log in.');
  }

  const uid = ownerUid || sessionData.session.user.id;
  const fileExtension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `avatar_500x500_${Date.now()}.${fileExtension}`;
  const storagePath = `${uid}/${fileName}`;

  // 1. Upload to Supabase Storage bucket 'avatars'
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKETS.AVATARS)
    .upload(storagePath, blob, {
      contentType: blob.type || 'image/webp',
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('[Supabase Storage Upload Error]:', uploadError);
    throw new Error(`Failed to upload to avatars bucket: ${uploadError.message}`);
  }

  // 2. Obtain absolute public URL
  const { data: urlData } = supabase.storage
    .from(SUPABASE_BUCKETS.AVATARS)
    .getPublicUrl(storagePath);

  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) {
    throw new Error('Failed to retrieve public URL from Supabase avatars bucket.');
  }

  // 3. Persist new avatar URL into Supabase "profiles" table row
  try {
    const { resilientSupabaseUpsert } = await import('./supabase');
    await resilientSupabaseUpsert('profiles', {
      id: uid,
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    });
  } catch (dbErr) {
    console.warn('[Avatar DB Upsert Note]:', dbErr);
  }

  // 4. Update browser localStorage for 0ms visual hydration
  try {
    localStorage.setItem('fesline_stored_profile_avatar_url', publicUrl);
    window.dispatchEvent(new CustomEvent('fesline-profile-avatar-updated', { detail: { avatarUrl: publicUrl } }));
    window.dispatchEvent(new Event('storage'));
  } catch {}

  return {
    publicUrl,
    storagePath,
  };
}

