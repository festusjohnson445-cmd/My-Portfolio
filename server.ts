import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import mammoth from 'mammoth';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Google Gen AI with server-side API Key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Set 50MB payload limit to handle PDF books, technical drawings, and 3D CAD models
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'public_documents.json');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
const SESSIONS_FILE = path.join(DATA_DIR, 'learning_sessions.json');

// Clean error message helper to parse stringified JSON error objects from Gemini SDK
function cleanErrorMessage(err: any): string {
  let msg = err?.message || 'An error occurred';
  if (typeof msg === 'string' && msg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    } catch {}
  }
  return msg;
}

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

function loadDocuments(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading documents:', err);
  }
  return [];
}

function saveDocuments(docs: any[]): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(docs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving documents:', err);
  }
}

function loadLearningSessions(): any[] {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const content = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading learning sessions:', err);
  }
  return [];
}

function saveLearningSessions(sessions: any[]): void {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving learning sessions:', err);
  }
}

// 1. Get all documents (visitors get approved documents, owners get all)
app.get('/api/documents', (req, res) => {
  const docs = loadDocuments();
  const includePending = req.query.all === 'true';
  if (includePending) {
    return res.json({ success: true, documents: docs });
  }
  const approvedDocs = docs.filter((d) => d.status === 'approved' || !d.status);
  res.json({ success: true, documents: approvedDocs });
});

// 2. Publish or submit a document
app.post('/api/documents', (req, res) => {
  try {
    const newDoc = req.body;
    if (!newDoc || !newDoc.title) {
      return res.status(400).json({ success: false, message: 'Invalid document data' });
    }
    const docs = loadDocuments();
    // Insert new document at the beginning
    const updated = [newDoc, ...docs.filter((d) => d.id !== newDoc.id)];
    saveDocuments(updated);
    res.json({ success: true, document: newDoc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to save document' });
  }
});

// 3. Approve a pending visitor document
app.patch('/api/documents/:id/approve', (req, res) => {
  const { id } = req.params;
  const docs = loadDocuments();
  const updated = docs.map((d) => (d.id === id ? { ...d, status: 'approved' } : d));
  saveDocuments(updated);
  res.json({ success: true, documents: updated });
});

// 4. Delete an uploaded document
app.delete('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  const docs = loadDocuments();
  const updated = docs.filter((d) => d.id !== id);
  saveDocuments(updated);
  res.json({ success: true, documents: updated });
});

// 5. Increment download count
app.post('/api/documents/:id/download', (req, res) => {
  const { id } = req.params;
  const docs = loadDocuments();
  const updated = docs.map((d) => (d.id === id ? { ...d, downloadCount: (d.downloadCount || 0) + 1 } : d));
  saveDocuments(updated);
  res.json({ success: true });
});

// 6. Learning: Get all teaching / training sessions
app.get('/api/learning/sessions', (req, res) => {
  const sessions = loadLearningSessions();
  res.json({ success: true, sessions });
});

// 7. Learning: Save & upload a teaching session (with optional video base64)
app.post('/api/learning/sessions', (req, res) => {
  try {
    const { sessionData, videoBase64, mimeType = 'video/webm' } = req.body;
    if (!sessionData || !sessionData.title) {
      return res.status(400).json({ success: false, message: 'Session title and metadata are required.' });
    }

    const sessionId = sessionData.id || `session-${Date.now()}`;
    let videoUrl = sessionData.videoUrl || '';
    let hasRecordedVideo = Boolean(sessionData.hasRecordedVideo);

    if (videoBase64) {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const videoFileName = `${sessionId}.${ext}`;
      const videoFilePath = path.join(RECORDINGS_DIR, videoFileName);
      
      const buffer = Buffer.from(videoBase64, 'base64');
      fs.writeFileSync(videoFilePath, buffer);
      
      videoUrl = `/api/learning/videos/${sessionId}`;
      hasRecordedVideo = true;
    }

    const newSession = {
      ...sessionData,
      id: sessionId,
      videoUrl,
      hasRecordedVideo,
      createdAt: new Date().toISOString(),
    };

    const existingSessions = loadLearningSessions();
    const updated = [newSession, ...existingSessions.filter((s: any) => s.id !== sessionId)];
    saveLearningSessions(updated);

    res.json({ success: true, session: newSession });
  } catch (err: any) {
    console.error('Error saving learning session:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to save training session.' });
  }
});

