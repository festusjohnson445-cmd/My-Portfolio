import React, { useState, useRef, useEffect } from 'react';
import {
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
  ArrowRight,
  Layers,
  RotateCcw,
  Sliders,
  AlertCircle,
  X,
  FileCheck2,
  Flag,
  ChevronLeft,
  ChevronRight,
  Target,
  BarChart3,
  XCircle,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PortfolioPart } from './Navbar';
import {
  executeEaseStudyIntelligentHub,
  EaseStudyHubResult,
  recordExamScoreToSupabase,
  computeDocumentFingerprint,
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
  const [activeDocumentHash, setActiveDocumentHash] = useState<string>('');
  const [activeOutputTab, setActiveOutputTab] = useState<'summary' | 'concepts' | 'exam' | 'flashcards'>('summary');

  // Interactive Practice Exam State
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [examViewMode, setExamViewMode] = useState<'focused' | 'list'>('focused');
  const [examFilterMode, setExamFilterMode] = useState<'all' | 'incorrect' | 'flagged'>('all');
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [examScore, setExamScore] = useState<{ score: number; total: number; percentage: number } | null>(null);

  // Flashcards state
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

  const readFileAsync = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = (e.target?.result as string) || '';
        const base64Clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const mime = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
        resolve({ base64: base64Clean, mimeType: mime });
      };
      reader.onerror = () => reject(new Error('Failed to read file contents.'));
      reader.readAsDataURL(file);
    });
  };

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
      const base64Clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setFileBase64(base64Clean);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAnalysis = async () => {
    setAnalysisError(null);
    setUserAnswers({});
    setFlaggedQuestions(new Set());
    setActiveQuestionIndex(0);
    setIsQuizSubmitted(false);
    setExamScore(null);
    setExamFilterMode('all');

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
    setProcessingStatus('Analyzing document structure...');

    try {
      let activeFilePayload = null;
      if (activeInputTab === 'upload' && uploadedFile) {
        let b64 = fileBase64;
        let mime = fileMimeType;
        if (!b64 || !mime) {
          setProcessingStatus('Reading uploaded file...');
          const readRes = await readFileAsync(uploadedFile);
          b64 = readRes.base64;
          mime = readRes.mimeType;
          setFileBase64(b64);
          setFileMimeType(mime);
        }
        activeFilePayload = {
          base64: b64,
          mimeType: mime,
          fileName: uploadedFile.name,
          size: uploadedFile.size,
        };
      }

      const docFingerprint = await computeDocumentFingerprint(
        activeInputTab === 'text' ? inputText : undefined,
        activeFilePayload
      );
      setActiveDocumentHash(docFingerprint);

      const hubResult: EaseStudyHubResult = await executeEaseStudyIntelligentHub(
        {
          text: activeInputTab === 'text' ? inputText : undefined,
          fileData: activeFilePayload,
          difficulty,
          questionCount,
          focusArea: focusArea.trim(),
        },
        (status) => setProcessingStatus(status)
      );

      setStudyResult(hubResult.result);
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

  // Automated Quiz Scoring
  const handleGradeExam = () => {
    if (!studyResult?.examSuite?.multipleChoice) return;
    const mcqs = studyResult.examSuite.multipleChoice;
    let correctCount = 0;

    mcqs.forEach((mcq) => {
      const userChoice = (userAnswers[mcq.id] || '').trim().toUpperCase();
      const correctAns = mcq.correctAnswer.trim().toUpperCase();
      if (
        userChoice &&
        (userChoice === correctAns ||
          userChoice.startsWith(correctAns) ||
          correctAns.startsWith(userChoice))
      ) {
        correctCount++;
      }
    });

    const percentage = Math.round((correctCount / mcqs.length) * 100);
    const scoreResult = { score: correctCount, total: mcqs.length, percentage };
    setExamScore(scoreResult);
    setIsQuizSubmitted(true);

    // Record score silently in persistent dataset
    if (activeDocumentHash) {
      recordExamScoreToSupabase(activeDocumentHash, correctCount, mcqs.length).catch(() => {});
    }
  };

  const handleToggleFlag = (questionId: number) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const handleRetakeExam = () => {
    setUserAnswers({});
    setFlaggedQuestions(new Set());
    setActiveQuestionIndex(0);
    setIsQuizSubmitted(false);
    setExamScore(null);
    setExamFilterMode('all');
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
      pdf.text('EASESTUDY — COMPREHENSIVE STUDY GUIDE & PRACTICE EXAM', 14, 12);
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
      });

      // 3. Practice Exam Questions
      pdf.addPage();
      y = 15;
      pdf.setTextColor(14, 116, 144);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('3. PRACTICE EXAM QUESTIONS', 14, y);
      y += 8;

      studyResult.examSuite.multipleChoice.forEach((mcq) => {
        if (y > 255) {
          pdf.addPage();
          y = 15;
        }

        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        const splitQ = pdf.splitTextToSize(`Q${mcq.id}: ${mcq.question}`, 180);
        pdf.text(splitQ, 14, y);
        y += splitQ.length * 4.2 + 2;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 65, 85);
        pdf.setFontSize(8);
        mcq.options.forEach((opt) => {
          if (y > 275) {
            pdf.addPage();
            y = 15;
          }
          pdf.text(`   ${opt}`, 16, y);
          y += 4;
        });

        // Answer & Explanation
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(14, 116, 144);
        pdf.text(`   Correct Answer: ${mcq.correctAnswer}`, 16, y);
        y += 4;

        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(71, 85, 105);
        const splitExplanation = pdf.splitTextToSize(`   Explanation: ${mcq.explanation}`, 175);
        pdf.text(splitExplanation, 16, y);
        y += splitExplanation.length * 4 + 4;
      });

      pdf.save(`EaseStudy_${studyResult.topic.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.pdf`);
    } catch (pdfErr) {
      console.error('Error generating PDF:', pdfErr);
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

  // Filtered MCQs for review after submission
  const allMCQs = studyResult?.examSuite?.multipleChoice || [];
  const filteredMCQs = allMCQs.filter((mcq) => {
    if (!isQuizSubmitted || examFilterMode === 'all') return true;
    const userChoice = (userAnswers[mcq.id] || '').trim().toUpperCase();
    const correctAns = mcq.correctAnswer.trim().toUpperCase();
    const isCorrect =
      userChoice &&
      (userChoice === correctAns ||
        userChoice.startsWith(correctAns) ||
        correctAns.startsWith(userChoice));

    if (examFilterMode === 'incorrect') {
      return !isCorrect;
    }
    if (examFilterMode === 'flagged') {
      return flaggedQuestions.has(mcq.id);
    }
    return true;
  });

  const totalAnswered = Object.keys(userAnswers).length;
  const currentMCQ = allMCQs[activeQuestionIndex] || allMCQs[0];

  return (
    <div className="w-full space-y-4 font-sans">
      {/* 1. HERO HEADER - Clean, Distraction-Free */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs text-slate-800 text-center flex flex-col items-center justify-center mx-auto">
        <div className="space-y-1.5 max-w-2xl mx-auto flex flex-col items-center justify-center text-center">
          <h1 className="text-base sm:text-lg font-bold font-serif tracking-tight text-slate-900 text-center">
            EaseStudy Studio
          </h1>
          <p className="text-[10.5px] sm:text-[11.5px] text-slate-600 max-w-xl mx-auto leading-relaxed text-center">
            Upload course materials, technical papers, engineering diagrams, or paste lecture notes to generate instant executive summaries, key concept breakdowns, and complete interactive practice exams.
          </p>
        </div>
      </div>

      {/* 2. INPUT WORKSPACE CARD */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
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
                    {(uploadedFile.size / 1024).toFixed(1)} KB &middot; Ready for analysis
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
              <span>Markdown supported</span>
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

          {/* Question Count Selector */}
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

        {/* Action Button & Progress */}
        <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-xs text-cyan-900 font-medium">
              <div className="w-3.5 h-3.5 border-2 border-cyan-700 border-t-transparent rounded-full animate-spin" />
              <span>{processingStatus}</span>
            </div>
          ) : (
            <div className="text-[9.5px] text-slate-400">
              Ready to generate structured study materials
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
        <div className="space-y-3.5">
          {/* Header Specs Card */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
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

          {/* TAB 1: EXECUTIVE SUMMARY PANEL */}
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

          {/* TAB 3: INTERACTIVE PRACTICE EXAMS MODULE */}
          {activeOutputTab === 'exam' && (
            <div className="space-y-3.5">
              {/* Automated Scoring Summary Banner (when submitted) */}
              {isQuizSubmitted && examScore && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg font-mono ${
                        examScore.percentage >= 75
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : examScore.percentage >= 50
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {examScore.percentage}%
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Exam Score: {examScore.score} / {examScore.total} Correct</span>
                          <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-semibold ${
                            examScore.percentage >= 75
                              ? 'bg-emerald-100 text-emerald-800'
                              : examScore.percentage >= 50
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {examScore.percentage >= 75
                              ? 'Distinction'
                              : examScore.percentage >= 50
                              ? 'Proficient'
                              : 'Review Recommended'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {examScore.score === examScore.total
                            ? 'Exceptional mastery across all examination objectives!'
                            : `Review explanations below for ${examScore.total - examScore.score} incorrect answers.`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleRetakeExam}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retake Exam</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Mode Tabs after submission */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 text-[10px]">
                    <span className="text-slate-500 font-medium">Filter View:</span>
                    <button
                      onClick={() => setExamFilterMode('all')}
                      className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                        examFilterMode === 'all'
                          ? 'bg-cyan-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All Questions ({allMCQs.length})
                    </button>
                    <button
                      onClick={() => setExamFilterMode('incorrect')}
                      className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                        examFilterMode === 'incorrect'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      }`}
                    >
                      Incorrect Only ({examScore.total - examScore.score})
                    </button>
                    {flaggedQuestions.size > 0 && (
                      <button
                        onClick={() => setExamFilterMode('flagged')}
                        className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                          examFilterMode === 'flagged'
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        Flagged ({flaggedQuestions.size})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Question Navigation Bar & Quick-Jump Palette */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-cyan-700" />
                    <span className="font-bold text-slate-800">
                      Question Navigation ({totalAnswered} / {allMCQs.length} Answered)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Mode Switcher */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setExamViewMode('focused')}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-semibold transition-all cursor-pointer ${
                          examViewMode === 'focused'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Focused View
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamViewMode('list')}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-semibold transition-all cursor-pointer ${
                          examViewMode === 'list'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Full List View
                      </button>
                    </div>

                    {!isQuizSubmitted && (
                      <button
                        type="button"
                        onClick={handleGradeExam}
                        className="px-3 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-[10.5px] font-bold shadow-2xs transition-colors cursor-pointer"
                      >
                        Submit &amp; Grade Exam
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Numbers Strip */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {allMCQs.map((mcq, idx) => {
                    const isAnswered = Boolean(userAnswers[mcq.id]);
                    const isCurrent = activeQuestionIndex === idx;
                    const isFlagged = flaggedQuestions.has(mcq.id);

                    let pillClass = 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100';

                    if (isQuizSubmitted) {
                      const userChoice = (userAnswers[mcq.id] || '').trim().toUpperCase();
                      const correctAns = mcq.correctAnswer.trim().toUpperCase();
                      const isCorrect =
                        userChoice &&
                        (userChoice === correctAns ||
                          userChoice.startsWith(correctAns) ||
                          correctAns.startsWith(userChoice));
                      if (isCorrect) {
                        pillClass = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
                      } else {
                        pillClass = 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
                      }
                    } else if (isAnswered) {
                      pillClass = 'bg-cyan-700 text-white border-cyan-800 font-bold shadow-2xs';
                    }

                    return (
                      <button
                        key={mcq.id}
                        type="button"
                        onClick={() => {
                          setActiveQuestionIndex(idx);
                          if (examViewMode === 'list') {
                            const el = document.getElementById(`mcq-card-${mcq.id}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        className={`relative w-7 h-7 rounded-lg border text-[11px] font-mono flex items-center justify-center cursor-pointer transition-all ${pillClass} ${
                          isCurrent ? 'ring-2 ring-cyan-500 ring-offset-1 font-extrabold' : ''
                        }`}
                        title={`Question ${mcq.id}${isFlagged ? ' (Flagged)' : ''}`}
                      >
                        {mcq.id}
                        {isFlagged && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 border border-white" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VIEW MODE A: FOCUSED SINGLE QUESTION VIEW */}
              {examViewMode === 'focused' && currentMCQ && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 text-xs font-mono font-bold">
                        Question {currentMCQ.id} of {allMCQs.length}
                      </span>
                      {userAnswers[currentMCQ.id] && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Answered
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleFlag(currentMCQ.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        flaggedQuestions.has(currentMCQ.id)
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      <Flag className={`w-3 h-3 ${flaggedQuestions.has(currentMCQ.id) ? 'fill-amber-600 text-amber-600' : ''}`} />
                      <span>{flaggedQuestions.has(currentMCQ.id) ? 'Flagged' : 'Flag'}</span>
                    </button>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif leading-relaxed">
                    {currentMCQ.question}
                  </h3>

                  {/* Options */}
                  <div className="space-y-2">
                    {currentMCQ.options.map((opt, optIdx) => {
                      const optKey = opt.trim().slice(0, 1).toUpperCase();
                      const selectedOption = userAnswers[currentMCQ.id];
                      const isOptionSelected = selectedOption === optKey || selectedOption === opt;

                      let btnStyle = 'border-slate-200 bg-slate-50/70 text-slate-800 hover:bg-slate-100 hover:border-slate-300';

                      if (isQuizSubmitted) {
                        const correctAns = currentMCQ.correctAnswer.trim().toUpperCase();
                        if (optKey === correctAns || opt === currentMCQ.correctAnswer) {
                          btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold ring-1 ring-emerald-400';
                        } else if (isOptionSelected) {
                          btnStyle = 'border-rose-400 bg-rose-50 text-rose-950 ring-1 ring-rose-300';
                        }
                      } else if (isOptionSelected) {
                        btnStyle = 'border-cyan-600 bg-cyan-50/90 text-cyan-950 font-semibold ring-1 ring-cyan-500 shadow-2xs';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => {
                            if (!isQuizSubmitted) {
                              setUserAnswers((prev) => ({ ...prev, [currentMCQ.id]: optKey }));
                            }
                          }}
                          className={`w-full text-left p-3 rounded-xl border text-xs sm:text-[13px] transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center border ${
                              isOptionSelected
                                ? 'bg-cyan-700 text-white border-cyan-700'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}>
                              {optKey}
                            </span>
                            <span className="leading-snug">{opt}</span>
                          </div>

                          {isQuizSubmitted && (optKey === currentMCQ.correctAnswer.trim().toUpperCase() || opt === currentMCQ.correctAnswer) && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Detailed Explanation upon submission */}
                  {isQuizSubmitted && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 space-y-1.5 font-serif">
                      <div className="font-bold font-sans text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Correct Answer: {currentMCQ.correctAnswer}</span>
                      </div>
                      <p className="leading-relaxed text-justify text-slate-700">
                        {currentMCQ.explanation}
                      </p>
                    </div>
                  )}

                  {/* Navigation Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={activeQuestionIndex === 0}
                      onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>

                    <div className="text-[11px] font-mono text-slate-400">
                      {activeQuestionIndex + 1} / {allMCQs.length}
                    </div>

                    {activeQuestionIndex < allMCQs.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setActiveQuestionIndex((prev) => Math.min(allMCQs.length - 1, prev + 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    ) : !isQuizSubmitted ? (
                      <button
                        type="button"
                        onClick={handleGradeExam}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Submit Exam</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveQuestionIndex(0)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        <span>First Question</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW MODE B: FULL LIST VIEW */}
              {examViewMode === 'list' && (
                <div className="space-y-3">
                  {filteredMCQs.map((mcq) => {
                    const selectedOption = userAnswers[mcq.id];
                    const optKeySelected = selectedOption ? selectedOption.trim().toUpperCase() : null;
                    const correctAns = mcq.correctAnswer.trim().toUpperCase();
                    const isCorrect =
                      optKeySelected &&
                      (optKeySelected === correctAns ||
                        optKeySelected.startsWith(correctAns) ||
                        correctAns.startsWith(optKeySelected));

                    return (
                      <div
                        id={`mcq-card-${mcq.id}`}
                        key={mcq.id}
                        className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 font-sans"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-900 text-[10px] font-mono font-bold shrink-0">
                              Q{mcq.id}
                            </span>
                            <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 font-serif leading-snug">
                              {mcq.question}
                            </h4>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleFlag(mcq.id)}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 cursor-pointer"
                            title="Flag question"
                          >
                            <Flag className={`w-3.5 h-3.5 ${flaggedQuestions.has(mcq.id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                          </button>
                        </div>

                        {/* Options */}
                        <div className="space-y-1.5 pl-6">
                          {mcq.options.map((opt, optIdx) => {
                            const optKey = opt.trim().slice(0, 1).toUpperCase();
                            const isOptionSelected = selectedOption === optKey || selectedOption === opt;

                            let btnStyle = 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100';
                            if (isQuizSubmitted) {
                              if (optKey === correctAns || opt === mcq.correctAnswer) {
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
                                {isQuizSubmitted && (optKey === correctAns || opt === mcq.correctAnswer) && (
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

                  {/* Submit Button for List View */}
                  {!isQuizSubmitted && (
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleGradeExam}
                        className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Submit &amp; Grade Practice Exam ({totalAnswered} / {allMCQs.length} Answered)
                      </button>
                    </div>
                  )}
                </div>
              )}
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
