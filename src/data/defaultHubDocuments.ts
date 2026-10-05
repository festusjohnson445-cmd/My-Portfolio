/**
 * Engineering Archive Documents Schema for Fesline Engineering Document Hub
 * Clean repository without pre-seeded or auto-generated mock documents.
 */

export interface PublicEngineeringDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  category:
    | 'Christians Book'
    | 'Inspirational Book'
    | 'Technical Drawing'
    | '3D CAD Model'
    | 'Production Blueprint'
    | 'Whitepaper & Report'
    | 'BOM & Specification'
    | 'Calculation & Dataset';
  description: string;
  author: string;
  uploaderName: string;
  uploaderType: 'owner' | 'visitor';
  status: 'approved' | 'pending';
  uploadDate: string;
  uploadTimestamp?: number;
  downloadCount: number;
  tags: string[];
  previewUrl?: string;
  dataUrl?: string;
  downloadUrl?: string;
  hasServerFile?: boolean;
  isCustomUpload?: boolean;
}

export const DEFAULT_HUB_DOCUMENTS: PublicEngineeringDocument[] = [];
