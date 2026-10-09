import React, { useState, useRef, useEffect } from 'react';
import {
  BrainCircuit,
  BookOpen,
  FileText,
  Upload,
  Sparkles,
  Download,
  Copy,
  Check,
  CheckCircle2,
  HelpCircle,
  Award,
  Clock,
  RefreshCw,
  FileImage,
  ArrowRight,
  Layers,
  RotateCcw,
  Sliders,
  AlertCircle,
  Eye,
  GraduationCap,
  X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PortfolioPart } from './Navbar';
import { saveLearningSessionToFirestore } from '../utils/firebase';
import {
  supabase,
  uploadMaterialToSupabaseBucket,
  saveMaterialToSupabaseTable,
  fetchMaterialsFromSupabaseTable,
} from '../utils/supabase';

export interface EaseStudyResponse {
  topic: string;
  difficulty: string;
  readingTime: string;
  summary: {
    executiveSummary: string;
    keyTakeaways: string[];
    coreThemes: string[];
  };
  keyConcepts: {
    title: string;
    explanation: string;
    formulaOrExample?: string;
    importance: string;
  }[];
  examSuite: {
    multipleChoice: {
      id: number;
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
    }[];
    shortAnswer: {
      id: number;
      question: string;
      idealAnswer: string;
      keyPointsRequired: string[];
    }[];
    analyticalQuestions?: {
      id: number;
      title: string;
      problemStatement: string;
      solutionSteps: string[];
      finalAnswer: string;
    }[];
  };
  flashcards?: {
    front: string;
    back: string;
  }[];
}

interface EaseStudyViewProps {
  onNavigatePart?: (part: PortfolioPart) => void;
}

