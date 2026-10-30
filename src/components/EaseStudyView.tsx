import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  BrainCircuit,
  ClipboardCheck,
  History,
  Sparkles,
  Download,
  Copy,
  Check,
  Award,
  Clock,
  RefreshCw,
  FolderOpen,
  X,
  MessageSquare,
  Send,
  AlertCircle,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PortfolioPart } from './Navbar';
import {
  executeEaseStudyIntelligentHub,
  EaseStudyHubResult,
  computeDocumentFingerprint,
  generateConceptVisualDiagram,
  VisualDiagramResult,
  STANDARD_EASESTUDY_BENCHMARKS,
  seedModeEaseStudyDataset,
  syncGuestSession,
  askDocumentAssistant,
  fetchGuestActivities,
  recordGuestActivity,
} from '../utils/easeStudyModelHub';
import { extractCleanTextFromFile } from '../utils/documentTextExtractor';

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

type StudyOutputTab = 'summary' | 'concepts' | 'exam' | 'flashcards' | 'diagrams' | 'chat';

export const EaseStudyView: React.FC<EaseStudyViewProps> = () => {
  // Navigation & View States
  const [activeOutputTab, setActiveOutputTab] = useState<StudyOutputTab>('summary');
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [isPastingNotes, setIsPastingNotes] = useState(false);

  // Document & Input States
  const [inputText, setInputText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);
  const [fileExtractedText, setFileExtractedText] = useState<string>('');
  const [activeDocumentHash, setActiveDocumentHash] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Analysis & Processing States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [difficulty] = useState<'beginner' | 'intermediate' | 'advanced' | 'exam_prep'>('intermediate');
  const [questionCount] = useState<number>(15);
  const [focusArea] = useState<string>('');
  const [isEngineeringDoc, setIsEngineeringDoc] = useState(false);
  const [studyResult, setStudyResult] = useState<EaseStudyResponse | null>(null);

  // Activities & Sessions
  const [, setGuestSessionId] = useState<string>('');
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  // Examination Practice States
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [, setActiveQuestionIndex] = useState(0);
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [examScore, setExamScore] = useState<{ score: number; percentage: number; total: number } | null>(null);
  const [examFilterMode, setExamFilterMode] = useState<'all' | 'incorrect' | 'flagged'>('all');

  // Flashcards States
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  const [masteredFlashcards, setMasteredFlashcards] = useState<Set<number>>(new Set());

  // Visual Diagrams States
  const [generatedDiagrams, setGeneratedDiagrams] = useState<Record<string, VisualDiagramResult>>({});
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [activeDiagramKey, setActiveDiagramKey] = useState<string>('');

  // "Ask Your Document" Chat States
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; citations?: string[] }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);

  // UI Notifications
  const [copiedNotification, setCopiedNotification] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Guest Session and Data on mount
  useEffect(() => {
    const initSession = async () => {
      const sess = await syncGuestSession();
      setGuestSessionId(sess.sessionId);
      const acts = await fetchGuestActivities();
      setRecentActivities(acts);
    };
    initSession();
    seedModeEaseStudyDataset();

    // Check if there is a previously saved active result
    try {
      const savedResult = localStorage.getItem('fesline_easestudy_last_result');
      if (savedResult) {
        const parsed = JSON.parse(savedResult);
        if (parsed?.topic && parsed?.summary) {
          setStudyResult(parsed);
        }
      }
    } catch {}
  }, []);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (isChatDrawerOpen || activeOutputTab === 'chat') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatDrawerOpen, activeOutputTab]);

  // File Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = async (file: File) => {
    if (file.size > 26214400) {
      setAnalysisError('File exceeds the 25MB maximum size limit.');
      return;
    }
    setUploadedFile(file);
    setFileMimeType(file.type || 'application/octet-stream');
    setAnalysisError(null);
    setProcessingStatus('Extracting document contents...');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const base64Clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        setFileBase64(base64Clean);

        // Clean text extraction
        const cleanExtracted = await extractCleanTextFromFile(file);
        setFileExtractedText(cleanExtracted);

        // Run analysis automatically upon file drop / select
        runAnalysisWithPayload(file, base64Clean, file.type, cleanExtracted, false);
      };
      reader.readAsDataURL(file);
    } catch {
      setAnalysisError('Could not process this document. Please try a PDF, DOCX, or text file.');
    }
  };

  // Run Document Analysis Pipeline
  const runAnalysisWithPayload = async (
    file: File | null,
    b64: string | null,
    mime: string | null,
    extractedTxt: string,
    forceRegenerate: boolean = false
  ) => {
    setAnalysisError(null);
    setUserAnswers({});
    setFlaggedQuestions(new Set());
    setActiveQuestionIndex(0);
    setIsQuizSubmitted(false);
    setExamScore(null);
    setExamFilterMode('all');

    if (forceRegenerate) {
      setStudyResult(null);
      setGeneratedDiagrams({});
      try {
        localStorage.removeItem('fesline_easestudy_last_result');
      } catch {}
    }

    setIsAnalyzing(true);
    setProcessingStatus(forceRegenerate ? 'Reprocessing fresh output from raw document...' : 'Analyzing document structure...');

    try {
      let activeFilePayload = null;
      if (file && b64) {
        activeFilePayload = {
          base64: b64,
          mimeType: mime || file.type || 'application/pdf',
          fileName: file.name,
          size: file.size,
          extractedText: extractedTxt || undefined,
        };
      }

      const docFingerprint = await computeDocumentFingerprint(
        !file ? inputText : undefined,
        activeFilePayload
      );
      setActiveDocumentHash(docFingerprint);

      const hubResult: EaseStudyHubResult = await executeEaseStudyIntelligentHub(
        {
          text: !file ? inputText : undefined,
          fileData: activeFilePayload,
          difficulty,
          questionCount,
          focusArea: focusArea.trim(),
          isEngineeringDoc,
          forceRegenerate,
        },
        (status) => setProcessingStatus(status)
      );

      setStudyResult(hubResult.result);
      setShowWorkspace(true);
      setActiveOutputTab('summary');

      // Record activity
      recordGuestActivity({
        topic: hubResult.result.topic,
        fileName: file?.name || 'Pasted Notes',
        totalQuestions: hubResult.result.examSuite?.multipleChoice?.length || questionCount,
        activityType: file ? 'document_analyzed' : 'notes_pasted',
      });

      // Refresh recent activities
      const acts = await fetchGuestActivities();
      setRecentActivities(acts);

      // Cache locally
      try {
        localStorage.setItem('fesline_easestudy_last_result', JSON.stringify(hubResult.result));
      } catch {}
    } catch (err: any) {
      setAnalysisError(err?.message || 'Document analysis is temporarily unavailable. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunTextAnalysis = () => {
    if (!inputText.trim()) {
      setAnalysisError('Please enter or paste your study notes before analyzing.');
      return;
    }
    setUploadedFile(null);
    setFileBase64(null);
    setFileExtractedText(inputText.trim());
    runAnalysisWithPayload(null, null, null, inputText.trim(), false);
  };

  const handleRegenerate = () => {
    if (activeDocumentHash) {
      try {
        const localRaw = localStorage.getItem('fesline_mode_easestudy_dataset_cache');
        if (localRaw) {
          const cacheMap = JSON.parse(localRaw);
          delete cacheMap[activeDocumentHash];
          localStorage.setItem('fesline_mode_easestudy_dataset_cache', JSON.stringify(cacheMap));
        }
      } catch {}
    }
    if (uploadedFile && fileBase64) {
      runAnalysisWithPayload(uploadedFile, fileBase64, fileMimeType, fileExtractedText, true);
    } else if (inputText.trim()) {
      runAnalysisWithPayload(null, null, null, inputText.trim(), true);
    }
  };

  // Standard Benchmark Loader
  const handleLoadBenchmark = (benchmarkId: string) => {
    const benchmark = STANDARD_EASESTUDY_BENCHMARKS.find((b) => b.id === benchmarkId);
    if (!benchmark) return;

    setUploadedFile(null);
    setFileBase64(null);
    setInputText(benchmark.sampleText);
    setFileExtractedText(benchmark.sampleText);
    setStudyResult(benchmark.precomputedPackage);
    setActiveDocumentHash(`benchmark_${benchmark.id}`);
    setIsEngineeringDoc(benchmark.isEngineeringDoc);
    setShowWorkspace(true);
    setActiveOutputTab('summary');

    recordGuestActivity({
      topic: benchmark.title,
      fileName: `${benchmark.title}.txt`,
      totalQuestions: benchmark.precomputedPackage.examSuite.multipleChoice.length,
      activityType: 'document_analyzed',
    });
  };

  // Visual Diagram Generator
  const handleGenerateDiagram = async (conceptTitle: string, description: string) => {
    if (!studyResult) return;
    setIsGeneratingDiagram(true);
    setActiveDiagramKey(conceptTitle);

    try {
      const diagram = await generateConceptVisualDiagram(
        studyResult.topic,
        conceptTitle,
        description,
        isEngineeringDoc,
        activeDocumentHash
      );
      setGeneratedDiagrams((prev) => ({
        ...prev,
        [conceptTitle]: diagram,
      }));
      setActiveOutputTab('diagrams');
    } catch {
      // Handled silently
    } finally {
      setIsGeneratingDiagram(false);
      setActiveDiagramKey('');
    }
  };

  // "Ask Your Document" Grounded Chat Handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userQ = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: userQ }]);
    setIsChatLoading(true);

    try {
      const contextText = fileExtractedText || inputText || studyResult?.summary.executiveSummary || '';
      const res = await askDocumentAssistant(userQ, contextText, studyResult?.topic || 'Uploaded Document');
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.reply,
          citations: res.citations,
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Unable to reach the document assistant right now. Please try asking again.',
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Examination Practice Handlers
  const handleAnswerSelect = (questionId: number, answerLetter: string) => {
    if (isQuizSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: answerLetter,
    }));
  };

  const handleToggleFlag = (questionId: number) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSubmitQuiz = () => {
    if (!studyResult?.examSuite?.multipleChoice) return;
    const mcqs = studyResult.examSuite.multipleChoice;
    let correctCount = 0;

    mcqs.forEach((mcq) => {
      const userChoice = (userAnswers[mcq.id] || '').trim().toUpperCase();
      const correctAns = mcq.correctAnswer.trim().toUpperCase();
      if (userChoice && (userChoice === correctAns || userChoice.startsWith(correctAns) || correctAns.startsWith(userChoice))) {
        correctCount++;
      }
    });

    const percentage = Math.round((correctCount / mcqs.length) * 100);
    const scoreObj = { score: correctCount, percentage, total: mcqs.length };
    setExamScore(scoreObj);
    setIsQuizSubmitted(true);

    // Record Exam completion to activities
    recordGuestActivity({
      topic: studyResult.topic,
      fileName: uploadedFile?.name || 'Interactive Exam',
      score: percentage,
      totalQuestions: mcqs.length,
      correctAnswers: correctCount,
      activityType: 'exam_completed',
    });

    // Refresh history
    fetchGuestActivities().then(setRecentActivities);
  };

  const handleRetakeQuiz = () => {
    setUserAnswers({});
    setFlaggedQuestions(new Set());
    setActiveQuestionIndex(0);
    setIsQuizSubmitted(false);
    setExamScore(null);
    setExamFilterMode('all');
  };

  // PDF Export
  const handleExportPDF = () => {
    if (!studyResult) return;
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let y = 16;

      // Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42);
      pdf.text('EaseStudy — Learning Summary & Examination Suite', 14, y);
      y += 7;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Topic: ${studyResult.topic} | Target: ${studyResult.difficulty} | Read Time: ${studyResult.readingTime}`, 14, y);
      y += 9;

      // Executive Summary
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(14, 116, 144);
      pdf.text('Executive Summary', 14, y);
      y += 5.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      const splitExec = pdf.splitTextToSize(studyResult.summary.executiveSummary, 180);
      pdf.text(splitExec, 14, y);
      y += splitExec.length * 4.5 + 5;

      // Key Takeaways
      if (y > 250) {
        pdf.addPage();
        y = 16;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(14, 116, 144);
      pdf.text('Key Takeaways', 14, y);
      y += 5.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(51, 65, 85);
      studyResult.summary.keyTakeaways.forEach((takeaway) => {
        if (y > 270) {
          pdf.addPage();
          y = 16;
        }
        const splitTakeaway = pdf.splitTextToSize(`• ${takeaway}`, 175);
        pdf.text(splitTakeaway, 16, y);
        y += splitTakeaway.length * 4 + 2;
      });

      // MCQs
      if (y > 240) {
        pdf.addPage();
        y = 16;
      }
      y += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(14, 116, 144);
      pdf.text('Practice Examination Questions', 14, y);
      y += 6;

      studyResult.examSuite.multipleChoice.forEach((mcq, idx) => {
        if (y > 250) {
          pdf.addPage();
          y = 16;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);
        const splitQ = pdf.splitTextToSize(`Q${idx + 1}: ${mcq.question}`, 180);
        pdf.text(splitQ, 14, y);
        y += splitQ.length * 4 + 2;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(71, 85, 105);
        mcq.options.forEach((opt) => {
          pdf.text(`   ${opt}`, 16, y);
          y += 3.5;
        });

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(14, 116, 144);
        pdf.text(`   Correct: ${mcq.correctAnswer}`, 16, y);
        y += 4;

        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(100, 116, 139);
        const splitExp = pdf.splitTextToSize(`   Explanation: ${mcq.explanation}`, 175);
        pdf.text(splitExp, 16, y);
        y += splitExp.length * 3.5 + 3.5;
      });

      pdf.save(`EaseStudy_${studyResult.topic.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.pdf`);
    } catch {}
  };

  const handleCopyMarkdown = () => {
    if (!studyResult) return;
    let md = `# ${studyResult.topic}\n\n`;
    md += `**Level**: ${studyResult.difficulty} | **Estimated Reading Time**: ${studyResult.readingTime}\n\n`;
    md += `## Step-by-step Narrative\n${studyResult.summary.executiveSummary}\n\n`;
    md += `### Key Takeaways\n`;
    studyResult.summary.keyTakeaways.forEach((t) => (md += `- ${t}\n`));
    md += `\n## Practice Exam Questions\n`;
    studyResult.examSuite.multipleChoice.forEach((q) => {
      md += `**Q${q.id}**: ${q.question}\n`;
      q.options.forEach((o) => (md += `- ${o}\n`));
      md += `*Correct Answer*: **${q.correctAnswer}**\n*Explanation*: ${q.explanation}\n\n`;
    });

    navigator.clipboard.writeText(md);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const allMCQs = studyResult?.examSuite?.multipleChoice || [];
  const filteredMCQs = allMCQs.filter((mcq) => {
    if (!isQuizSubmitted || examFilterMode === 'all') return true;
    const userChoice = (userAnswers[mcq.id] || '').trim().toUpperCase();
    const correctAns = mcq.correctAnswer.trim().toUpperCase();
    const isCorrect = userChoice && (userChoice === correctAns || userChoice.startsWith(correctAns) || correctAns.startsWith(userChoice));
    if (examFilterMode === 'incorrect') return !isCorrect;
    if (examFilterMode === 'flagged') return flaggedQuestions.has(mcq.id);
    return true;
  });

  const currentFlashcard = studyResult?.flashcards?.[activeFlashcardIndex];

  return (
    <div
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
      className="w-full max-w-[660px] mx-auto space-y-3.5 px-3 sm:px-3.5 py-3.5 sm:py-5 text-slate-800"
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (CENTER JUSTIFIED)                                          */}
      {/* ========================================================================= */}
      <div className="space-y-1 text-center flex flex-col items-center justify-center mx-auto w-full">
        <div className="flex items-center justify-center relative w-full">
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight text-center">
            EaseStudy
          </h1>
          {showWorkspace && (
            <button
              onClick={() => setShowWorkspace(false)}
              className="absolute right-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3 h-3" />
              <span>Hub</span>
            </button>
          )}
        </div>
        <p className="text-[10px] sm:text-[11.5px] text-slate-600 font-normal max-w-md mx-auto leading-relaxed text-center">
          Your intelligent workspace for studying, understanding documents and preparing for examinations.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN UPLOAD CONTAINER (REDUCED BY 15%, SMALL BUTTONS & ICONS)          */}
      {/* ========================================================================= */}
      {!showWorkspace && (
        <div
          ref={dropzoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative bg-white rounded-xl border-2 transition-all p-5 sm:p-6 text-center flex flex-col items-center justify-center shadow-2xs ${
            isDragging
              ? 'border-cyan-600 bg-cyan-50/50 scale-[1.005]'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Cloud Upload Icon: Small size */}
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#1d68bd] mb-2.5">
            <UploadCloud className="w-5 h-5 stroke-[1.75]" />
          </div>

          {/* Title & Subtext: Reduced by 20% */}
          <h2 className="text-[13.5px] sm:text-[14.5px] font-bold text-slate-900 mb-0.5">
            Upload your study material
          </h2>
          <p className="text-[10px] text-slate-500 max-w-sm mx-auto mb-3.5 leading-relaxed">
            Drop your PDF, DOCX, PPTX or other supported document here.
          </p>

          {/* Browse Documents Primary Button: Small size */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="px-5 py-2 rounded-lg bg-[#1d68bd] hover:bg-[#1557a5] text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Processing Document...</span>
              </>
            ) : (
              <span>Browse Documents</span>
            )}
          </button>

          {/* Or Paste Your Notes Toggle */}
          <button
            type="button"
            onClick={() => setIsPastingNotes(!isPastingNotes)}
            className="mt-3 text-[10px] font-normal text-slate-600 hover:text-cyan-800 transition-colors cursor-pointer underline underline-offset-2"
          >
            {isPastingNotes ? 'Hide notes input' : 'Or paste your notes'}
          </button>

          {/* Expandable Notes Input */}
          {isPastingNotes && (
            <div className="w-full mt-3.5 pt-3.5 border-t border-slate-100 space-y-2 text-left">
              <label className="text-[10.5px] font-bold text-slate-700 block">
                Paste lecture notes, article excerpts, or book text:
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste course notes, chapter paragraphs, or study material here..."
                rows={4}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-[10.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1d68bd] focus:border-[#1d68bd] transition-all font-mono"
              />
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] text-slate-400">
                  {inputText.length} characters
                </span>
                <button
                  type="button"
                  onClick={handleRunTextAnalysis}
                  disabled={!inputText.trim() || isAnalyzing}
                  className="px-3 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-[10px] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Analyze Notes
                </button>
              </div>
            </div>
          )}

          {/* Processing Loading Indicator */}
          {isAnalyzing && (
            <div className="mt-3.5 w-full max-w-sm p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-[10px] font-medium flex items-center justify-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
              <span>{processingStatus || 'Analyzing document structure...'}</span>
            </div>
          )}

          {/* Error Message */}
          {analysisError && (
            <div className="mt-3 w-full max-w-sm p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-medium flex items-center gap-1.5 text-left">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>{analysisError}</span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 2x2 HUB CARDS GRID (REDUCED BY 15%, COMPACT FITTING)                  */}
      {/* ========================================================================= */}
      {!showWorkspace && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          {/* Card 1: My Documents */}
          <div
            onClick={() => {
              if (studyResult) {
                setShowWorkspace(true);
                setActiveOutputTab('summary');
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 hover:border-cyan-600 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-cyan-50 group-hover:text-cyan-800 transition-colors mb-2">
                <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                My Documents
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                Manage uploaded files
              </p>
            </div>
          </div>

          {/* Card 2: AI Study Materials */}
          <div
            onClick={() => {
              if (studyResult) {
                setShowWorkspace(true);
                setActiveOutputTab('summary');
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 hover:border-cyan-600 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-cyan-50 group-hover:text-cyan-800 transition-colors mb-2">
                <BrainCircuit className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                AI Study Materials
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                Summaries and revision notes
              </p>
            </div>
          </div>

          {/* Card 3: Examination Practice */}
          <div
            onClick={() => {
              if (studyResult) {
                setShowWorkspace(true);
                setActiveOutputTab('exam');
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 hover:border-cyan-600 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-cyan-50 group-hover:text-cyan-800 transition-colors mb-2">
                <ClipboardCheck className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                Examination Practice
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                Test your understanding
              </p>
            </div>
          </div>

          {/* Card 4: Learning History */}
          <div
            onClick={() => {
              if (recentActivities.length > 0 && studyResult) {
                setShowWorkspace(true);
                setActiveOutputTab('summary');
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 hover:border-cyan-600 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-cyan-50 group-hover:text-cyan-800 transition-colors mb-2">
                <History className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                Learning History
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                Continue previous sessions
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RECENT LEARNING ACTIVITIES CONTAINER (FIT & COMPACT)                    */}
      {/* ========================================================================= */}
      {!showWorkspace && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-[13.5px] font-bold text-slate-900">
              Recent learning activities
            </h3>
            {recentActivities.length > 0 && (
              <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {recentActivities.length} session{recentActivities.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {recentActivities.length === 0 ? (
            <p className="text-[10px] sm:text-[11px] text-slate-500 leading-relaxed">
              Your uploaded documents and previous study sessions will appear here.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.slice(0, 5).map((act, idx) => (
                <div
                  key={act.id || idx}
                  className="py-2 flex items-center justify-between gap-2.5 text-[10px] hover:bg-slate-50/80 px-1.5 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-6 h-6 rounded-md bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                      {act.activityType === 'exam_completed' ? (
                        <ClipboardCheck className="w-3 h-3" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                    </div>
                    <div className="truncate">
                      <span className="font-bold text-slate-900 block truncate">
                        {act.topic || act.fileName || 'Study Session'}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {act.score !== undefined ? `Exam Score: ${act.score}%` : 'Study Guide Generated'} •{' '}
                        {new Date(act.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {studyResult && (
                    <button
                      onClick={() => {
                        setShowWorkspace(true);
                        setActiveOutputTab(act.activityType === 'exam_completed' ? 'exam' : 'summary');
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[9.5px] shrink-0 cursor-pointer"
                    >
                      Open
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Standard Benchmark Quick-Starters */}
          <div className="pt-2.5 border-t border-slate-100">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Verified Benchmark Study Starters:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleLoadBenchmark('benchmark_human_relations')}
                className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-semibold cursor-pointer transition-colors"
              >
                Human Relations &amp; Influence
              </button>
              <button
                type="button"
                onClick={() => handleLoadBenchmark('benchmark_hermeneutics')}
                className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-semibold cursor-pointer transition-colors"
              >
                Historical &amp; Theological Hermeneutics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ACTIVE STUDY WORKSPACE (DELIVERY ENHANCEMENTS)                         */}
      {/* ========================================================================= */}
      {showWorkspace && studyResult && (
        <div className="space-y-3">
          {/* Workspace Header & Action Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-sky-100 text-sky-800 tracking-wider">
                    {studyResult.difficulty}
                  </span>
                  <span className="text-[9.5px] text-slate-400 flex items-center gap-0.5 font-medium">
                    <Clock className="w-2.5 h-2.5" />
                    {studyResult.readingTime}
                  </span>
                  {uploadedFile && (
                    <span className="text-[9.5px] text-slate-500 font-mono truncate max-w-[150px]">
                      • {uploadedFile.name}
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 leading-snug">
                  {studyResult.topic}
                </h2>
              </div>

              {/* Action Buttons: Small size */}
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                  title="Re-Generate fresh questions and analysis from scratch"
                >
                  <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>Re-Generate</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer"
                  title="Download clean study guide as PDF"
                >
                  <Download className="w-3 h-3" />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer"
                  title="Copy markdown to clipboard"
                >
                  {copiedNotification ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedNotification ? 'Copied' : 'Markdown'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsChatDrawerOpen(!isChatDrawerOpen)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#1d68bd] hover:bg-[#1557a5] text-white text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Ask Document</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-t border-slate-100 pt-2.5 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveOutputTab('summary')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeOutputTab === 'summary'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Summary &amp; Notes
              </button>
              <button
                onClick={() => setActiveOutputTab('concepts')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeOutputTab === 'concepts'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Key Concepts ({studyResult.keyConcepts?.length || 0})
              </button>
              <button
                onClick={() => setActiveOutputTab('exam')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  activeOutputTab === 'exam'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ClipboardCheck className="w-3 h-3" />
                <span>Practice Exam ({studyResult.examSuite.multipleChoice.length})</span>
              </button>
              {studyResult.flashcards && studyResult.flashcards.length > 0 && (
                <button
                  onClick={() => setActiveOutputTab('flashcards')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeOutputTab === 'flashcards'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Flashcards ({studyResult.flashcards.length})
                </button>
              )}
              <button
                onClick={() => setActiveOutputTab('chat')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  activeOutputTab === 'chat'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>Ask Document</span>
              </button>
            </div>
          </div>

          {/* TAB 1: SUMMARY & REVISION NOTES */}
          {activeOutputTab === 'summary' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Executive Narrative
                </h3>
                <div className="text-[10.5px] sm:text-[11.5px] text-slate-700 leading-relaxed space-y-2 font-normal">
                  {studyResult.summary.executiveSummary.split('\n\n').map((paragraph, pIdx) => (
                    <p key={pIdx} className="leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Key Takeaways
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {studyResult.summary.keyTakeaways.map((takeaway, tIdx) => (
                    <div
                      key={tIdx}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] sm:text-[10.5px] text-slate-800 flex items-start gap-2"
                    >
                      <span className="w-4 h-4 rounded-full bg-cyan-100 text-cyan-800 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {tIdx + 1}
                      </span>
                      <span className="leading-relaxed">{takeaway}</span>
                    </div>
                  ))}
                </div>
              </div>

              {studyResult.summary.coreThemes && studyResult.summary.coreThemes.length > 0 && (
                <div>
                  <h3 className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Core Subject Taxonomy
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {studyResult.summary.coreThemes.map((theme, thIdx) => (
                      <span
                        key={thIdx}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9.5px] font-medium"
                      >
                        #{theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KEY CONCEPTS */}
          {activeOutputTab === 'concepts' && (
            <div className="space-y-2.5">
              {studyResult.keyConcepts.map((concept, cIdx) => (
                <div
                  key={cIdx}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <h3 className="text-xs sm:text-[13px] font-bold text-slate-900">
                      {concept.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleGenerateDiagram(concept.title, concept.explanation)}
                      disabled={isGeneratingDiagram}
                      className="px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-800 text-[9.5px] font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-sky-600" />
                      <span>{isGeneratingDiagram && activeDiagramKey === concept.title ? 'Generating...' : 'View Diagram'}</span>
                    </button>
                  </div>

                  <p className="text-[10px] sm:text-[11px] text-slate-600 leading-relaxed">
                    {concept.explanation}
                  </p>

                  {concept.formulaOrExample && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-mono text-slate-800 overflow-x-auto">
                      {concept.formulaOrExample}
                    </div>
                  )}

                  <div className="text-[9.5px] text-cyan-800 font-semibold bg-cyan-50/80 px-2.5 py-1 rounded-md border border-cyan-100">
                    Exam Relevance: {concept.importance}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: PRACTICE EXAMINATION SUITE */}
          {activeOutputTab === 'exam' && (
            <div className="space-y-3">
              {/* Exam Score Banner if submitted */}
              {isQuizSubmitted && examScore && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-2xs space-y-1.5">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 mb-0.5">
                    <Award className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Exam Score: {examScore.percentage}% ({examScore.score} / {examScore.total})
                  </h3>
                  <p className="text-[10px] text-slate-600 max-w-xs mx-auto">
                    {examScore.percentage >= 80
                      ? 'Exceptional mastery of core document principles!'
                      : examScore.percentage >= 60
                      ? 'Solid foundation. Review the explanations below to master missed topics.'
                      : 'Take some time to review the executive summary and retake the exam.'}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 pt-1.5">
                    <button
                      onClick={handleRetakeQuiz}
                      className="px-3 py-1 rounded-lg bg-[#1d68bd] text-white text-[10px] font-bold cursor-pointer hover:bg-[#1557a5]"
                    >
                      Retake Exam
                    </button>
                    <button
                      onClick={() => setExamFilterMode(examFilterMode === 'incorrect' ? 'all' : 'incorrect')}
                      className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold cursor-pointer hover:bg-slate-200"
                    >
                      {examFilterMode === 'incorrect' ? 'Show All Questions' : 'Review Missed Questions'}
                    </button>
                  </div>
                </div>
              )}

              {/* MCQ Cards */}
              <div className="space-y-2.5">
                {filteredMCQs.map((mcq, mIdx) => {
                  const userChoice = userAnswers[mcq.id] || '';
                  const isCorrect = userChoice.toUpperCase().startsWith(mcq.correctAnswer.toUpperCase());
                  const isFlagged = flaggedQuestions.has(mcq.id);

                  return (
                    <div
                      key={mcq.id || mIdx}
                      className={`bg-white rounded-xl border p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all ${
                        isQuizSubmitted
                          ? isCorrect
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : userChoice
                            ? 'border-rose-200 bg-rose-50/20'
                            : 'border-slate-200'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <span className="text-[9.5px] font-bold text-slate-400">
                          Question {mIdx + 1} of {filteredMCQs.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleFlag(mcq.id)}
                          className={`text-[9.5px] font-medium cursor-pointer ${
                            isFlagged ? 'text-amber-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {isFlagged ? '★ Flagged' : '☆ Flag for review'}
                        </button>
                      </div>

                      <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                        {mcq.question}
                      </h4>

                      {/* Options */}
                      <div className="space-y-1.5">
                        {mcq.options.map((opt, oIdx) => {
                          const letter = String.fromCharCode(65 + oIdx);
                          const isSelected = userChoice.toUpperCase().startsWith(letter);
                          const isOptionCorrect = mcq.correctAnswer.toUpperCase().startsWith(letter);

                          let optStyles = 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-800';
                          if (isSelected) {
                            optStyles = 'border-[#1d68bd] bg-sky-50 text-sky-950 font-semibold ring-1 ring-[#1d68bd]';
                          }
                          if (isQuizSubmitted) {
                            if (isOptionCorrect) {
                              optStyles = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold';
                            } else if (isSelected) {
                              optStyles = 'border-rose-500 bg-rose-50 text-rose-950 line-through';
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => handleAnswerSelect(mcq.id, letter)}
                              disabled={isQuizSubmitted}
                              className={`w-full text-left p-2 rounded-lg border text-[10px] sm:text-[10.5px] transition-all cursor-pointer flex items-start gap-2 ${optStyles}`}
                            >
                              <span className="w-4 h-4 rounded bg-white border border-slate-200 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                                {letter}
                              </span>
                              <span className="leading-relaxed">{opt.replace(/^[A-D][).:\s-]+/i, '')}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation after submission */}
                      {isQuizSubmitted && (
                        <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[9.5px] text-slate-700 space-y-1">
                          <span className="font-bold text-slate-900 block">
                            Correct Answer: Option {mcq.correctAnswer}
                          </span>
                          <p className="leading-relaxed">{mcq.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Quiz CTA */}
              {!isQuizSubmitted && filteredMCQs.length > 0 && (
                <div className="sticky bottom-3 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-300 shadow-md flex items-center justify-between gap-3">
                  <span className="text-[10px] text-slate-600 font-medium">
                    Answered {Object.keys(userAnswers).length} of {allMCQs.length} questions
                  </span>
                  <button
                    type="button"
                    onClick={handleSubmitQuiz}
                    disabled={Object.keys(userAnswers).length === 0}
                    className="px-4 py-1.5 rounded-lg bg-[#1d68bd] hover:bg-[#1557a5] text-white font-bold text-[10px] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    Submit Exam &amp; Score
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FLASHCARDS */}
          {activeOutputTab === 'flashcards' && currentFlashcard && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 text-center shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                <span>
                  Card {activeFlashcardIndex + 1} of {studyResult.flashcards?.length}
                </span>
                <span>
                  {masteredFlashcards.has(activeFlashcardIndex) ? '✓ Mastered' : 'Needs Review'}
                </span>
              </div>

              {/* Flip Card Container */}
              <div
                onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                className="min-h-[160px] sm:min-h-[190px] p-5 rounded-xl border-2 border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex flex-col items-center justify-center cursor-pointer transition-all shadow-2xs"
              >
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  {isFlashcardFlipped ? 'Answer / Explanation' : 'Question / Concept'}
                </span>
                <p className="text-xs sm:text-[13.5px] font-bold text-slate-900 max-w-sm mx-auto leading-relaxed">
                  {isFlashcardFlipped ? currentFlashcard.back : currentFlashcard.front}
                </p>
                <span className="text-[9.5px] text-slate-400 mt-3">
                  (Click to flip)
                </span>
              </div>

              {/* Navigation & Mastery Controls */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFlashcardFlipped(false);
                    setActiveFlashcardIndex((prev) => Math.max(0, prev - 1));
                  }}
                  disabled={activeFlashcardIndex === 0}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMasteredFlashcards((prev) => {
                      const next = new Set(prev);
                      if (next.has(activeFlashcardIndex)) next.delete(activeFlashcardIndex);
                      else next.add(activeFlashcardIndex);
                      return next;
                    });
                  }}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                    masteredFlashcards.has(activeFlashcardIndex)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {masteredFlashcards.has(activeFlashcardIndex) ? '✓ Mastered' : 'Mark Mastered'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsFlashcardFlipped(false);
                    setActiveFlashcardIndex((prev) =>
                      Math.min((studyResult.flashcards?.length || 1) - 1, prev + 1)
                    );
                  }}
                  disabled={activeFlashcardIndex === (studyResult.flashcards?.length || 1) - 1}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: CONCEPT DIAGRAMS */}
          {activeOutputTab === 'diagrams' && (
            <div className="space-y-3">
              {Object.keys(generatedDiagrams).length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-2">
                  <Sparkles className="w-6 h-6 text-sky-600 mx-auto" />
                  <h3 className="text-xs sm:text-[13px] font-bold text-slate-900">
                    No Concept Diagrams Generated Yet
                  </h3>
                  <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                    Head to Key Concepts and click "View Diagram" to render a custom vector schematic.
                  </p>
                  <button
                    onClick={() => setActiveOutputTab('concepts')}
                    className="px-3 py-1 rounded-lg bg-[#1d68bd] text-white text-[10px] font-bold cursor-pointer"
                  >
                    Go to Key Concepts
                  </button>
                </div>
              ) : (
                Object.entries(generatedDiagrams).map(([key, diagram]) => (
                  <div
                    key={key}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs sm:text-[13px] font-bold text-slate-900">
                        {diagram.title}
                      </h4>
                      <span className="text-[9.5px] text-slate-400">Vector SVG Diagram</span>
                    </div>
                    <div
                      className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900"
                      dangerouslySetInnerHTML={{ __html: diagram.svg }}
                    />
                    <p className="text-[10px] text-slate-600">{diagram.description}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 6: "ASK YOUR DOCUMENT" GROUNDED CHAT */}
          {activeOutputTab === 'chat' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div>
                <h3 className="text-xs sm:text-[13px] font-bold text-slate-900">
                  Ask Your Document
                </h3>
                <p className="text-[10px] text-slate-500">
                  Interactive grounded conversational assistant. Every answer is strictly grounded in your uploaded text.
                </p>
              </div>

              {/* Message List */}
              <div className="min-h-[200px] max-h-[350px] overflow-y-auto space-y-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-6 text-[10px] text-slate-400 space-y-1">
                    <MessageSquare className="w-6 h-6 text-slate-300 mx-auto" />
                    <p className="font-medium">No messages yet.</p>
                    <p>Ask anything about definitions, claims, or takeaways from the text.</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl p-2.5 text-[10px] sm:text-[10.5px] leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-[#1d68bd] text-white rounded-br-xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs shadow-2xs'
                        }`}
                      >
                        {msg.text}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[9px] text-slate-500 font-mono">
                            <span className="font-bold text-slate-700 block mb-0.5">Citation:</span>
                            "{msg.citations[0]}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 py-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin text-[#1d68bd]" />
                    <span>Analyzing document citations...</span>
                  </div>
                )}
                <div ref={chatMessagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question about this document..."
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10.5px] focus:outline-none focus:ring-1 focus:ring-[#1d68bd] focus:border-[#1d68bd]"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="px-3 py-1.5 rounded-lg bg-[#1d68bd] hover:bg-[#1557a5] text-white text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Floating / Drawer Chat for quick access while reading any tab */}
      {isChatDrawerOpen && showWorkspace && activeOutputTab !== 'chat' && (
        <div className="fixed bottom-4 right-4 w-80 max-w-[calc(100vw-32px)] bg-white rounded-xl border border-slate-300 shadow-xl z-50 overflow-hidden flex flex-col">
          <div className="p-2.5 bg-slate-900 text-white flex items-center justify-between">
            <span className="text-[10.5px] font-bold flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-sky-400" />
              Ask Your Document
            </span>
            <button
              onClick={() => setIsChatDrawerOpen(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-2.5 max-h-60 overflow-y-auto space-y-1.5 text-[10px] bg-slate-50">
            {chatMessages.length === 0 ? (
              <p className="text-slate-400 text-center py-4">
                Type any query to ground answers in this document.
              </p>
            ) : (
              chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg ${
                    m.role === 'user' ? 'bg-[#1d68bd] text-white ml-5' : 'bg-white text-slate-800 mr-5 border border-slate-200'
                  }`}
                >
                  {m.text}
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="text-[9.5px] text-slate-500 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#1d68bd]" />
                <span>Finding answers...</span>
              </div>
            )}
          </div>
          <form onSubmit={handleSendMessage} className="p-1.5 border-t border-slate-100 flex gap-1 bg-white">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 px-2.5 py-1 text-[10px] rounded-md border border-slate-200 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLoading}
              className="px-2.5 py-1 rounded-md bg-[#1d68bd] text-white text-[10px] font-bold cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
