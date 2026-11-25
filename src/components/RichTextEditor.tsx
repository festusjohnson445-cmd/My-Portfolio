import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  ListChecks,
  Quote,
  Code,
  Indent,
  Outdent,
  Eraser,
  Palette,
  Highlighter,
  Type,
  ChevronDown,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Link2,
  Minus,
} from 'lucide-react';
import { markdownToBasicHtml, isRichHtmlContent } from '../utils/htmlSanitizer';

interface RichTextEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
}

export interface EditorFontOption {
  id: string;
  label: string;
  category: 'Serif' | 'Sans-Serif' | 'Monospace';
  stack: string;
}

export const EDITOR_FONT_FAMILIES: EditorFontOption[] = [
  { id: 'times-new-roman', label: 'Times New Roman', category: 'Serif', stack: "'Times New Roman', Tinos, Times, serif" },
  { id: 'georgia', label: 'Georgia', category: 'Serif', stack: 'Georgia, Cambria, serif' },
  { id: 'garamond', label: 'Garamond', category: 'Serif', stack: "'EB Garamond', Garamond, serif" },
  { id: 'palatino', label: 'Palatino', category: 'Serif', stack: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
  { id: 'cambria', label: 'Cambria', category: 'Serif', stack: "Cambria, 'Source Serif 4', Georgia, serif" },
  { id: 'lora', label: 'Lora', category: 'Serif', stack: "'Lora', Georgia, serif" },
  { id: 'merriweather', label: 'Merriweather', category: 'Serif', stack: "'Merriweather', Georgia, serif" },
  { id: 'playfair', label: 'Playfair Display', category: 'Serif', stack: "'Playfair Display', Georgia, serif" },
  { id: 'source-serif', label: 'Source Serif 4', category: 'Serif', stack: "'Source Serif 4', Georgia, serif" },
  { id: 'arial', label: 'Arial', category: 'Sans-Serif', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', category: 'Sans-Serif', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: 'calibri', label: 'Calibri', category: 'Sans-Serif', stack: "Calibri, 'Open Sans', sans-serif" },
  { id: 'verdana', label: 'Verdana', category: 'Sans-Serif', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'tahoma', label: 'Tahoma', category: 'Sans-Serif', stack: 'Tahoma, Verdana, sans-serif' },
  { id: 'trebuchet', label: 'Trebuchet MS', category: 'Sans-Serif', stack: "'Trebuchet MS', Helvetica, sans-serif" },
  { id: 'open-sans', label: 'Open Sans', category: 'Sans-Serif', stack: "'Open Sans', Arial, sans-serif" },
  { id: 'lato', label: 'Lato', category: 'Sans-Serif', stack: "'Lato', Arial, sans-serif" },
  { id: 'montserrat', label: 'Montserrat', category: 'Sans-Serif', stack: "'Montserrat', Arial, sans-serif" },
  { id: 'poppins', label: 'Poppins', category: 'Sans-Serif', stack: "'Poppins', Arial, sans-serif" },
  { id: 'courier-new', label: 'Courier New', category: 'Monospace', stack: "'Courier New', 'JetBrains Mono', Courier, monospace" },
];

const FONT_SIZES = ['12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px', '28px', '32px'];

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

const UNORDERED_LIST_STYLES: Array<{ label: string; value: 'disc' | 'circle' | 'square'; sample: string }> = [
  { label: 'Bullet Disc', value: 'disc', sample: '•' },
  { label: 'Hollow Circle', value: 'circle', sample: '◦' },
  { label: 'Square', value: 'square', sample: '▪' },
];

const ORDERED_LIST_STYLES: Array<{ label: string; value: 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman'; sample: string }> = [
  { label: 'Numbers (1, 2, 3)', value: 'decimal', sample: '1.' },
  { label: 'Lowercase (a, b, c)', value: 'lower-alpha', sample: 'a.' },
  { label: 'Uppercase (A, B, C)', value: 'upper-alpha', sample: 'A.' },
  { label: 'Roman Lower (i, ii)', value: 'lower-roman', sample: 'i.' },
  { label: 'Roman Upper (I, II)', value: 'upper-roman', sample: 'I.' },
];

type ToolbarMenu = 'font' | 'lists' | 'spacing' | 'text' | 'highlight' | 'link' | null;

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'PRE']);

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your main contents here...',
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [sourceMode, setSourceMode] = useState(false);
  const [openMenu, setOpenMenu] = useState<ToolbarMenu>(null);
  const [fontSearch, setFontSearch] = useState('');

  // Active formatting state synced with caret/selection
  const [activeBlock, setActiveBlock] = useState('p');
  const [activeFontLabel, setActiveFontLabel] = useState('Times New Roman');
  const [activeFontSize, setActiveFontSize] = useState('14px');
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    unorderedList: false,
    orderedList: false,
    align: 'left' as 'left' | 'center' | 'right' | 'justify',
  });

  // Custom Spacing & Margin state
  const [lineHeightVal, setLineHeightVal] = useState('1.65');
  const [letterSpacingPx, setLetterSpacingPx] = useState('0');
  const [wordSpacingPx, setWordSpacingPx] = useState('0');
  const [marginTopPx, setMarginTopPx] = useState('8');
  const [marginBottomPx, setMarginBottomPx] = useState('10');
  const [marginLeftPx, setMarginLeftPx] = useState('0');
  const [marginRightPx, setMarginRightPx] = useState('0');

  const [textColor, setTextColor] = useState('#0f172a');
  const [highlightColor, setHighlightColor] = useState('#fef08a');
  const [linkUrl, setLinkUrl] = useState('');

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

  // Dismiss popovers on outside click or Escape
  useEffect(() => {
    if (!openMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openMenu]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const getNearestBlock = (node: Node | null): HTMLElement | null => {
    const el = editorRef.current;
    if (!el) return null;
    let cur: Node | null = node;
    while (cur && cur !== el) {
      if (cur.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((cur as HTMLElement).tagName)) {
        return cur as HTMLElement;
      }
      cur = cur.parentNode;
    }
    return null;
  };

  const syncToolbarFromSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el || sourceMode) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    savedRangeRef.current = range.cloneRange();

    let anchorEl: HTMLElement | null =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement)
        : range.startContainer.parentElement;

    const blk = getNearestBlock(range.startContainer);
    if (blk) {
      const tag = blk.tagName.toLowerCase();
      if (['p', 'h1', 'h2', 'h3', 'blockquote', 'pre'].includes(tag)) {
        setActiveBlock(tag);
      } else {
        setActiveBlock('p');
      }
    } else {
      setActiveBlock('p');
    }

    if (anchorEl) {
      const computed = window.getComputedStyle(anchorEl);
      const rawFont = computed.fontFamily || '';
      const matchedFont = EDITOR_FONT_FAMILIES.find((f) =>
        rawFont.toLowerCase().includes(f.label.toLowerCase())
      );
      if (matchedFont) {
        setActiveFontLabel(matchedFont.label);
      }

      const rawSize = parseInt(computed.fontSize || '14', 10);
      if (!Number.isNaN(rawSize) && rawSize > 0) {
        setActiveFontSize(`${rawSize}px`);
      }

      const targetBlk = blk || anchorEl;
      const blkComputed = window.getComputedStyle(targetBlk);
      const ta = blkComputed.textAlign;
      const normalizedAlign: 'left' | 'center' | 'right' | 'justify' =
        ta === 'center' || ta === 'right' || ta === 'justify' ? ta : 'left';

      // Sync custom margin & spacing readouts if block has explicit inline styles
      if (targetBlk.style.lineHeight) {
        setLineHeightVal(targetBlk.style.lineHeight);
      }
      if (targetBlk.style.letterSpacing) {
        const parsedLs = parseFloat(targetBlk.style.letterSpacing);
        if (!Number.isNaN(parsedLs)) setLetterSpacingPx(String(parsedLs));
      }
      if (targetBlk.style.wordSpacing) {
        const parsedWs = parseFloat(targetBlk.style.wordSpacing);
        if (!Number.isNaN(parsedWs)) setWordSpacingPx(String(parsedWs));
      }
      if (targetBlk.style.marginTop) setMarginTopPx(String(parseInt(targetBlk.style.marginTop, 10) || 0));
      if (targetBlk.style.marginBottom) setMarginBottomPx(String(parseInt(targetBlk.style.marginBottom, 10) || 0));
      if (targetBlk.style.marginLeft) setMarginLeftPx(String(parseInt(targetBlk.style.marginLeft, 10) || 0));
      if (targetBlk.style.marginRight) setMarginRightPx(String(parseInt(targetBlk.style.marginRight, 10) || 0));

      try {
        setActiveFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          strikeThrough: document.queryCommandState('strikeThrough'),
          unorderedList: document.queryCommandState('insertUnorderedList'),
          orderedList: document.queryCommandState('insertOrderedList'),
          align: normalizedAlign,
        });
      } catch {
        setActiveFormats((prev) => ({ ...prev, align: normalizedAlign }));
      }
    }
  }, [sourceMode]);

  useEffect(() => {
    const onSelChange = () => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        syncToolbarFromSelection();
      }
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, [syncToolbarFromSelection]);

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

  const runExec = (command: string, val?: string) => {
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {}
    document.execCommand(command, false, val);
    saveSelection();
    syncToolbarFromSelection();
    emitChange();
  };

  const applyInlineStyle = (styleProp: 'fontFamily' | 'fontSize' | 'backgroundColor' | 'color', styleVal: string) => {
    restoreSelection();
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      (el.style as any)[styleProp] = styleVal;
      emitChange();
      return;
    }

    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    if (range.collapsed) {
      // If inside an existing styled span, update it; otherwise insert a styled typing span
      const parentEl =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as HTMLElement)
          : range.startContainer.parentElement;

      if (parentEl && parentEl !== el && parentEl.tagName === 'SPAN' && parentEl.childNodes.length <= 1) {
        (parentEl.style as any)[styleProp] = styleVal;
      } else {
        const span = document.createElement('span');
        (span.style as any)[styleProp] = styleVal;
        span.innerHTML = '&#8203;';
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.setStart(span.firstChild!, 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        savedRangeRef.current = newRange.cloneRange();
      }
    } else {
      const span = document.createElement('span');
      (span.style as any)[styleProp] = styleVal;
      const frag = range.extractContents();
      // Remove conflicting style on nested spans inside extracted selection
      frag.querySelectorAll('span, font').forEach((child) => {
        const childEl = child as HTMLElement;
        if (childEl.style && (childEl.style as any)[styleProp]) {
          (childEl.style as any)[styleProp] = '';
        }
        if (childEl.tagName === 'FONT' && styleProp === 'fontFamily') {
          childEl.removeAttribute('face');
        }
      });
      span.appendChild(frag);
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
    }

    syncToolbarFromSelection();
    emitChange();
  };

  const applyBlockCss = (styles: Record<string, string>, applyToAll = false) => {
    restoreSelection();
    const el = editorRef.current;
    if (!el) return;

    const targets = new Set<HTMLElement>();

    if (applyToAll) {
      if (el.children.length > 0) {
        Array.from(el.children).forEach((child) => targets.add(child as HTMLElement));
      } else {
        Object.entries(styles).forEach(([k, v]) => {
          (el.style as any)[k] = v;
        });
      }
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const startBlock = getNearestBlock(range.startContainer);
        const endBlock = getNearestBlock(range.endContainer);
        if (startBlock) targets.add(startBlock);
        if (endBlock) targets.add(endBlock);

        if (targets.size === 0) {
          Array.from(el.children).forEach((child) => {
            if (range.intersectsNode(child)) {
              targets.add(child as HTMLElement);
            }
          });
        }
      }

      if (targets.size === 0) {
        if (el.children.length > 0) {
          targets.add(el.firstElementChild as HTMLElement);
        } else {
          Object.entries(styles).forEach(([k, v]) => {
            (el.style as any)[k] = v;
          });
        }
      }
    }

    targets.forEach((blk) => {
      Object.entries(styles).forEach(([k, v]) => {
        (blk.style as any)[k] = v;
      });
    });

    syncToolbarFromSelection();
    emitChange();
  };

  const handleHeadingChange = (tag: string) => {
    setActiveBlock(tag);
    if (tag === 'pre') {
      runExec('formatBlock', 'PRE');
    } else if (tag === 'blockquote') {
      runExec('formatBlock', 'BLOCKQUOTE');
    } else {
      runExec('formatBlock', tag.toUpperCase());
    }
  };

  const handleAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    const cmdMap = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
      justify: 'justifyFull',
    };
    runExec(cmdMap[align]);
    applyBlockCss({ textAlign: align });
  };

  const handleSmartIndent = (direction: 'indent' | 'outdent') => {
    restoreSelection();
    const sel = window.getSelection();
    const blk = sel && sel.rangeCount > 0 ? getNearestBlock(sel.getRangeAt(0).startContainer) : null;
    if (blk && (blk.tagName === 'LI' || blk.closest('ul, ol'))) {
      runExec(direction);
      return;
    }
    const currentLeft = parseInt((blk?.style.marginLeft || '0').replace('px', ''), 10) || 0;
    const nextLeft =
      direction === 'indent'
        ? Math.min(160, currentLeft + 24)
        : Math.max(0, currentLeft - 24);
    setMarginLeftPx(String(nextLeft));
    applyBlockCss({ marginLeft: `${nextLeft}px` });
  };

  const handleApplyFontFamily = (font: EditorFontOption) => {
    setActiveFontLabel(font.label);
    applyInlineStyle('fontFamily', font.stack);
    setOpenMenu(null);
  };

  const handleApplyListStyle = (
    kind: 'ul' | 'ol',
    listStyleType: string
  ) => {
    restoreSelection();
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    const anchor = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null;
    const existingList = (
      anchor?.nodeType === Node.ELEMENT_NODE
        ? (anchor as HTMLElement)
        : anchor?.parentElement
    )?.closest('ul, ol') as HTMLElement | null;

    if (!existingList || existingList.tagName.toLowerCase() !== kind) {
      document.execCommand(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
    }

    const updatedSel = window.getSelection();
    const updatedAnchor =
      updatedSel && updatedSel.rangeCount > 0 ? updatedSel.getRangeAt(0).startContainer : null;
    const targetList = (
      updatedAnchor?.nodeType === Node.ELEMENT_NODE
        ? (updatedAnchor as HTMLElement)
        : updatedAnchor?.parentElement
    )?.closest('ul, ol') as HTMLElement | null;

    if (targetList) {
      targetList.style.listStyleType = listStyleType;
      targetList.style.paddingLeft = '22px';
    }

    saveSelection();
    syncToolbarFromSelection();
    emitChange();
    setOpenMenu(null);
  };

  const handleInsertChecklist = () => {
    restoreSelection();
    const snippet =
      '<ul style="list-style-type: none; padding-left: 16px;"><li>☐ Task item</li></ul>';
    document.execCommand('insertHTML', false, snippet);
    saveSelection();
    emitChange();
    setOpenMenu(null);
  };

  const handleApplyCustomSpacingAndMargin = (applyToAll = false) => {
    const lh = Math.max(0.9, Math.min(3.5, parseFloat(lineHeightVal) || 1.65));
    const ls = Math.max(-4, Math.min(20, parseFloat(letterSpacingPx) || 0));
    const ws = Math.max(-4, Math.min(24, parseFloat(wordSpacingPx) || 0));
    const mt = Math.max(0, Math.min(120, parseInt(marginTopPx, 10) || 0));
    const mb = Math.max(0, Math.min(120, parseInt(marginBottomPx, 10) || 0));
    const ml = Math.max(0, Math.min(160, parseInt(marginLeftPx, 10) || 0));
    const mr = Math.max(0, Math.min(160, parseInt(marginRightPx, 10) || 0));

    applyBlockCss(
      {
        lineHeight: String(lh),
        letterSpacing: `${ls}px`,
        wordSpacing: `${ws}px`,
        marginTop: `${mt}px`,
        marginBottom: `${mb}px`,
        marginLeft: `${ml}px`,
        marginRight: `${mr}px`,
      },
      applyToAll
    );
  };

  const handleClearFormatting = () => {
    restoreSelection();
    runExec('removeFormat');
    applyBlockCss({
      lineHeight: '',
      letterSpacing: '',
      wordSpacing: '',
      marginTop: '',
      marginBottom: '',
      marginLeft: '',
      marginRight: '',
      textAlign: '',
      fontFamily: '',
      fontSize: '',
    });
  };

  const handleInsertLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\/|^mailto:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    runExec('createLink', normalized);
    setLinkUrl('');
    setOpenMenu(null);
  };

  const filteredFonts = EDITOR_FONT_FAMILIES.filter((f) =>
    f.label.toLowerCase().includes(fontSearch.trim().toLowerCase()) ||
    f.category.toLowerCase().includes(fontSearch.trim().toLowerCase())
  );

  const btnClass = (active = false) =>
    `p-1.5 rounded border transition-colors cursor-pointer ${
      active
        ? 'bg-cyan-900 text-white border-cyan-900 shadow-2xs'
        : 'border-transparent hover:bg-white hover:border-slate-300 text-slate-800'
    }`;

  return (
    <div
      ref={wrapperRef}
      className="w-full max-w-full rounded-xl border border-slate-300 bg-white overflow-visible shadow-2xs"
    >
      {/* Rich Formatting Toolbar */}
      <div className="p-2 bg-[#edf2f8] border-b border-slate-300 rounded-t-xl flex flex-wrap items-center gap-1.5 text-xs">
        {/* Undo / Redo */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('undo');
          }}
          className={btnClass()}
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('redo');
          }}
          className={btnClass()}
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Heading / Block Format */}
        <select
          aria-label="Text block format"
          value={activeBlock}
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

        {/* 20 Most Used Font Families Tap */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              setOpenMenu((prev) => (prev === 'font' ? null : 'font'));
            }}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
              openMenu === 'font'
                ? 'bg-cyan-900 text-white border-cyan-900'
                : 'bg-white text-slate-800 border-slate-300 hover:border-cyan-700'
            }`}
            title="Choose from 20 most used font families"
            aria-label="Font Family"
          >
            <Type className="w-3 h-3 shrink-0" />
            <span className="max-w-[105px] truncate">{activeFontLabel}</span>
            <ChevronDown className="w-3 h-3 shrink-0 opacity-75" />
          </button>

          {openMenu === 'font' && (
            <div className="absolute left-0 top-full mt-1.5 z-40 w-72 sm:w-80 rounded-xl bg-white border border-slate-300 shadow-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-800">
                  Font Family (20 Popular Fonts)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {filteredFonts.length}/20
                </span>
              </div>
              <input
                type="text"
                value={fontSearch}
                onChange={(e) => setFontSearch(e.target.value)}
                placeholder="Filter fonts..."
                className="w-full px-2 py-1 rounded border border-slate-300 bg-slate-50 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
              <div className="max-h-60 overflow-y-auto grid grid-cols-1 gap-1 pr-0.5">
                {filteredFonts.map((font) => {
                  const isActive = activeFontLabel === font.label;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleApplyFontFamily(font);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-cyan-50 border-cyan-700 text-cyan-950'
                          : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-800'
                      }`}
                    >
                      <span
                        className="text-xs sm:text-[13px] truncate"
                        style={{ fontFamily: font.stack }}
                      >
                        {font.label}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-sans">
                        {font.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Font Size */}
        <select
          aria-label="Font size"
          value={FONT_SIZES.includes(activeFontSize) ? activeFontSize : '14px'}
          onChange={(e) => {
            setActiveFontSize(e.target.value);
            applyInlineStyle('fontSize', e.target.value);
          }}
          className="px-1.5 py-1 rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-800 cursor-pointer"
          title="Font Size"
        >
          {FONT_SIZES.map((sz) => (
            <option key={sz} value={sz}>
              {sz}
            </option>
          ))}
        </select>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Inline Emphasis */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('bold');
          }}
          className={btnClass(activeFormats.bold)}
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
          className={btnClass(activeFormats.italic)}
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
          className={btnClass(activeFormats.underline)}
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
          className={btnClass(activeFormats.strikeThrough)}
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
              setOpenMenu((prev) => (prev === 'text' ? null : 'text'));
            }}
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
            title="Text Color"
            aria-label="Text Color"
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="w-2.5 h-2.5 rounded-full border border-slate-400" style={{ backgroundColor: textColor }} />
          </button>
          {openMenu === 'text' && (
            <div className="absolute left-0 top-full mt-1.5 z-40 p-2 rounded-lg bg-white border border-slate-300 shadow-lg flex items-center gap-1.5">
              {TEXT_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTextColor(c);
                    runExec('foreColor', c);
                    setOpenMenu(null);
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
              setOpenMenu((prev) => (prev === 'highlight' ? null : 'highlight'));
            }}
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded hover:bg-white border border-transparent hover:border-slate-300 text-slate-800 cursor-pointer"
            title="Highlight Color"
            aria-label="Highlight Color"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span
              className="w-2.5 h-2.5 rounded-sm border border-slate-400"
              style={{ backgroundColor: highlightColor === 'transparent' ? '#ffffff' : highlightColor }}
            />
          </button>
          {openMenu === 'highlight' && (
            <div className="absolute left-0 top-full mt-1.5 z-40 p-2 rounded-lg bg-white border border-slate-300 shadow-lg flex items-center gap-1.5">
              {HIGHLIGHT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setHighlightColor(c);
                    if (c === 'transparent') {
                      applyInlineStyle('backgroundColor', 'transparent');
                    } else {
                      runExec('hiliteColor', c);
                    }
                    setOpenMenu(null);
                  }}
                  className="w-4 h-4 rounded border border-slate-300 cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: c === 'transparent' ? '#ffffff' : c }}
                  title={c === 'transparent' ? 'Clear highlight' : c}
                >
                  {c === 'transparent' && (
                    <span className="absolute inset-0 border-t-2 border-rose-500 rotate-45 origin-center translate-y-1.5" />
                  )}
                </button>
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
            handleAlignment('left');
          }}
          className={btnClass(activeFormats.align === 'left')}
          title="Align Left"
          aria-label="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleAlignment('center');
          }}
          className={btnClass(activeFormats.align === 'center')}
          title="Align Center"
          aria-label="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleAlignment('right');
          }}
          className={btnClass(activeFormats.align === 'right')}
          title="Align Right"
          aria-label="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleAlignment('justify');
          }}
          className={btnClass(activeFormats.align === 'justify')}
          title="Justify"
          aria-label="Justify"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Quick Bullet & Numbered Lists + Advanced Lists Tap */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('insertUnorderedList');
          }}
          className={btnClass(activeFormats.unorderedList)}
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
          className={btnClass(activeFormats.orderedList)}
          title="Numbered List"
          aria-label="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              setOpenMenu((prev) => (prev === 'lists' ? null : 'lists'));
            }}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
              openMenu === 'lists'
                ? 'bg-cyan-900 text-white border-cyan-900'
                : 'bg-white text-slate-800 border-slate-300 hover:border-cyan-700'
            }`}
            title="List Styles & Checklists"
          >
            <ListChecks className="w-3 h-3" />
            <span>Lists</span>
            <ChevronDown className="w-3 h-3 opacity-75" />
          </button>

          {openMenu === 'lists' && (
            <div className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-xl bg-white border border-slate-300 shadow-xl p-2.5 space-y-2.5 text-[11px]">
              <div className="space-y-1">
                <span className="block font-bold text-slate-700">Unordered Lists</span>
                <div className="grid grid-cols-1 gap-1">
                  {UNORDERED_LIST_STYLES.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleApplyListStyle('ul', st.value);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-[#edf2f8] text-slate-800 cursor-pointer text-left"
                    >
                      <span className="w-4 font-bold text-cyan-800">{st.sample}</span>
                      <span>{st.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 border-t border-slate-200 pt-2">
                <span className="block font-bold text-slate-700">Ordered Lists</span>
                <div className="grid grid-cols-1 gap-1">
                  {ORDERED_LIST_STYLES.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleApplyListStyle('ol', st.value);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-[#edf2f8] text-slate-800 cursor-pointer text-left"
                    >
                      <span className="w-4 font-bold text-cyan-800 font-mono">{st.sample}</span>
                      <span>{st.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleInsertChecklist();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-slate-50 hover:bg-cyan-50 border border-slate-200 text-slate-800 font-semibold cursor-pointer"
                >
                  <ListChecks className="w-3.5 h-3.5 text-cyan-800" />
                  <span>Insert Task Checklist (☐)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Smart Indent / Outdent */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleSmartIndent('indent');
          }}
          className={btnClass()}
          title="Increase Indent / Margin"
          aria-label="Increase Indent / Margin"
        >
          <Indent className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleSmartIndent('outdent');
          }}
          className={btnClass()}
          title="Decrease Indent / Margin"
          aria-label="Decrease Indent / Margin"
        >
          <Outdent className="w-3.5 h-3.5" />
        </button>

        {/* Quote, Link, Divider */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('formatBlock', 'BLOCKQUOTE');
          }}
          className={btnClass(activeBlock === 'blockquote')}
          title="Block Quote"
          aria-label="Block Quote"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              setOpenMenu((prev) => (prev === 'link' ? null : 'link'));
            }}
            className={btnClass(openMenu === 'link')}
            title="Insert Link"
            aria-label="Insert Link"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          {openMenu === 'link' && (
            <div className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-xl bg-white border border-slate-300 shadow-xl p-2.5 space-y-2 text-[11px]">
              <span className="block font-bold text-slate-800">Insert Hyperlink</span>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-2 py-1 rounded border border-slate-300 bg-slate-50 text-xs"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    runExec('unlink');
                    setOpenMenu(null);
                  }}
                  className="px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Unlink
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleInsertLink();
                  }}
                  className="px-2.5 py-1 rounded bg-cyan-900 text-white font-semibold cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            runExec('insertHorizontalRule');
          }}
          className={btnClass()}
          title="Horizontal Divider"
          aria-label="Horizontal Divider"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Custom Margin & Spacing Tap */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              setOpenMenu((prev) => (prev === 'spacing' ? null : 'spacing'));
            }}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
              openMenu === 'spacing'
                ? 'bg-cyan-900 text-white border-cyan-900'
                : 'bg-white text-slate-800 border-slate-300 hover:border-cyan-700'
            }`}
            title="Custom Margins & Typography Spacing"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Margin &amp; Spacing</span>
            <ChevronDown className="w-3 h-3 opacity-75" />
          </button>

          {openMenu === 'spacing' && (
            <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 z-40 w-72 sm:w-80 rounded-xl bg-white border border-slate-300 shadow-xl p-3 space-y-3 text-[11px]">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="font-bold text-slate-900">Custom Spacing &amp; Margins</span>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setLineHeightVal('1.65');
                    setLetterSpacingPx('0');
                    setWordSpacingPx('0');
                    setMarginTopPx('8');
                    setMarginBottomPx('10');
                    setMarginLeftPx('0');
                    setMarginRightPx('0');
                    applyBlockCss({
                      lineHeight: '1.65',
                      letterSpacing: '0px',
                      wordSpacing: '0px',
                      marginTop: '8px',
                      marginBottom: '10px',
                      marginLeft: '0px',
                      marginRight: '0px',
                    });
                  }}
                  className="text-[10px] font-semibold text-cyan-800 hover:underline cursor-pointer"
                >
                  Reset Default
                </button>
              </div>

              {/* Quick Spacing Presets */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Compact', lh: '1.35', ls: '0', mt: '4', mb: '4', ml: '0', mr: '0' },
                  { label: 'Editorial', lh: '1.7', ls: '0.2', mt: '10', mb: '14', ml: '0', mr: '0' },
                  { label: 'Inset', lh: '1.75', ls: '0', mt: '10', mb: '12', ml: '24', mr: '24' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setLineHeightVal(preset.lh);
                      setLetterSpacingPx(preset.ls);
                      setMarginTopPx(preset.mt);
                      setMarginBottomPx(preset.mb);
                      setMarginLeftPx(preset.ml);
                      setMarginRightPx(preset.mr);
                      applyBlockCss({
                        lineHeight: preset.lh,
                        letterSpacing: `${preset.ls}px`,
                        marginTop: `${preset.mt}px`,
                        marginBottom: `${preset.mb}px`,
                        marginLeft: `${preset.ml}px`,
                        marginRight: `${preset.mr}px`,
                      });
                    }}
                    className="px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-cyan-50 hover:border-cyan-700 font-semibold text-slate-700 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Spacing Inputs */}
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-0.5">
                  <span className="block font-semibold text-slate-600">Line Height</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.9"
                    max="3.5"
                    value={lineHeightVal}
                    onChange={(e) => setLineHeightVal(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-slate-300 bg-slate-50 font-mono text-xs"
                  />
                </label>
                <label className="space-y-0.5">
                  <span className="block font-semibold text-slate-600">Letter (px)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="-4"
                    max="20"
                    value={letterSpacingPx}
                    onChange={(e) => setLetterSpacingPx(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-slate-300 bg-slate-50 font-mono text-xs"
                  />
                </label>
                <label className="space-y-0.5">
                  <span className="block font-semibold text-slate-600">Word (px)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="-4"
                    max="24"
                    value={wordSpacingPx}
                    onChange={(e) => setWordSpacingPx(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-slate-300 bg-slate-50 font-mono text-xs"
                  />
                </label>
              </div>

              {/* Custom Margins */}
              <div className="space-y-1">
                <span className="block font-bold text-slate-700">Custom Paragraph Margins (px)</span>
                <div className="grid grid-cols-4 gap-1.5">
                  <label className="space-y-0.5">
                    <span className="block text-[10px] text-slate-500">Top</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={marginTopPx}
                      onChange={(e) => setMarginTopPx(e.target.value)}
                      className="w-full px-1.5 py-1 rounded border border-slate-300 bg-slate-50 font-mono text-xs"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="block text-[10px] text-slate-500">Bottom</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={marginBottomPx}
                      onChange={(e) => setMarginBottomPx(e.target.value)}
                      className="w-full px-1.5 py-1 rounded border border-slate-300 bg-slate-50 font-mono text-xs"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="block text-[10px] text-slate-500">Left</span>
                    <input
                      type="number"
                      min="0"
                      max="160"
                      value={marginLeftPx}
                      onChange={(e) => setMarginLeftPx(e.target.value)}
                      className="w-full px-1.5 py-1 rounded border border-slate-300 bg-slate-50 font-mono text-xs"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="block text-[10px] text-slate-500">Right</span>
                    <input
                      type="number"
                      min="0"
                      max="160"
                      value={marginRightPx}
                      onChange={(e) => setMarginRightPx(e.target.value)}
                      className="w-full px-1.5 py-1 rounded border border-slate-300 bg-slate-50 font-mono text-xs"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleApplyCustomSpacingAndMargin(false);
                  }}
                  className="flex-1 px-2 py-1.5 rounded bg-cyan-900 hover:bg-cyan-800 text-white font-semibold cursor-pointer"
                >
                  Apply Selection
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleApplyCustomSpacingAndMargin(true);
                  }}
                  className="flex-1 px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold cursor-pointer"
                >
                  Apply All
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleClearFormatting();
          }}
          className={btnClass()}
          title="Clear Formatting"
          aria-label="Clear Formatting"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setOpenMenu(null);
            setSourceMode((prev) => !prev);
          }}
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
          className="w-full min-h-[240px] p-3 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none leading-relaxed rounded-b-xl"
        />
      ) : (
        <div className="relative rounded-b-xl overflow-hidden">
          {!value && (
            <div className="absolute top-3 left-3.5 text-xs text-slate-400 pointer-events-none select-none">
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
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                handleSmartIndent(e.shiftKey ? 'outdent' : 'indent');
              }
            }}
            onKeyUp={() => {
              saveSelection();
              syncToolbarFromSelection();
            }}
            onMouseUp={() => {
              saveSelection();
              syncToolbarFromSelection();
            }}
            onBlur={emitChange}
            className="w-full min-h-[240px] max-h-[520px] overflow-y-auto p-3.5 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none leading-relaxed font-serif [&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-1.5 [&_blockquote]:border-l-3 [&_blockquote]:border-cyan-700 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-700 [&_blockquote]:my-2 [&_pre]:bg-slate-100 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-[11px] [&_pre]:my-2 [&_p]:my-1.5 [&_a]:text-cyan-800 [&_a]:underline [&_hr]:my-3 [&_hr]:border-slate-200"
          />
        </div>
      )}
    </div>
  );
};
