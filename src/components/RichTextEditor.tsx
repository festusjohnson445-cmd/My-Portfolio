import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Code,
  Indent,
  Outdent,
  Eraser,
  Palette,
  Highlighter,
  Type,
} from 'lucide-react';
import { markdownToBasicHtml, isRichHtmlContent } from '../utils/htmlSanitizer';

interface RichTextEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
}

const TEXT_COLOR_PRESETS = [
  '#0f172a',
  '#164e63',
  '#1d4ed8',
  '#047857',
  '#b45309',
  '#be123c',
  '#6d28d9',
  '#475569',
];

const HIGHLIGHT_PRESETS = [
  'transparent',
  '#fef08a',
  '#bae6fd',
  '#bbf7d0',
  '#fecdd3',
  '#e9d5ff',
  '#f1f5f9',
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your article here...',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [lineHeight, setLineHeight] = useState('1.65');
  const [letterSpacing, setLetterSpacing] = useState('normal');
  const [blockMargin, setBlockMargin] = useState('normal');
  const [textColor, setTextColor] = useState('#0f172a');
  const [highlightColor, setHighlightColor] = useState('#fef08a');
  const [showColorMenu, setShowColorMenu] = useState<'text' | 'highlight' | null>(null);

  // Hydrate initial or externally replaced value without breaking cursor while typing
  useEffect(() => {
    const el = editorRef.current;
    if (!el || sourceMode) return;
    const normalizedHtml = value
      ? isRichHtmlContent(value)
        ? value
        : markdownToBasicHtml(value)
      : '';
    if (document.activeElement !== el && el.innerHTML !== normalizedHtml) {
      el.innerHTML = normalizedHtml;
    }
  }, [value, sourceMode]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      } catch {}
    }
  };

  const emitChange = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  };

  const runExec = (command: string, val?: string) => {
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {}
    document.execCommand(command, false, val);
    saveSelection();
    emitChange();
  };

  const applyBlockCss = (styles: Record<string, string>) => {
    restoreSelection();
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    const targets = new Set<HTMLElement>();

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const blockTags = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'PRE']);
      const findNearestBlock = (node: Node | null): HTMLElement | null => {
        let cur: Node | null = node;
        while (cur && cur !== el) {
          if (cur.nodeType === Node.ELEMENT_NODE && blockTags.has((cur as HTMLElement).tagName)) {
            return cur as HTMLElement;
          }
          cur = cur.parentNode;
        }
        return null;
      };

      const startBlock = findNearestBlock(range.startContainer);
      const endBlock = findNearestBlock(range.endContainer);
      if (startBlock) targets.add(startBlock);
      if (endBlock) targets.add(endBlock);

      if (targets.size === 0) {
        // Wrap selection or fallback to all child blocks
        Array.from(el.children).forEach((child) => {
          if (range.intersectsNode(child)) {
            targets.add(child as HTMLElement);
          }
        });
      }
    }

    if (targets.size === 0) {
      if (el.children.length > 0) {
        Array.from(el.children).forEach((child) => targets.add(child as HTMLElement));
      } else {
        Object.entries(styles).forEach(([k, v]) => {
          (el.style as any)[k] = v;
        });
      }
    }

    targets.forEach((blk) => {
      Object.entries(styles).forEach(([k, v]) => {
        (blk.style as any)[k] = v;
      });
    });

    emitChange();
  };

  const handleHeadingChange = (tag: string) => {
    if (tag === 'pre') {
      runExec('formatBlock', 'PRE');
    } else if (tag === 'blockquote') {
      runExec('formatBlock', 'BLOCKQUOTE');
    } else {
      runExec('formatBlock', tag.toUpperCase());
    }
  };

  const handleLineHeightChange = (val: string) => {
    setLineHeight(val);
    applyBlockCss({ lineHeight: val });
  };

  const handleLetterSpacingChange = (val: string) => {
    setLetterSpacing(val);
    const map: Record<string, string> = {
      tight: '-0.02em',
      normal: '0em',
      wide: '0.04em',
      wider: '0.09em',
    };
    applyBlockCss({ letterSpacing: map[val] || '0em' });
  };

  const handleMarginPresetChange = (val: string) => {
    setBlockMargin(val);
    const map: Record<string, { marginTop: string; marginBottom: string; marginLeft: string; marginRight: string }> = {
      compact: { marginTop: '4px', marginBottom: '4px', marginLeft: '0px', marginRight: '0px' },
      normal: { marginTop: '8px', marginBottom: '10px', marginLeft: '0px', marginRight: '0px' },
      relaxed: { marginTop: '14px', marginBottom: '16px', marginLeft: '0px', marginRight: '0px' },
      inset: { marginTop: '10px', marginBottom: '12px', marginLeft: '20px', marginRight: '20px' },
    };
    applyBlockCss(map[val] || map.normal);
  };

  return (
    <div className="w-full max-w-full rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs">
      {/* Rich Formatting Toolbar */}
      <div className="p-2 bg-[#edf2f8] border-b border-slate-300 flex flex-wrap items-center gap-1.5 text-xs">
        {/* Heading / Block Format */}
        <select
          aria-label="Text block format"
          defaultValue="p"
          onChange={(e) => handleHeadingChange(e.target.value)}
          className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-800 cursor-pointer"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
          <option value="pre">Code Block</option>
        </select>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Inline Emphasis */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('bold');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Bold"
          aria-label="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('italic');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Italic"
          aria-label="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('underline');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Underline"
          aria-label="Underline"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('strikeThrough');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Text Color Picker */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              setShowColorMenu((prev) => (prev === 'text' ? null : 'text'));
            }}
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
            title="Text Color"
            aria-label="Text Color"
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="w-2.5 h-2.5 rounded-full border border-slate-400" style={{ backgroundColor: textColor }} />
          </button>
          {showColorMenu === 'text' && (
            <div className="absolute left-0 top-full mt-1 z-30 p-2 rounded-lg bg-white border border-slate-300 shadow-lg flex items-center gap-1.5">
              {TEXT_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTextColor(c);
                    runExec('foreColor', c);
                    setShowColorMenu(null);
                  }}
                  className="w-4 h-4 rounded-full border border-slate-300 cursor-pointer"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={textColor}
                onChange={(e) => {
                  setTextColor(e.target.value);
                  runExec('foreColor', e.target.value);
                }}
                className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
                title="Custom text color"
              />
            </div>
          )}
        </div>

        {/* Highlight Color Picker */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              setShowColorMenu((prev) => (prev === 'highlight' ? null : 'highlight'));
            }}
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
            title="Highlight Color"
            aria-label="Highlight Color"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span
              className="w-2.5 h-2.5 rounded-sm border border-slate-400"
              style={{ backgroundColor: highlightColor }}
            />
          </button>
          {showColorMenu === 'highlight' && (
            <div className="absolute left-0 top-full mt-1 z-30 p-2 rounded-lg bg-white border border-slate-300 shadow-lg flex items-center gap-1.5">
              {HIGHLIGHT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setHighlightColor(c);
                    runExec('hiliteColor', c);
                    setShowColorMenu(null);
                  }}
                  className="w-4 h-4 rounded border border-slate-300 cursor-pointer"
                  style={{ backgroundColor: c === 'transparent' ? '#ffffff' : c }}
                  title={c === 'transparent' ? 'No highlight' : c}
                />
              ))}
              <input
                type="color"
                value={highlightColor === 'transparent' ? '#ffffff' : highlightColor}
                onChange={(e) => {
                  setHighlightColor(e.target.value);
                  runExec('hiliteColor', e.target.value);
                }}
                className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
                title="Custom highlight"
              />
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Text Alignment & Justification */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('justifyLeft');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Align Left"
          aria-label="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('justifyCenter');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Align Center"
          aria-label="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('justifyRight');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Align Right"
          aria-label="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('justifyFull');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Justify"
          aria-label="Justify"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Lists & Indentation / Margins */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('insertUnorderedList');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Bullet List"
          aria-label="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('insertOrderedList');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Numbered List"
          aria-label="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('indent');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Increase Margin / Indent"
          aria-label="Increase Margin / Indent"
        >
          <Indent className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('outdent');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Decrease Margin / Outdent"
          aria-label="Decrease Margin / Outdent"
        >
          <Outdent className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('formatBlock', 'BLOCKQUOTE');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
          title="Block Quote"
          aria-label="Block Quote"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Text Spacing & Margins Controls */}
        <label className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-700">
          <Type className="w-3 h-3 text-cyan-800" />
          <select
            aria-label="Line spacing"
            value={lineHeight}
            onChange={(e) => handleLineHeightChange(e.target.value)}
            className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10.5px] cursor-pointer"
            title="Line Spacing"
          >
            <option value="1.25">Line: 1.25</option>
            <option value="1.5">Line: 1.5</option>
            <option value="1.65">Line: Normal</option>
            <option value="1.85">Line: 1.85</option>
            <option value="2.1">Line: 2.1</option>
          </select>
        </label>

        <select
          aria-label="Letter spacing"
          value={letterSpacing}
          onChange={(e) => handleLetterSpacingChange(e.target.value)}
          className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10.5px] font-semibold text-slate-700 cursor-pointer"
          title="Letter Spacing"
        >
          <option value="tight">Spacing: Tight</option>
          <option value="normal">Spacing: Normal</option>
          <option value="wide">Spacing: Wide</option>
          <option value="wider">Spacing: Wider</option>
        </select>

        <select
          aria-label="Paragraph margins"
          value={blockMargin}
          onChange={(e) => handleMarginPresetChange(e.target.value)}
          className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10.5px] font-semibold text-slate-700 cursor-pointer"
          title="Paragraph Margins"
        >
          <option value="compact">Margin: Compact</option>
          <option value="normal">Margin: Normal</option>
          <option value="relaxed">Margin: Relaxed</option>
          <option value="inset">Margin: Indented</option>
        </select>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('removeFormat');
          }}
          className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-700 cursor-pointer"
          title="Clear Formatting"
          aria-label="Clear Formatting"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setSourceMode((prev) => !prev)}
          className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded border text-[10.5px] font-semibold cursor-pointer ${
            sourceMode
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
          title="Toggle HTML / Source View"
        >
          <Code className="w-3 h-3" />
          <span>{sourceMode ? 'Visual' : 'Source'}</span>
        </button>
      </div>

      {/* Editor Surface */}
      {sourceMode ? (
        <textarea
          rows={10}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[240px] p-3 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none leading-relaxed"
        />
      ) : (
        <div className="relative">
          {!value && (
            <div className="absolute top-3 left-3 text-xs text-slate-400 pointer-events-none select-none">
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              saveSelection();
              emitChange();
            }}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onBlur={emitChange}
            className="w-full min-h-[240px] max-h-[480px] overflow-y-auto p-3.5 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none leading-relaxed font-serif [&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1.5 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:my-1.5 [&_blockquote]:border-l-3 [&_blockquote]:border-cyan-700 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-700 [&_blockquote]:my-2 [&_pre]:bg-slate-100 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-[11px] [&_pre]:my-2 [&_p]:my-1.5"
          />
        </div>
      )}
    </div>
  );
};