export const EaseStudyView: React.FC<EaseStudyViewProps> = ({ onNavigatePart }) => {
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'text'>('upload');
  const [inputText, setInputText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPublicUrl, setUploadedPublicUrl] = useState<string | null>(null);
  const [isUploadingToSupabase, setIsUploadingToSupabase] = useState(false);
  const [supabaseUploadError, setSupabaseUploadError] = useState<string | null>(null);
  const [cloudMaterials, setCloudMaterials] = useState<any[]>([]);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);

  // Configuration options
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced' | 'exam_prep'>('intermediate');
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [focusArea, setFocusArea] = useState<string>('');

  // Processing & result state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [studyResult, setStudyResult] = useState<EaseStudyResponse | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<'summary' | 'concepts' | 'exam' | 'flashcards'>('summary');

  // Interactive Quiz State
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [userShortAnswers, setUserShortAnswers] = useState<Record<number, string>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Restore previous study session from local cache and fetch public materials from Supabase on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('fesline_easestudy_last_result');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.topic && parsed.summary) {
          setStudyResult(parsed);
        }
      }
    } catch {}

    // Public read-only access for all visitors: load materials from Supabase
    fetchMaterialsFromSupabaseTable()
      .then((mats) => {
        if (Array.isArray(mats)) {
          setCloudMaterials(mats);
        }
      })
      .catch((err) => console.warn('[Supabase Public Read Materials]:', err));
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file upload: strictly interfaces with Supabase Storage bucket 'materials'
   * Ensures write operations execute only with active session from supabase.auth.getSession()
   */
  const handleFileChange = async (file: File) => {
    setAnalysisError(null);
    setSupabaseUploadError(null);

    setUploadedFile(file);
    const mime = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    setFileMimeType(mime);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (file.type.startsWith('image/')) {
        setFilePreviewUrl(dataUrl);
      } else {
        setFilePreviewUrl(null);
      }
      const base64Clean = dataUrl.split(',')[1] || dataUrl;
      setFileBase64(base64Clean);
    };
    reader.readAsDataURL(file);

    // If active owner session is present, persist to Supabase Storage bucket 'materials'
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const activeSession = sessionData?.session;

      if (activeSession?.user) {
        setIsUploadingToSupabase(true);
        const ownerUid = activeSession.user.id;
        const uploadRes = await uploadMaterialToSupabaseBucket(file, file.name, ownerUid);
        if (uploadRes?.publicUrl) {
          setUploadedPublicUrl(uploadRes.publicUrl);
          await saveMaterialToSupabaseTable(
            {
              id: `easestudy-${Date.now()}`,
              title: file.name.replace(/\.[^/.]+$/, ''),
              fileName: file.name,
              fileSize: `${(file.size / 1024).toFixed(0)} KB`,
              fileType: file.type || 'document',
              category: 'Whitepaper & Report',
              description: `Technical study material uploaded for EaseStudy analysis: ${file.name}`,
              downloadUrl: uploadRes.publicUrl,
              fileUrl: uploadRes.publicUrl,
              previewUrl: file.type.startsWith('image/') ? uploadRes.publicUrl : undefined,
              storagePath: uploadRes.storagePath,
              tags: ['EaseStudy', 'Technical Study'],
            },
            ownerUid
          );
          fetchMaterialsFromSupabaseTable().then(setCloudMaterials).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('[EaseStudy Cloud Sync Note]:', err?.message || err);
    } finally {
      setIsUploadingToSupabase(false);
    }
  };

  const handleRunAnalysis = async () => {
    setAnalysisError(null);
    setIsAnalyzing(true);
    setUserAnswers({});
    setUserShortAnswers({});
    setIsQuizSubmitted(false);

    // Validate input
    if (activeInputTab === 'upload' && !uploadedFile && !fileBase64) {
      setAnalysisError('Please choose a document or image file to upload.');
      setIsAnalyzing(false);
      return;
    }
    if (activeInputTab === 'text' && !inputText.trim()) {
      setAnalysisError('Please enter or paste your study text / lecture notes.');
      setIsAnalyzing(false);
      return;
    }

    try {
      const payload: any = {
        difficulty,
        questionCount,
        focusArea: focusArea.trim(),
      };

      if (activeInputTab === 'text') {
        payload.text = inputText;
      } else if (fileBase64 && fileMimeType) {
        payload.fileData = {
          base64: fileBase64,
          mimeType: fileMimeType,
          fileName: uploadedFile?.name || 'document',
        };
      }

      const res = await fetch('/api/easestudy/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const rawText = await res.text().catch(() => '');
        throw new Error(
          !res.ok
            ? `Server processing failed (${res.status}). Please try again.`
            : 'Received unexpected response format from server.'
        );
      }

      if (!res.ok) {
        let rawMsg = data?.message || `Analysis request failed with status ${res.status}`;
        try {
          if (typeof rawMsg === 'string' && rawMsg.startsWith('{')) {
            const parsed = JSON.parse(rawMsg);
            if (parsed?.error?.message) {
              rawMsg = parsed.error.message;
            }
          }
        } catch {}
        throw new Error(rawMsg);
      }

      if (data && data.success && data.result) {
        setStudyResult(data.result);
        setActiveOutputTab('summary');
        
        try {
          localStorage.setItem('fesline_easestudy_last_result', JSON.stringify(data.result));
        } catch {}

        // Persist AI-generated learning session & exam suite to Firestore
        saveLearningSessionToFirestore({
          id: `session-${Date.now()}`,
          topic: data.result.topic || 'Engineering Study Guide',
          difficulty: data.result.difficulty || difficulty,
          summary: data.result.summary || '',
          concepts: data.result.keyConcepts || [],
          flashcards: data.result.flashcards || [],
          examSuite: data.result.examSuite || null,
          createdAt: new Date().toISOString(),
        }).catch((e) => console.warn('Could not persist study session to Firestore note:', e));
      } else {
        throw new Error(data?.message || 'Unable to generate study summary and exam questions.');
      }
    } catch (err: any) {
      console.warn('EaseStudy note:', err);
      setAnalysisError(err.message || 'An error occurred during AI study processing. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Interactive Quiz Score Calculation
  const calculateScore = () => {
    if (!studyResult?.examSuite?.multipleChoice) return { score: 0, total: 0, percentage: 0 };
    const mcqs = studyResult.examSuite.multipleChoice;
    let correctCount = 0;
    mcqs.forEach((mcq) => {
      const userChoice = userAnswers[mcq.id];
      const correctAns = mcq.correctAnswer.trim().toUpperCase();
      // Match either option letter (A, B, C, D) or full text
      if (
        userChoice &&
        (userChoice.trim().toUpperCase() === correctAns ||
          userChoice.startsWith(correctAns) ||
          correctAns.startsWith(userChoice))
      ) {
        correctCount++;
      }
    });
    const percentage = Math.round((correctCount / mcqs.length) * 100);
    return { score: correctCount, total: mcqs.length, percentage };
  };

  const handleExportPdf = () => {
    if (!studyResult) return;
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let y = 18;

      // Header Banner
      pdf.setFillColor(15, 30, 54);
      pdf.rect(0, 0, 210, 24, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('EASESTUDY — COMPREHENSIVE STUDY GUIDE & EXAM SUITE', 14, 12);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(148, 163, 184);
      pdf.text(`TOPIC: ${studyResult.topic}  |  DIFFICULTY: ${studyResult.difficulty.toUpperCase()}  |  DATE: ${new Date().toISOString().split('T')[0]}`, 14, 18);

      y = 32;

      // 1. Executive Summary
      pdf.setTextColor(14, 116, 144);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('1. EXECUTIVE SUMMARY & KEY THEMES', 14, y);
      y += 6;

      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      const splitSumm = pdf.splitTextToSize(studyResult.summary.executiveSummary, 180);
      pdf.text(splitSumm, 14, y);
      y += splitSumm.length * 5 + 4;

      // Key Takeaways
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Key Takeaways:', 14, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      studyResult.summary.keyTakeaways.forEach((k) => {
        if (y > 275) {
          pdf.addPage();
          y = 15;
        }
        const splitTakeaway = pdf.splitTextToSize(`• ${k}`, 175);
        pdf.text(splitTakeaway, 16, y);
        y += splitTakeaway.length * 4.5;
      });

      y += 5;
      if (y > 270) {
        pdf.addPage();
        y = 15;
      }

      // 2. Core Concepts
      pdf.setTextColor(14, 116, 144);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('2. CORE CONCEPTS & FORMULA BREAKDOWNS', 14, y);
      y += 6;

      studyResult.keyConcepts.forEach((concept, idx) => {
        if (y > 265) {
          pdf.addPage();
          y = 15;
        }
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(`${idx + 1}. ${concept.title}`, 14, y);
        y += 4.5;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(51, 65, 85);
        const splitExp = pdf.splitTextToSize(concept.explanation, 178);
        pdf.text(splitExp, 16, y);
        y += splitExp.length * 4.5;

        if (concept.formulaOrExample) {
          pdf.setFont('courier', 'bold');
          pdf.setTextColor(14, 116, 144);
          const splitFormula = pdf.splitTextToSize(`Formula/Example: ${concept.formulaOrExample}`, 175);
          pdf.text(splitFormula, 16, y);
          y += splitFormula.length * 4.5 + 2;
        }
        y += 2;
      });

      // 3. Exam Questions
      if (y > 260) {
        pdf.addPage();
        y = 15;
      } else {
        y += 4;
      }

      pdf.setTextColor(14, 116, 144);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('3. PRACTICE EXAM QUESTIONS & VERIFIED SOLUTIONS', 14, y);
      y += 6;

      studyResult.examSuite.multipleChoice.forEach((mcq) => {
        if (y > 260) {
          pdf.addPage();
          y = 15;
        }
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        const splitQ = pdf.splitTextToSize(`Q${mcq.id}: ${mcq.question}`, 178);
        pdf.text(splitQ, 14, y);
        y += splitQ.length * 4.5;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(71, 85, 105);
        mcq.options.forEach((opt) => {
          pdf.text(`   ${opt}`, 16, y);
          y += 4;
        });

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(16, 185, 129);
        pdf.text(`   Correct Answer: [${mcq.correctAnswer}] — ${mcq.explanation}`, 16, y);
        y += 6;
      });

      if (studyResult.examSuite.shortAnswer.length > 0) {
        if (y > 265) {
          pdf.addPage();
          y = 15;
        }
        pdf.setTextColor(14, 116, 144);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.text('Short Answer & Analytical Questions:', 14, y);
        y += 5;

        studyResult.examSuite.shortAnswer.forEach((sa) => {
          if (y > 260) {
            pdf.addPage();
            y = 15;
          }
          pdf.setTextColor(15, 23, 42);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          const splitSaQ = pdf.splitTextToSize(`Q${sa.id}: ${sa.question}`, 178);
          pdf.text(splitSaQ, 14, y);
          y += splitSaQ.length * 4.5;

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8.5);
          pdf.setTextColor(16, 185, 129);
          const splitIdeal = pdf.splitTextToSize(`Model Answer: ${sa.idealAnswer}`, 175);
          pdf.text(splitIdeal, 16, y);
          y += splitIdeal.length * 4.5 + 3;
        });
      }

      pdf.save(`EaseStudy_${studyResult.topic.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.warn('PDF export note:', err);
    }
  };

  const handleCopyMarkdown = () => {
    if (!studyResult) return;
    let md = `# ${studyResult.topic}\n\n`;
    md += `**Difficulty**: ${studyResult.difficulty} | **Est. Reading Time**: ${studyResult.readingTime}\n\n`;
    md += `## 1. Executive Summary\n${studyResult.summary.executiveSummary}\n\n`;
    md += `### Key Takeaways:\n`;
    studyResult.summary.keyTakeaways.forEach(t => md += `- ${t}\n`);
    md += `\n## 2. Key Concepts\n`;
    studyResult.keyConcepts.forEach((c, idx) => {
      md += `### ${idx + 1}. ${c.title}\n${c.explanation}\n`;
      if (c.formulaOrExample) md += `*Formula/Example*: \`${c.formulaOrExample}\`\n`;
      md += `\n`;
    });
    md += `## 3. Practice Exam Questions\n\n### Multiple Choice Questions:\n`;
    studyResult.examSuite.multipleChoice.forEach(q => {
      md += `**Q${q.id}**: ${q.question}\n`;
      q.options.forEach(o => md += `- ${o}\n`);
      md += `*Correct Answer*: **${q.correctAnswer}**\n*Explanation*: ${q.explanation}\n\n`;
    });
    if (studyResult.examSuite.shortAnswer.length > 0) {
      md += `### Short Answer / Conceptual Questions:\n`;
      studyResult.examSuite.shortAnswer.forEach(q => {
        md += `**Q${q.id}**: ${q.question}\n*Model Answer*: ${q.idealAnswer}\n\n`;
      });
    }

    navigator.clipboard.writeText(md);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  return (
    <div className="w-full space-y-7 font-sans">
      {/* 1. HERO HEADER BANNER (Center Justified, Text size reduced by 10%) */}
      <div className="bg-white rounded-3xl border border-slate-300 p-5 sm:p-7 shadow-sm text-slate-800 relative overflow-hidden text-center flex flex-col items-center justify-center">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#0891b2_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative z-10 space-y-2.5 max-w-3xl mx-auto flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-800 text-[10px] sm:text-[11px] font-mono font-bold tracking-wider uppercase shadow-2xs">
            <BrainCircuit className="w-3.5 h-3.5 text-cyan-700" />
            <span>EASESTUDY SUITE</span>
          </div>

          <div className="space-y-1 text-center">
            <h1 className="text-[17px] sm:text-[21px] lg:text-[23px] font-bold font-serif tracking-tight text-slate-900 text-center">
              EaseStudy - Studio
            </h1>
            <p className="text-[10px] sm:text-[11.5px] text-slate-600 max-w-2xl mx-auto leading-relaxed text-center">
              Upload Handouts, PDF papers, engineering drawings, lecture slides, or handwritten diagrams and generate instant executive summaries, key concept breakdowns, and complete interactive practice exams with step-by-step solution
            </p>
          </div>
        </div>
      </div>

      {/* 2. INPUT WORKSPACE CARD (Screenshot 3: Text size reduced by 6%, Minimum 20 Questions) */}
      <div className="bg-white p-4.5 sm:p-6 rounded-3xl border border-slate-300 shadow-sm space-y-5">
        {/* Input Method Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 pb-3.5">
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full sm:w-auto sm:min-w-[260px]">
            <button
              onClick={() => setActiveInputTab('upload')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] sm:text-[12px] font-bold transition-all cursor-pointer text-center ${
                activeInputTab === 'upload'
                  ? 'bg-cyan-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>Upload</span>
            </button>

            <button
              onClick={() => setActiveInputTab('text')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] sm:text-[12px] font-bold transition-all cursor-pointer text-center ${
                activeInputTab === 'text'
                  ? 'bg-cyan-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Paste Note</span>
            </button>
          </div>

          <span className="text-[9.5px] sm:text-[10px] font-mono text-slate-500">
            Accepts PDFs, PNG, JPG, WEBP, DOCX, &amp; Raw Text
          </span>
        </div>

        {/* Tab 1: Upload Dropzone */}
        {activeInputTab === 'upload' && (
          <div className="space-y-3.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {/* Explicit UI Error Logging for Supabase Upload or DB Operation */}
            {supabaseUploadError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="block font-bold">Storage / Database Operation Failed:</strong>
                  <span>{supabaseUploadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSupabaseUploadError(null)}
                  className="text-rose-600 hover:text-rose-900 font-bold text-xs"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div
              onClick={() => {
                if (!isUploadingToSupabase) fileInputRef.current?.click();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!isUploadingToSupabase && e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed ${
                uploadedFile ? 'border-cyan-600 bg-cyan-50/40' : 'border-slate-300 hover:border-cyan-600 bg-slate-50'
              } rounded-2xl p-5 sm:p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2.5 group`}
            >
              {isUploadingToSupabase ? (
                <div className="flex flex-col items-center space-y-2 py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-3 border-cyan-700 border-t-transparent" />
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    Uploading to Supabase "materials" bucket &amp; syncing table...
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
                    Enforcing session authentication and public URL resolution
                  </span>
                </div>
              ) : filePreviewUrl ? (
                <div className="flex flex-col items-center space-y-1.5">
                  <img
                    src={filePreviewUrl}
                    alt="Uploaded Preview"
                    loading="lazy"
                    decoding="async"
                    className="max-h-36 rounded-xl border border-slate-300 object-contain shadow-sm bg-white"
                  />
                  <span className="text-[12.5px] sm:text-[13.5px] font-bold text-slate-900">{uploadedFile?.name}</span>
                  <span className="text-[10.5px] sm:text-[11px] text-slate-500">
                    {((uploadedFile?.size || 0) / 1024).toFixed(0)} KB · Click to change file
                  </span>
                  {uploadedPublicUrl && (
                    <div className="pt-1.5">
                      <a
                        href={uploadedPublicUrl}
                        download={uploadedFile?.name || 'material.png'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer no-underline"
                      >
                        <Download className="w-3.5 h-3.5 text-white" />
                        <span>Download from Supabase Storage</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : uploadedFile ? (
                <div className="flex flex-col items-center space-y-1.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-700">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-[12.5px] sm:text-[13.5px] font-bold text-slate-900">{uploadedFile.name}</span>
                  <span className="text-[10.5px] sm:text-[11px] text-emerald-700 font-mono font-semibold">
                    {((uploadedFile.size || 0) / 1024).toFixed(0)} KB · Ready to generate study summary &amp; exam
                  </span>
                  {uploadedPublicUrl && (
                    <div className="pt-1.5">
                      <a
                        href={uploadedPublicUrl}
                        download={uploadedFile.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer no-underline"
                      >
                        <Download className="w-3.5 h-3.5 text-white" />
                        <span>Download from Supabase Storage</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5 text-center">
                    <span className="text-[12.5px] sm:text-[14px] font-bold text-slate-800 block text-center">
                      Click to choose document or image, or drag &amp; drop file here
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 block font-mono text-center">
                      PDFs, Textbook Snapshots, Handwritten Lecture Notes, Slides, Diagrams
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Public Read-Only Vault: Available Materials from Supabase */}
            {cloudMaterials.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2 font-mono">
                  Public Supabase Materials Vault ({cloudMaterials.length} available):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cloudMaterials.slice(0, 4).map((mat) => {
                    const downloadHref = mat.file_url || mat.download_url || mat.preview_url;
                    return (
                      <div
                        key={mat.id}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-cyan-50/40 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{mat.title || mat.file_name}</p>
                          <p className="text-[10px] font-mono text-slate-500 truncate">{mat.file_name} · {mat.file_size || 'Document'}</p>
                        </div>
                        {downloadHref && (
                          <a
                            href={downloadHref}
                            download={mat.file_name || 'document'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-[11px] font-semibold shrink-0 cursor-pointer no-underline shadow-2xs"
                            title="Direct download from Supabase Storage"
                          >
                            <Download className="w-3 h-3 text-white" />
                            <span>Download</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Text Area */}
        {activeInputTab === 'text' && (
          <div className="space-y-1.5">
            <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Paste Study Text, Lecture Notes, or Textbook Chapter Content:
            </label>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste text directly from your lecture notes, textbook syllabus, research summary, or study guide..."
              className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-[11.5px] sm:text-[12.5px] focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:bg-white leading-relaxed font-sans"
            />
          </div>
        )}

        {/* Study Configuration Parameters (Screenshot 3) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-slate-200">
          <div>
            <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Target Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-[11.5px] sm:text-[12.5px] font-sans focus:outline-none focus:ring-2 focus:ring-cyan-600 cursor-pointer"
            >
              <option value="beginner">Fundamental / Introductory</option>
              <option value="intermediate">Undergraduate / Practical</option>
              <option value="advanced">Advanced / Graduate Level</option>
              <option value="exam_prep">Licensure &amp; Certification Exam (FE / ASME)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Exam Questions Count
            </label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-[11.5px] sm:text-[12.5px] font-sans focus:outline-none focus:ring-2 focus:ring-cyan-600 cursor-pointer"
            >
              <option value={20}>Standard Practice (20 Questions)</option>
              <option value={25}>Deep-Dive Mastery (25 Questions)</option>
              <option value={30}>Full Comprehensive Exam (30 Questions)</option>
              <option value={40}>Mastery Intensive (40 Questions)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10.5px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Custom Focus / Topic Directive (Optional)
            </label>
            <input
              type="text"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              placeholder="e.g. Focus heavily on calculation formulas..."
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-[11.5px] sm:text-[12.5px] font-sans focus:outline-none focus:ring-2 focus:ring-cyan-600"
            />
          </div>
        </div>

        {analysisError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-[11.5px] sm:text-[12.5px] font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{analysisError}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
            {uploadedFile ? `Attached: ${uploadedFile.name}` : inputText ? `Text loaded (${inputText.length} chars)` : ''}
          </span>

          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-2xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-[11.5px] sm:text-[13px] shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Analyzing &amp; Generating Study Suite...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                <span>Generate Summary &amp; Exam Questions</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. GENERATED STUDY SUITE OUTPUT SECTION */}
      {studyResult && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Card with Navigation Tabs and Export Controls */}
          <div className="bg-white rounded-3xl border border-slate-300 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-800 text-[11px] font-mono font-bold uppercase">
                    {studyResult.difficulty}
                  </span>
                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{studyResult.readingTime}</span>
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-slate-900">
                  {studyResult.topic}
                </h2>
              </div>

              {/* Action Buttons: Export PDF & Copy Markdown */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyMarkdown}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-300"
                  title="Copy formatted study guide to clipboard"
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleExportPdf}
                  className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Download complete printable study guide and exam PDF"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Study PDF</span>
                </button>
              </div>
            </div>

            {/* Output Sub-Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveOutputTab('summary')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeOutputTab === 'summary'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Executive Summary</span>
              </button>

              <button
                onClick={() => setActiveOutputTab('concepts')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeOutputTab === 'concepts'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Core Concepts &amp; Formulas ({studyResult.keyConcepts.length})</span>
              </button>

              <button
                onClick={() => setActiveOutputTab('exam')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeOutputTab === 'exam'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Interactive Exam Suite ({studyResult.examSuite.multipleChoice.length + (studyResult.examSuite.shortAnswer?.length || 0)} Questions)</span>
              </button>

              {studyResult.flashcards && studyResult.flashcards.length > 0 && (
                <button
                  onClick={() => setActiveOutputTab('flashcards')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeOutputTab === 'flashcards'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <BrainCircuit className="w-4 h-4" />
                  <span>Flashcards ({studyResult.flashcards.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: EXECUTIVE SUMMARY */}
          {activeOutputTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-slate-300 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 font-serif">
                    High-Yield Executive Summary
                  </h3>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed text-justify">
                  {studyResult.summary.executiveSummary}
                </p>

                <div className="pt-4 border-t border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider">
                    Essential Key Takeaways
                  </h4>
                  <div className="space-y-2">
                    {studyResult.summary.keyTakeaways.map((takeaway, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{takeaway}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar: Core Themes & Study Recommendations */}
              <div className="space-y-5">
                <div className="bg-white p-6 rounded-3xl border border-slate-300 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider">
                    Core Subject Themes
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {studyResult.summary.coreThemes.map((theme, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800"
                      >
                        #{theme}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-900 to-slate-900 text-white p-6 rounded-3xl shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-cyan-300" />
                    <h4 className="text-sm font-bold font-serif">Exam Readiness Tip</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Review each core concept definition and attempt the interactive practice questions below without checking the solutions first to test active recall.
                  </p>
                  <button
                    onClick={() => setActiveOutputTab('exam')}
                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer text-center"
                  >
                    Start Practice Exam Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CORE CONCEPTS & FORMULAS */}
          {activeOutputTab === 'concepts' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {studyResult.keyConcepts.map((concept, index) => (
                <div
                  key={index}
                  className="bg-white p-6 rounded-3xl border border-slate-300 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-cyan-700 font-bold">CONCEPT 0{index + 1}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] text-slate-600">
                        {concept.importance}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 font-serif">
                      {concept.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {concept.explanation}
                    </p>
                  </div>

                  {concept.formulaOrExample && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-cyan-200 text-xs font-mono text-cyan-950 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-cyan-700 block">
                        Formula / Mathematical Model:
                      </span>
                      <span className="font-semibold block break-words">
                        {concept.formulaOrExample}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: INTERACTIVE EXAM SUITE */}
          {activeOutputTab === 'exam' && (
            <div className="space-y-6">
              {/* Exam Instructions and Score Banner */}
              <div className="bg-white p-6 rounded-3xl border border-slate-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 font-serif">
                    Practice Exam Questions &amp; Self-Assessment
                  </h3>
                  <p className="text-xs text-slate-600">
                    Select your answers below and click &quot;Submit &amp; Grade Exam&quot; for instant evaluation and step-by-step explanations.
                  </p>
                </div>

                {isQuizSubmitted && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-300">
                    <div className="text-center">
                      <span className="block text-[10px] font-mono text-emerald-800 uppercase font-bold">YOUR SCORE</span>
                      <strong className="text-lg font-bold text-emerald-900">
                        {calculateScore().score} / {calculateScore().total} ({calculateScore().percentage}%)
                      </strong>
                    </div>
                    <button
                      onClick={() => {
                        setIsQuizSubmitted(false);
                        setUserAnswers({});
                        setUserShortAnswers({});
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-900 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Multiple Choice Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider px-1">
                  Section A: Multiple Choice Questions ({studyResult.examSuite.multipleChoice.length})
                </h4>

                {studyResult.examSuite.multipleChoice.map((mcq, idx) => {
                  const selected = userAnswers[mcq.id];
                  const isCorrect = selected && (selected.trim().toUpperCase() === mcq.correctAnswer.trim().toUpperCase() || selected.startsWith(mcq.correctAnswer));

                  return (
                    <div
                      key={mcq.id}
                      className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-300 shadow-sm space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-mono text-cyan-700 font-bold">
                            QUESTION {idx + 1}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900">
                            {mcq.question}
                          </h4>
                        </div>

                        {isQuizSubmitted && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                              isCorrect
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-rose-100 text-rose-900 border border-rose-300'
                            }`}
                          >
                            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                          </span>
                        )}
                      </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {mcq.options.map((opt, optIdx) => {
                          const optionLetter = ['A', 'B', 'C', 'D'][optIdx] || '';
                          const isOptionSelected = selected === opt || selected === optionLetter;
                          const isThisTheCorrectAnswer = isQuizSubmitted && (mcq.correctAnswer.includes(optionLetter) || opt.startsWith(mcq.correctAnswer));

                          return (
                            <button
                              key={optIdx}
                              onClick={() => {
                                if (!isQuizSubmitted) {
                                  setUserAnswers({ ...userAnswers, [mcq.id]: optionLetter });
                                }
                              }}
                              disabled={isQuizSubmitted}
                              className={`p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-medium transition-all flex items-center justify-between ${
                                isThisTheCorrectAnswer
                                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400'
                                  : isOptionSelected && !isQuizSubmitted
                                  ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-bold ring-1 ring-cyan-500'
                                  : isOptionSelected && isQuizSubmitted && !isCorrect
                                  ? 'bg-rose-50 border-rose-400 text-rose-950 line-through'
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                              }`}
                            >
                              <span>{opt}</span>
                              <span className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-[10px] font-mono shrink-0 ml-2">
                                {optionLetter}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation box on submit */}
                      {isQuizSubmitted && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <strong className="text-slate-900 font-bold block">
                            Correct Answer: [{mcq.correctAnswer}]
                          </strong>
                          <p className="text-slate-700 leading-relaxed">
                            {mcq.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Short Answer / Analytical Section */}
              {studyResult.examSuite.shortAnswer && studyResult.examSuite.shortAnswer.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wider px-1">
                    Section B: Conceptual &amp; Short Answer Questions ({studyResult.examSuite.shortAnswer.length})
                  </h4>

                  {studyResult.examSuite.shortAnswer.map((sa, idx) => (
                    <div
                      key={sa.id}
                      className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-300 shadow-sm space-y-3"
                    >
                      <div className="space-y-1">
                        <span className="text-[11px] font-mono text-cyan-700 font-bold">
                          SHORT ANSWER {idx + 1}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">
                          {sa.question}
                        </h4>
                      </div>

                      {!isQuizSubmitted ? (
                        <textarea
                          rows={3}
                          value={userShortAnswers[sa.id] || ''}
                          onChange={(e) =>
                            setUserShortAnswers({ ...userShortAnswers, [sa.id]: e.target.value })
                          }
                          placeholder="Type your brief response or derivation summary..."
                          className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-300 text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-cyan-600"
                        />
                      ) : (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                              Your Answer:
                            </span>
                            <p>{userShortAnswers[sa.id] || '(No response provided)'}</p>
                          </div>

                          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 space-y-1.5">
                            <strong className="text-emerald-900 font-bold block">
                              Verified Model Answer:
                            </strong>
                            <p className="leading-relaxed">{sa.idealAnswer}</p>

                            {sa.keyPointsRequired && sa.keyPointsRequired.length > 0 && (
                              <div className="pt-2 border-t border-emerald-200 space-y-1">
                                <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 block">
                                  Key Grading Points:
                                </span>
                                {sa.keyPointsRequired.map((kp, kIdx) => (
                                  <span key={kIdx} className="block text-[11px] text-emerald-900">
                                    • {kp}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Submit Quiz Action */}
              {!isQuizSubmitted && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setIsQuizSubmitted(true)}
                    className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit &amp; Grade Exam Suite</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FLASHCARDS INTERACTIVE REVIEW */}
          {activeOutputTab === 'flashcards' && studyResult.flashcards && (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-300 shadow-sm space-y-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                <span>CARD {activeFlashcardIndex + 1} OF {studyResult.flashcards.length}</span>
                <span className="text-cyan-700 font-bold">Click card to flip</span>
              </div>

              {/* Flip Card Container */}
              <div
                onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                className="min-h-[220px] sm:min-h-[260px] p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white flex flex-col justify-between cursor-pointer select-none transition-all shadow-lg hover:shadow-xl relative overflow-hidden group"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
                  <span className="uppercase font-bold tracking-wider">
                    {isFlashcardFlipped ? 'Answer / Explanation' : 'Question / Term'}
                  </span>
                  <RotateCcw className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors" />
                </div>

                <div className="my-auto text-center py-4">
                  <p className="text-base sm:text-xl font-bold font-serif leading-relaxed">
                    {isFlashcardFlipped
                      ? studyResult.flashcards[activeFlashcardIndex].back
                      : studyResult.flashcards[activeFlashcardIndex].front}
                  </p>
                </div>

                <div className="text-center text-[11px] text-slate-400 font-mono">
                  {isFlashcardFlipped ? 'Click to show question' : 'Click to reveal answer'}
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  disabled={activeFlashcardIndex === 0}
                  onClick={() => {
                    setIsFlashcardFlipped(false);
                    setActiveFlashcardIndex(activeFlashcardIndex - 1);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Previous Card
                </button>

                <div className="flex items-center gap-1.5">
                  {studyResult.flashcards.map((_, i) => (
                    <span
                      key={i}
                      className={`block w-2 h-2 rounded-full transition-all ${
                        i === activeFlashcardIndex ? 'bg-cyan-700 w-4' : 'bg-slate-300'
                      }`}
                    />
                  ))}
                </div>

                <button
                  disabled={activeFlashcardIndex === studyResult.flashcards.length - 1}
                  onClick={() => {
                    setIsFlashcardFlipped(false);
                    setActiveFlashcardIndex(activeFlashcardIndex + 1);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Next Card
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