// 8. Learning: Stream / serve recorded video with HTTP 206 Partial Content
app.get('/api/learning/videos/:id', (req, res) => {
  const { id } = req.params;
  const webmPath = path.join(RECORDINGS_DIR, `${id}.webm`);
  const mp4Path = path.join(RECORDINGS_DIR, `${id}.mp4`);
  
  let videoPath = '';
  let contentType = 'video/webm';

  if (fs.existsSync(webmPath)) {
    videoPath = webmPath;
    contentType = 'video/webm';
  } else if (fs.existsSync(mp4Path)) {
    videoPath = mp4Path;
    contentType = 'video/mp4';
  } else {
    return res.status(404).send('Video recording not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// 9. Learning: Delete a recorded session
app.delete('/api/learning/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existingSessions = loadLearningSessions();
    const updated = existingSessions.filter((s: any) => s.id !== id);
    saveLearningSessions(updated);

    const webmPath = path.join(RECORDINGS_DIR, `${id}.webm`);
    const mp4Path = path.join(RECORDINGS_DIR, `${id}.mp4`);
    if (fs.existsSync(webmPath)) {
      try { fs.unlinkSync(webmPath); } catch {}
    }
    if (fs.existsSync(mp4Path)) {
      try { fs.unlinkSync(mp4Path); } catch {}
    }

    res.json({ success: true, sessions: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete session' });
  }
});

// 10. Learning: Generate Animated Video from Prompts/Descriptions
app.post('/api/learning/generate-animation', async (req, res) => {
  try {
    const { prompt, category = 'Mechanical Engineering', instructor = 'Festus, Olorunsogo Johnson' } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide prompt descriptions for the animated video.' });
    }

    const systemPrompt = `You are an expert AI animated educational video producer and engineering instructor.
Generate a structured storyboard and script for an animated learning video based on the user's prompt/descriptions.
The output must be a valid JSON object matching the requested schema with:
1. title: Catchy, professional title.
2. description: Summary of the animated learning video.
3. category: Engineering category (e.g. Mechanical Engineering, CAD & 3D Modeling, GD&T & Tolerance, FEA Simulation, Manufacturing & CNC).
4. duration: Estimated duration string e.g. "03:30".
5. durationSeconds: Total seconds integer e.g. 210.
6. scenes: Array of 4 to 6 scenes. Each scene must contain:
   - sceneNumber: integer
   - title: scene title
   - durationSeconds: integer
   - narration: exact voiceover / narration script for this scene
   - visualType: one of ['blueprint', '3d-cad', 'formula', 'diagram', 'simulation']
   - visualElements: array of 3 to 4 key visual text bullets or formula highlights to display in the animated canvas
   - keyTakeaway: single sentence core takeaway
7. keyTakeaways: array of 3 major takeaways for the video.
8. tags: array of 4 relevant keyword tags.`;

    const schemaConfig = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        duration: { type: Type.STRING },
        durationSeconds: { type: Type.INTEGER },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sceneNumber: { type: Type.INTEGER },
              title: { type: Type.STRING },
              durationSeconds: { type: Type.INTEGER },
              narration: { type: Type.STRING },
              visualType: { type: Type.STRING },
              visualElements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              keyTakeaway: { type: Type.STRING },
            },
            required: ['sceneNumber', 'title', 'durationSeconds', 'narration', 'visualType', 'visualElements', 'keyTakeaway'],
          },
        },
        keyTakeaways: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['title', 'description', 'category', 'duration', 'durationSeconds', 'scenes', 'keyTakeaways', 'tags'],
    };

    const candidateModels = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'];
    let lastError: any = null;
    let responseText = '';

    for (const modelName of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: `User Prompt / Description: ${prompt}`,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              responseSchema: schemaConfig,
            },
          });

          if (response && response.text) {
            responseText = response.text;
            break;
          }
        } catch (callErr: any) {
          lastError = callErr;
          console.warn(`[Learning Generator] Model ${modelName} attempt ${attempt} failed:`, cleanErrorMessage(callErr));
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
      if (responseText) break;
    }

    if (!responseText) {
      const cleanMsg = cleanErrorMessage(lastError);
      return res.status(503).json({
        success: false,
        message: cleanMsg || 'This AI model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again in a few moments.',
      });
    }

    const animatedData = JSON.parse(responseText);
    res.json({ success: true, animation: animatedData });
  } catch (err: any) {
    console.error('Animated video generation error:', err);
    res.status(500).json({ success: false, message: cleanErrorMessage(err) });
  }
});

