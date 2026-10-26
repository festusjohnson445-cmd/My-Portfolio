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
  X,
  Zap,
  Database,
  FileCheck2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PortfolioPart } from './Navbar';
import {
  executeEaseStudyIntelligentHub,
  EaseStudyHubResult,
} from '../utils/easeStudyModelHub';

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
      keyPointsRequired?: string[];
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
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);

  // Configuration options
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced' | 'exam_prep'>('intermediate');
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [focusArea, setFocusArea] = useState<string>('');

  // Processing & result state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('Analyzing document...');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [studyResult, setStudyResult] = useState<EaseStudyResponse | null>(null);
  const [lastHubMeta, setLastHubMeta] = useState<{
    source: 'advanced_learned_model' | 'base_ai_pipeline';
    executionTimeMs: number;
    learnedCacheHit: boolean;
  } | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<'summary' | 'concepts' | 'exam' | 'flashcards'>('summary');

  // Interactive Quiz State
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [userShortAnswers, setUserShortAnswers] = useState<Record<number, string>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore previous study session from local cache on mount
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
  }, []);

  const handleFileChange = (file: File) => {
    setAnalysisError(null);
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
  };

  const handleRunAnalysis = async () => {
    setAnalysisError(null);
    setUserAnswers({});
    setUserShortAnswers({});
    setIsQuizSubmitted(false);

    // Validate input
    if (activeInputTab === 'upload' && !uploadedFile && !fileBase64) {
      setAnalysisError('Please choose a document or image file to analyze.');
      return;
    }
    if (activeInputTab === 'text' && !inputText.trim()) {
      setAnalysisError('Please enter or paste your study notes or technical text.');
      return;
    }

    setIsAnalyzing(true);
    setProcessingStatus('Analyzing document...');

    try {
      const hubResult: EaseStudyHubResult = await executeEaseStudyIntelligentHub(
        {
          text: activeInputTab === 'text' ? inputText : undefined,
          fileData:
            fileBase64 && fileMimeType && uploadedFile
              ? {
                  base64: fileBase64,
                  mimeType: fileMimeType,
                  fileName: uploadedFile.name,
                  size: uploadedFile.size,
                }
              : null,
          difficulty,
          questionCount,
          focusArea: focusArea.trim(),
        },
        (status) => setProcessingStatus(status)
      );

      setStudyResult(hubResult.result);
      setLastHubMeta({
        source: hubResult.source,
        executionTimeMs: hubResult.executionTimeMs,
        learnedCacheHit: hubResult.learnedCacheHit,
      });
      setActiveOutputTab('summary');

      try {
        localStorage.setItem('fesline_easestudy_last_result', JSON.stringify(hubResult.result));
      } catch {}
    } catch (err: any) {
      setAnalysisError(
        err?.message || 'Document analysis is temporarily unavailable. Please try again.'
      );
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
      pdf.setFontSize(12);
      pdf.text('EASESTUDY — COMPREHENSIVE STUDY GUIDE & EXAM SUITE', 14, 12);
      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        `TOPIC: ${studyResult.topic}  |  DIFFICULTY: ${studyResult.difficulty.toUpperCase()}  |  DATE: ${
          new Date().toISOString().split('T')[0]
        }`,
        14,
        18
      );

      y = 32;

      // 1. Executive Summary
      pdf.setTextColor(14, 116, 144);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('1. EXECUTIVE SUMMARY & KEY THEMES', 14, y);
      y += 6;

      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      const splitSummary = pdf.splitTextToSize(studyResult.summary.executiveSummary, 182);
      pdf.text(splitSummary, 14, y);
      y += splitSummary.length * 4.5 + 4;

      // Key Takeaways
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(14, 116, 144);
      pdf.text('Key Takeaways:', 14, y);
      y += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      studyResult.summary.keyTakeaways.forEach((point) => {
        const splitPoint = pdf.splitTextToSize(`• ${point}`, 178);
        pdf.text(splitPoint, 16, y);
        y += splitPoint.length * 4.2;
      });

      // 2. Key Concepts
      if (y > 255) {
        pdf.addPage();
        y = 15;
      } else {
        y += 4;
      }

      pdf.setTextColor(14, 116, 144);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('2. CORE CONCEPTS & THEORETICAL BREAKDOWNS', 14, y);
      y += 6;

      studyResult.keyConcepts.forEach((concept, index) => {
        if (y > 260) {
          pdf.addPage();
          y = 15;
        }
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text(`${index + 1}. ${concept.title}`, 14, y);
        y += 4.5;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(51, 65, 85);
        const splitExp = pdf.splitTextToSize(concept.explanation, 178);
        pdf.text(splitExp, 16, y);
        y += splitExp.length * 4.2;

        if (concept.formulaOrExample) {
          pdf.setFont('courier', 'bold');
          pdf.setTextColor(14, 116, 144);
          const splitFormula = pdf.splitTextToSize(`Formula/Example: ${concept.formulaOrExample}`, 175);
          pdf.text(splitFormula, 16, y);
          y += splitFormula.length * 4.2 + 2;
        }
        y += 2;
      });

      // 3. Exam Questions
      if (y > 255) {
        pdf.addPage();
        y = 15;
      } else {
        y += 4;
      }

      pdf.setTextColor(14, 116, 144);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('3. PRACTICE EXAM QUESTIONS & VERIFIED SOLUTIONS', 14, y);
      y += 6;

      studyResult.examSuite.multipleChoice.forEach((mcq) => {
        if (y > 260) {
          pdf.addPage();
          y = 15;
        }
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        const splitQ = pdf.splitTextToSize(`Q${mcq.id}: ${mcq.question}`, 178);
        pdf.text(splitQ, 14, y);
        y += splitQ.length * 4.2;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        mcq.options.forEach((opt) => {
          pdf.text(`   ${opt}`, 16, y);
          y += 3.8;
        });

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(16, 185, 129);
        pdf.text(`   Correct Answer: [${mcq.correctAnswer}] — ${mcq.explanation}`, 16, y);
        y += 5.5;
      });

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
    studyResult.summary.keyTakeaways.forEach((t) => (md += `- ${t}\n`));
    md += `\n## 2. Key Concepts\n`;
    studyResult.keyConcepts.forEach((c, idx) => {
      md += `### ${idx + 1}. ${c.title}\n${c.explanation}\n`;
      if (c.formulaOrExample) md += `*Formula/Example*: \`${c.formulaOrExample}\`\n`;
      md += `\n`;
    });
    md += `## 3. Practice Exam Questions\n\n`;
    studyResult.examSuite.multipleChoice.forEach((q) => {
      md += `**Q${q.id}**: ${q.question}\n`;
      q.options.forEach((o) => (md += `- ${o}\n`));
      md += `*Correct Answer*: **${q.correctAnswer}**\n*Explanation*: ${q.explanation}\n\n`;
    });

    navigator.clipboard.writeText(md);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  return (
    <div className="w-full space-y-5 font-sans">
      {/* 1. HERO HEADER BANNER - Small Sized & Clean */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs text-slate-800 relative overflow-hidden text-center flex flex-col items-center justify-center mx-auto">
        <div className="space-y-1.5 max-w-2xl mx-auto flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-[9px] font-mono font-bold tracking-wider uppercase">
            <BrainCircuit className="w-3 h-3 text-cyan-700" />
            <span>EASESTUDY INTELLIGENT MODEL &amp; STORAGE HUB</span>
          </div>

          <h1 className="text-sm sm:text-base font-bold font-serif tracking-tight text-slate-900 text-center">
            EaseStudy Studio
          </h1>
          <p className="text-[10px] sm:text-[11px] text-slate-600 max-w-xl mx-auto leading-relaxed text-center">
            Upload course handouts, technical papers, engineering diagrams, or paste lecture notes to generate instant executive summaries, key concept breakdowns, and complete interactive practice exam suites.
          </p>
        </div>
      </div>

      {/* 2. INPUT WORKSPACE CARD - Small Buttons and Headers */}
      <div className="bg-white p-3.5 sm:p-4.5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Input Method Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 w-full sm:w-auto sm:min-w-[210px]">
            <button
              onClick={() => setActiveInputTab('upload')}
              className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                activeInputTab === 'upload'
                  ? 'bg-cyan-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3 h-3 shrink-0" />
              <span>Upload Document</span>
            </button>

            <button
              onClick={() => setActiveInputTab('text')}
              className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                activeInputTab === 'text'
                  ? 'bg-cyan-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span>Paste Notes</span>
            </button>
          </div>

          <span className="text-[9px] font-mono text-slate-400">
            PDF, DOCX, TXT, PNG, JPG, WEBP
          </span>
        </div>

        {/* Tab 1: Upload Dropzone */}
        {activeInputTab === 'upload' && (
          <div className="space-y-2">
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

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed ${
                uploadedFile ? 'border-cyan-600 bg-cyan-50/40' : 'border-slate-200 hover:border-cyan-600 bg-slate-50/60'
              } rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-1.5`}
            >
              {filePreviewUrl ? (
                <div className="flex flex-col items-center space-y-1">
                  <img
                    src={filePreviewUrl}
                    alt="Uploaded Preview"
                    className="max-h-24 rounded-lg border border-slate-200 object-contain shadow-2xs bg-white"
                  />
                  <span className="text-[10px] font-bold text-slate-800">{uploadedFile?.name}</span>
                  <span className="text-[9px] text-slate-500">Click or drag to replace file</span>
                </div>
              ) : uploadedFile ? (
                <div className="flex flex-col items-center space-y-1">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-900">{uploadedFile.name}</span>
                  <span className="text-[9px] text-slate-500">
                    {(uploadedFile.size / 1024).toFixed(1)} KB &middot; Ready for intelligent analysis
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                    <Upload className="w-4 h-4 text-cyan-700" />
                  </div>
                  <div className="text-[11px] font-bold text-slate-800">
                    Click to select or drag and drop your study document
                  </div>
                  <div className="text-[9.5px] text-slate-500">
                    Textbooks, handouts, lecture notes, or diagrams
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Text Note Input */}
        {activeInputTab === 'text' && (
          <div className="space-y-1.5">
            <textarea
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste lecture notes, technical formulas, research articles, or study material here..."
              className="w-full p-3 rounded-xl border border-slate-200 focus:border-cyan-700 focus:ring-1 focus:ring-cyan-700 text-xs text-slate-800 placeholder-slate-400 font-mono transition-all resize-y"
            />
            <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
              <span>{inputText.length} characters</span>
              <span>Rich technical markdown supported</span>
            </div>
          </div>
        )}

        {/* Parameters: Difficulty, Question Count & Focus Area */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Difficulty */}
          <div className="space-y-1">
            <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Sliders className="w-2.5 h-2.5 text-cyan-700" />
              <span>Target Level</span>
            </label>
            <select
              value={difficulty}
              onChange={(e: any) => setDifficulty(e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[10.5px] font-medium bg-slate-50 text-slate-800 focus:border-cyan-700 cursor-pointer"
            >
              <option value="beginner">Foundational / Introductory</option>
              <option value="intermediate">Undergraduate / Intermediate</option>
              <option value="advanced">Advanced / Professional</option>
              <option value="exam_prep">Rigorous Exam Preparation</option>
            </select>
          </div>

          {/* Question Count Selector (Expanded options as specified) */}
          <div className="space-y-1">
            <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <HelpCircle className="w-2.5 h-2.5 text-cyan-700" />
              <span>Questions to Generate</span>
            </label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[10.5px] font-medium bg-slate-50 text-slate-800 focus:border-cyan-700 cursor-pointer"
            >
              <option value={10}>10 Questions (Quick Review)</option>
              <option value={20}>20 Questions (Standard Suite)</option>
              <option value={30}>30 Questions (In-Depth Exam)</option>
              <option value={40}>40 Questions (Comprehensive Master Suite)</option>
            </select>
          </div>

          {/* Optional Focus Area */}
          <div className="space-y-1">
            <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
              Special Focus (Optional)
            </label>
            <input
              type="text"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              placeholder="e.g. Thermodynamics, Kinematics..."
              className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-[10.5px] bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-cyan-700"
            />
          </div>
        </div>

        {/* Error Notification */}
        {analysisError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[10.5px] flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="flex-1">{analysisError}</span>
            <button
              onClick={() => setAnalysisError(null)}
              className="text-rose-600 hover:text-rose-900 font-bold text-[10px] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Primary Action Button & Real-time Progress */}
        <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-xs text-cyan-900 font-medium animate-pulse">
              <div className="w-3.5 h-3.5 border-2 border-cyan-700 border-t-transparent rounded-full animate-spin" />
              <span>{processingStatus}</span>
            </div>
          ) : (
            <div className="text-[9.5px] text-slate-500 font-mono">
              Continuous learning hub active &middot; Instant cache bypass ready
            </div>
          )}

          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Processing Study Suite...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-cyan-200" />
                <span>Generate Study Package</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. OUTPUT WORKSPACE & STUDY RESULTS DASHBOARD */}
      {studyResult && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header Specs Card */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {/* Real-time Processing Status Indicator */}
                {lastHubMeta?.learnedCacheHit ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9.5px] font-semibold shadow-2xs">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-700" />
                    <span>Advanced Learned Model Cache Match</span>
                    <span className="text-[8.5px] font-mono text-emerald-700">({lastHubMeta.executionTimeMs}ms)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 border border-cyan-300 text-[9.5px] font-semibold shadow-2xs">
                    <Zap className="w-2.5 h-2.5 text-cyan-700" />
                    <span>Base AI Multi-Model Pipeline</span>
                    {lastHubMeta?.executionTimeMs && (
                      <span className="text-[8.5px] font-mono text-cyan-700">({lastHubMeta.executionTimeMs}ms)</span>
                    )}
                  </span>
                )}

                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9.5px] font-mono border border-slate-200">
                  {studyResult.difficulty.toUpperCase()}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9.5px] font-mono border border-slate-200">
                  {studyResult.readingTime}
                </span>
              </div>

              <h2 className="text-xs sm:text-sm md:text-[14px] font-bold text-slate-900 font-serif leading-tight">
                {studyResult.topic}
              </h2>
            </div>

            {/* Actions: Export PDF, Copy Markdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                title="Copy markdown study notes"
              >
                {copiedNotification ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-[10px] font-semibold transition-colors cursor-pointer shadow-2xs"
                title="Export complete study package to PDF"
              >
                <Download className="w-3 h-3" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Navigation Output Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto">
            <button
              onClick={() => setActiveOutputTab('summary')}
              className={`flex-1 min-w-[100px] py-1 px-2 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                activeOutputTab === 'summary'
                  ? 'bg-cyan-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Executive Summary
            </button>
            <button
              onClick={() => setActiveOutputTab('concepts')}
              className={`flex-1 min-w-[100px] py-1 px-2 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                activeOutputTab === 'concepts'
                  ? 'bg-cyan-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Core Concepts ({studyResult.keyConcepts?.length || 0})
            </button>
            <button
              onClick={() => setActiveOutputTab('exam')}
              className={`flex-1 min-w-[100px] py-1 px-2 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                activeOutputTab === 'exam'
                  ? 'bg-cyan-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Practice Exam Suite ({studyResult.examSuite?.multipleChoice?.length || 0})
            </button>
            {studyResult.flashcards && studyResult.flashcards.length > 0 && (
              <button
                onClick={() => setActiveOutputTab('flashcards')}
                className={`flex-1 min-w-[100px] py-1 px-2 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                  activeOutputTab === 'flashcards'
                    ? 'bg-cyan-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active Flashcards ({studyResult.flashcards.length})
              </button>
            )}
          </div>

          {/* TAB 1: INTERACTIVE SUMMARY PANEL */}
          {activeOutputTab === 'summary' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              {/* Executive Summary Narrative */}
              <div className="space-y-1.5">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block">
                  Executive Narrative
                </span>
                <p className="text-xs sm:text-[13px] text-slate-800 font-serif leading-relaxed text-justify">
                  {studyResult.summary.executiveSummary}
                </p>
              </div>

              {/* Key Takeaways */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block">
                  Key Takeaways &amp; Refined Insights
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {studyResult.summary.keyTakeaways.map((takeaway, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-2 text-xs text-slate-800 leading-relaxed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-700 shrink-0 mt-0.5" />
                      <span>{takeaway}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Themes Taxonomy */}
              {studyResult.summary.coreThemes && studyResult.summary.coreThemes.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  <span className="text-[9.5px] font-bold uppercase text-slate-400 mr-1">Core Themes:</span>
                  {studyResult.summary.coreThemes.map((theme, tIdx) => (
                    <span
                      key={tIdx}
                      className="px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-900 text-[10px] font-medium"
                    >
                      #{theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CORE CONCEPTS BREAKDOWN */}
          {activeOutputTab === 'concepts' && (
            <div className="space-y-2.5">
              {studyResult.keyConcepts.map((concept, idx) => (
                <div
                  key={idx}
                  className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-800 text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 font-serif">
                        {concept.title}
                      </h3>
                    </div>
                    <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                      Importance: {concept.importance}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-serif text-justify">
                    {concept.explanation}
                  </p>

                  {concept.formulaOrExample && (
                    <div className="p-2 rounded-lg bg-slate-900 text-cyan-200 text-[11px] font-mono overflow-x-auto">
                      <span className="text-slate-400 text-[9.5px] block">Formula / Working Principle:</span>
                      {concept.formulaOrExample}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: PRACTICE EXAM SUITE */}
          {activeOutputTab === 'exam' && (
            <div className="space-y-4">
              {/* Score Bar */}
              {isQuizSubmitted && (
                <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-between text-xs font-sans">
                  {(() => {
                    const { score, total, percentage } = calculateScore();
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-cyan-800" />
                          <span className="font-bold text-slate-900">
                            Exam Result: {score} / {total} Correct ({percentage}%)
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-cyan-900">
                          {percentage >= 75 ? 'Distinction Level' : 'Review Recommended'}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* MCQs */}
              <div className="space-y-3">
                {studyResult.examSuite.multipleChoice.map((mcq) => {
                  const selectedOption = userAnswers[mcq.id];
                  const isCorrect =
                    selectedOption &&
                    (selectedOption.trim().toUpperCase() === mcq.correctAnswer.trim().toUpperCase() ||
                      selectedOption.startsWith(mcq.correctAnswer));

                  return (
                    <div
                      key={mcq.id}
                      className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 font-sans"
                    >
                      <div className="flex items-start gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-900 text-[10px] font-mono font-bold shrink-0">
                          Q{mcq.id}
                        </span>
                        <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 font-serif leading-snug">
                          {mcq.question}
                        </h4>
                      </div>

                      {/* Options */}
                      <div className="space-y-1.5 pl-6">
                        {mcq.options.map((opt, optIdx) => {
                          const optKey = opt.trim().slice(0, 1).toUpperCase();
                          const isOptionSelected = selectedOption === optKey || selectedOption === opt;

                          let btnStyle = 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100';
                          if (isQuizSubmitted) {
                            if (optKey === mcq.correctAnswer.trim().toUpperCase() || opt === mcq.correctAnswer) {
                              btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                            } else if (isOptionSelected) {
                              btnStyle = 'border-rose-400 bg-rose-50 text-rose-900';
                            }
                          } else if (isOptionSelected) {
                            btnStyle = 'border-cyan-600 bg-cyan-50 text-cyan-950 font-semibold';
                          }

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => {
                                if (!isQuizSubmitted) {
                                  setUserAnswers((prev) => ({ ...prev, [mcq.id]: optKey }));
                                }
                              }}
                              className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                            >
                              <span>{opt}</span>
                              {isQuizSubmitted && (optKey === mcq.correctAnswer.trim().toUpperCase() || opt === mcq.correctAnswer) && (
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation after submission */}
                      {isQuizSubmitted && (
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Correct Answer: {mcq.correctAnswer}</span>
                          </div>
                          <p className="leading-relaxed font-serif">{mcq.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Quiz Button */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {isQuizSubmitted ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuizSubmitted(false);
                      setUserAnswers({});
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
                  >
                    Reset Answers
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsQuizSubmitted(true)}
                    className="px-4 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    Submit &amp; Check Exam Answers
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVE RECALL FLASHCARDS */}
          {activeOutputTab === 'flashcards' && studyResult.flashcards && studyResult.flashcards.length > 0 && (
            <div className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center justify-between w-full text-xs text-slate-500 font-mono">
                <span>Card {activeFlashcardIndex + 1} of {studyResult.flashcards.length}</span>
                <span>Click card to flip</span>
              </div>

              <div
                onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                className={`w-full max-w-lg min-h-[160px] p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center text-center select-none shadow-sm ${
                  isFlashcardFlipped
                    ? 'border-emerald-500 bg-emerald-50/50 text-slate-900'
                    : 'border-cyan-600 bg-cyan-50/40 text-slate-900'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {isFlashcardFlipped ? 'Answer & Explanation' : 'Concept / Challenge'}
                </span>
                <p className="text-sm sm:text-base font-bold font-serif leading-relaxed">
                  {isFlashcardFlipped
                    ? studyResult.flashcards[activeFlashcardIndex].back
                    : studyResult.flashcards[activeFlashcardIndex].front}
                </p>
              </div>

              {/* Navigator */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeFlashcardIndex === 0}
                  onClick={() => {
                    setIsFlashcardFlipped(false);
                    setActiveFlashcardIndex((prev) => Math.max(0, prev - 1));
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                  className="px-3 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Flip Card
                </button>
                <button
                  type="button"
                  disabled={activeFlashcardIndex === studyResult.flashcards.length - 1}
                  onClick={() => {
                    setIsFlashcardFlipped(false);
                    setActiveFlashcardIndex((prev) => Math.min(studyResult.flashcards!.length - 1, prev + 1));
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