// 10. EaseStudy Multi-Modal Analysis & Exam Generator
app.post('/api/easestudy/analyze', async (req, res) => {
  try {
    const { text, fileData, difficulty = 'intermediate', questionCount = 8, focusArea } = req.body;

    if (!text && (!fileData || !fileData.base64)) {
      return res.status(400).json({ success: false, message: 'Please provide study text or an uploaded file/image.' });
    }

    const parts: any[] = [];
    let extractedDocxText = '';

    if (fileData && fileData.base64) {
      const fileName = (fileData.fileName || '').toLowerCase();
      const mimeType = (fileData.mimeType || '').toLowerCase();

      if (fileName.endsWith('.docx') || fileName.endsWith('.doc') || mimeType.includes('wordprocessingml') || mimeType.includes('officedocument')) {
        try {
          const fileBuffer = Buffer.from(fileData.base64, 'base64');
          const mammothResult = await mammoth.extractRawText({ buffer: fileBuffer });
          if (mammothResult && mammothResult.value) {
            extractedDocxText = mammothResult.value;
          }
        } catch (docxErr) {
          console.warn('Docx extraction fallback:', docxErr);
        }
      } else if (fileName.endsWith('.txt') || mimeType.startsWith('text/')) {
        try {
          extractedDocxText = Buffer.from(fileData.base64, 'base64').toString('utf-8');
        } catch (txtErr) {
          console.warn('Text decoding fallback:', txtErr);
        }
      } else {
        // PDF or Images (PNG, JPG, WEBP)
        let resolvedMime = mimeType;
        if (!resolvedMime || resolvedMime === 'application/octet-stream') {
          if (fileName.endsWith('.pdf')) resolvedMime = 'application/pdf';
          else if (fileName.endsWith('.png')) resolvedMime = 'image/png';
          else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) resolvedMime = 'image/jpeg';
          else if (fileName.endsWith('.webp')) resolvedMime = 'image/webp';
          else resolvedMime = 'application/pdf';
        }

        parts.push({
          inlineData: {
            mimeType: resolvedMime,
            data: fileData.base64,
          },
        });
      }
    }

    const combinedTextContent = [
      text ? `User Provided Text/Notes:\n${text}` : '',
      extractedDocxText ? `Uploaded Document Content (${fileData?.fileName || 'Document'}):\n${extractedDocxText}` : '',
    ].filter(Boolean).join('\n\n');

    const promptText = `You are EaseStudy AI, an elite academic educator, syllabus specialist, and pedagogical examiner.
Thoroughly analyze the provided study material, document, or image and generate a complete structured study package:
1. Topic title and estimated reading time.
2. A high-yield Executive Summary (clear narrative paragraph, 3 to 6 key takeaways, and core themes).
3. Detailed Core Concepts breakdown with clear explanations, formulas / practical examples, and importance rating.
4. An Exam Question Suite with exactly ${questionCount || 8} Multiple Choice Questions (each with 4 distinct options, clearly marked correct answer (e.g. "A", "B", "C", or "D"), and detailed explanation) AND 3 to 4 Short Answer / Conceptual Questions with ideal model answers and key grading points.
5. 4 to 8 Interactive Flashcards (front: term/question, back: concise definition).

Target Difficulty: ${difficulty}
${focusArea ? `Special Focus Directive: ${focusArea}` : ''}
${combinedTextContent ? `\n\nStudy Material Text:\n${combinedTextContent}` : ''}`;

    parts.push({ text: promptText });

    const schemaConfig = {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING, description: 'Clear topic or title of the material' },
        difficulty: { type: Type.STRING, description: 'Target difficulty level' },
        readingTime: { type: Type.STRING, description: 'Estimated reading time e.g. 7 min read' },
        summary: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING, description: 'Comprehensive executive summary paragraph' },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of 3 to 6 essential takeaways',
            },
            coreThemes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of main theme tags',
            },
          },
          required: ['executiveSummary', 'keyTakeaways', 'coreThemes'],
        },
        keyConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              explanation: { type: Type.STRING },
              formulaOrExample: { type: Type.STRING },
              importance: { type: Type.STRING },
            },
            required: ['title', 'explanation', 'importance'],
          },
        },
        examSuite: {
          type: Type.OBJECT,
          properties: {
            multipleChoice: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['id', 'question', 'options', 'correctAnswer', 'explanation'],
              },
            },
            shortAnswer: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  idealAnswer: { type: Type.STRING },
                  keyPointsRequired: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['id', 'question', 'idealAnswer'],
              },
            },
          },
          required: ['multipleChoice', 'shortAnswer'],
        },
        flashcards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING },
            },
            required: ['front', 'back'],
          },
        },
      },
      required: ['topic', 'difficulty', 'readingTime', 'summary', 'keyConcepts', 'examSuite'],
    };

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let lastError: any = null;
    let outputText = '';

    for (const modelName of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts },
            config: {
              responseMimeType: 'application/json',
              responseSchema: schemaConfig,
            },
          });

          if (response && response.text) {
            outputText = response.text;
            break;
          }
        } catch (callErr: any) {
          lastError = callErr;
          console.warn(`Model ${modelName} attempt ${attempt} failed:`, callErr?.message || callErr);
          // Wait 600ms before retrying
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
      if (outputText) break;
    }

    if (!outputText) {
      const errMsg = lastError?.message || 'The AI study service is currently experiencing high demand. Please try again.';
      return res.status(503).json({ success: false, message: errMsg });
    }

    const parsed = JSON.parse(outputText);
    res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error('EaseStudy analyze error:', err);
    let errorMsg = err?.message || 'Failed to analyze study material.';
    try {
      if (typeof errorMsg === 'string' && errorMsg.startsWith('{')) {
        const parsedErr = JSON.parse(errorMsg);
        if (parsedErr?.error?.message) {
          errorMsg = parsedErr.error.message;
        }
      }
    } catch {}
    res.status(500).json({ success: false, message: errorMsg });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
