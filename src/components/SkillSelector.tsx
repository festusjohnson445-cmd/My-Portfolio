import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Code,
  Plus,
  X,
  Sparkles,
  Search,
  Check,
  Layers,
} from 'lucide-react';
import {
  SKILLS_DATABASE,
  CORE_ENGINEERING_SKILLS_LIST,
  HANDFUL_SKILLS_LIST,
  IT_SKILLS_LIST,
  SKILL_STATUS_OPTIONS,
  DEFAULT_SKILL_STATUS,
  stripSkillTags,
  type SkillCategoryGroup,
  type SkillCategoryName,
  type SkillStatus,
} from '../data/skillsData';

interface SkillSelectorProps {
  value: string;
  onChange: (newValue: string) => void;
  skillStatuses?: Record<string, SkillStatus>;
  onSkillStatusesChange?: (next: Record<string, SkillStatus>) => void;
  certifiedSkills?: string[];
  label?: string;
  required?: boolean;
}

export interface ParsedSkillItem {
  name: string;
  isCertified: boolean;
  certLabel?: string;
}

export function parseSkillString(raw: string): ParsedSkillItem[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((item) => {
      const certMatch =
        item.match(/\[Certified(?::\s*([^\]]+))?\]/i) ||
        item.match(/\(Certified(?::\s*([^\)]+))?\)/i);
      const cleanName = stripSkillTags(item);
      if (certMatch) {
        return {
          name: cleanName,
          isCertified: true,
          certLabel: certMatch[1] ? certMatch[1].trim() : 'Certified',
        };
      }
      return {
        name: cleanName,
        isCertified: false,
      };
    });
}

export function serializeSkillItems(items: ParsedSkillItem[]): string {
  return items.map((e) => e.name).join(', ');
}

const STATUS_BADGE_CLASSES: Record<SkillStatus, string> = {
  'in progress': 'bg-amber-600/90 text-white border-amber-400',
  verified: 'bg-emerald-700 text-white border-emerald-400',
  licensed: 'bg-indigo-700 text-white border-indigo-400',
  completed: 'bg-cyan-700 text-white border-cyan-400',
};

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  value,
  onChange,
  skillStatuses = {},
  onSkillStatusesChange,
  certifiedSkills = [],
  label = 'Skills & Competencies',
  required = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | SkillCategoryName>('All');
  const [handfulInput, setHandfulInput] = useState('');
  const [handfulStatus, setHandfulStatus] = useState<SkillStatus>(DEFAULT_SKILL_STATUS);
  const [itInput, setItInput] = useState('');
  const [itStatus, setItStatus] = useState<SkillStatus>(DEFAULT_SKILL_STATUS);
  const [coreInput, setCoreInput] = useState('');
  const [coreStatus, setCoreStatus] = useState<SkillStatus>(DEFAULT_SKILL_STATUS);
  const [searchFilter, setSearchFilter] = useState('');

  const currentSkills: ParsedSkillItem[] = useMemo(() => {
    return parseSkillString(value);
  }, [value]);

  const currentSkillsSet = useMemo(() => {
    return new Set(currentSkills.map((s) => s.name.toLowerCase()));
  }, [currentSkills]);

  const getStatusForSkill = (name: string, legacyCert?: boolean): SkillStatus => {
    const exact = skillStatuses[name];
    if (exact && SKILL_STATUS_OPTIONS.includes(exact)) return exact;
    const key = Object.keys(skillStatuses).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key && SKILL_STATUS_OPTIONS.includes(skillStatuses[key])) return skillStatuses[key];
    if (
      legacyCert ||
      certifiedSkills.some((c) => c.toLowerCase() === name.toLowerCase())
    ) {
      return 'verified';
    }
    return DEFAULT_SKILL_STATUS;
  };

  const handleSetSkillStatus = (skillName: string, nextStatus: SkillStatus) => {
    if (!onSkillStatusesChange) return;
    const next = { ...skillStatuses, [skillName]: nextStatus };
    onSkillStatusesChange(next);
  };

  const handleAddSkill = (
    skillName: string,
    initialStatus: SkillStatus = DEFAULT_SKILL_STATUS,
    resetFn?: () => void
  ) => {
    const trimmed = stripSkillTags(skillName);
    if (!trimmed) return;
    if (currentSkillsSet.has(trimmed.toLowerCase())) {
      resetFn?.();
      return;
    }

    const updated = [
      ...currentSkills,
      {
        name: trimmed,
        isCertified: initialStatus === 'verified' || initialStatus === 'licensed',
      },
    ];
    onChange(serializeSkillItems(updated));
    if (onSkillStatusesChange) {
      onSkillStatusesChange({
        ...skillStatuses,
        [trimmed]: initialStatus,
      });
    }
    resetFn?.();
  };

  const handleRemoveSkill = (skillName: string) => {
    const updated = currentSkills.filter(
      (s) => s.name.toLowerCase() !== skillName.toLowerCase()
    );
    onChange(serializeSkillItems(updated));
    if (onSkillStatusesChange) {
      const next = { ...skillStatuses };
      Object.keys(next).forEach((k) => {
        if (k.toLowerCase() === skillName.toLowerCase()) delete next[k];
      });
      onSkillStatusesChange(next);
    }
  };

  const handleClearAll = () => {
    onChange('');
    onSkillStatusesChange?.({});
  };

  const displayedSkills = useMemo(() => {
    const list: { category: SkillCategoryName; subcategory: string; name: string }[] = [];
    SKILLS_DATABASE.forEach((group: SkillCategoryGroup) => {
      if (selectedCategory === 'All' || selectedCategory === group.category) {
        group.subcategories.forEach((sub) => {
          sub.skills.forEach((skill) => {
            if (
              !searchFilter ||
              skill.toLowerCase().includes(searchFilter.toLowerCase()) ||
              sub.name.toLowerCase().includes(searchFilter.toLowerCase())
            ) {
              list.push({
                category: group.category,
                subcategory: sub.name,
                name: skill,
              });
            }
          });
        });
      }
    });
    return list;
  }, [selectedCategory, searchFilter]);

  const categories: ('All' | SkillCategoryName)[] = [
    'All',
    'Core Engineering Skills',
    'Handful Skills',
    'IT Skills',
  ];

  const getCategoryIcon = (cat: 'All' | SkillCategoryName) => {
    switch (cat) {
      case 'Core Engineering Skills':
        return <Sparkles className="w-2.5 h-2.5 text-cyan-500 shrink-0" />;
      case 'Handful Skills':
        return <Wrench className="w-2.5 h-2.5 text-amber-500 shrink-0" />;
      case 'IT Skills':
        return <Code className="w-2.5 h-2.5 text-emerald-500 shrink-0" />;
      default:
        return <Layers className="w-2.5 h-2.5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden space-y-2.5 font-serif text-slate-800">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-bold text-slate-800">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {currentSkills.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[10px] text-slate-500 hover:text-red-600 font-sans transition-colors cursor-pointer"
          >
            Clear All ({currentSkills.length})
          </button>
        )}
      </div>

      {/* Selected Skills Chips with 4-Status Selector */}
      <div className="w-full max-w-full min-h-[42px] p-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] flex flex-wrap gap-1.5 items-center overflow-hidden">
        {currentSkills.length === 0 ? (
          <span className="text-[11px] text-slate-400 italic font-sans">
            No skills selected yet. Add via the categorized datalists below or click chips from the palette.
          </span>
        ) : (
          currentSkills.map((skill, index) => {
            const st = getStatusForSkill(skill.name, skill.isCertified);
            return (
              <span
                key={`${skill.name}-${index}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] shadow-2xs max-w-full"
              >
                <span className="truncate max-w-[140px]">{skill.name}</span>

                {onSkillStatusesChange ? (
                  <select
                    value={st}
                    onChange={(e) =>
                      handleSetSkillStatus(skill.name, e.target.value as SkillStatus)
                    }
                    aria-label={`Status for ${skill.name}`}
                    className={`text-[9.5px] px-1 py-0.2 rounded border font-sans font-semibold cursor-pointer focus:outline-none ${STATUS_BADGE_CLASSES[st]}`}
                  >
                    {SKILL_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-slate-900 text-white">
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`text-[9.5px] px-1 py-0.2 rounded border font-sans font-semibold ${STATUS_BADGE_CLASSES[st]}`}
                  >
                    {st}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill.name)}
                  className="hover:bg-slate-700 rounded-full p-0.5 transition-colors cursor-pointer text-slate-300 hover:text-white shrink-0"
                  title={`Remove ${skill.name}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* Separate Datalist Inputs for Handful Skills, IT Skills & Core Engineering Skills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 w-full max-w-full min-w-0">
        {/* 1. Handful Skills Datalist Input */}
        <div className="min-w-0 w-full bg-white p-2.5 rounded-lg border border-amber-300/80 space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-900">
            <Wrench className="w-3 h-3 text-amber-600 shrink-0" />
            <span className="truncate">Handful Skills Input</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-1.5 min-w-0">
            <div className="relative flex-1 min-w-0">
              <input
                list="handful-skills-datalist"
                type="text"
                value={handfulInput}
                onChange={(e) => setHandfulInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill(handfulInput, handfulStatus, () => setHandfulInput(''));
                  }
                }}
                placeholder="Type or select handful skill..."
                className="w-full min-w-0 px-2 py-1 pl-6 rounded border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700 text-xs font-sans"
              />
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
              <datalist id="handful-skills-datalist">
                {HANDFUL_SKILLS_LIST.map((skill) => (
                  <option key={skill} value={skill} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <select
              value={handfulStatus}
              onChange={(e) => setHandfulStatus(e.target.value as SkillStatus)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-slate-50 text-[11px] text-slate-800 cursor-pointer"
            >
              {SKILL_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                handleAddSkill(handfulInput, handfulStatus, () => setHandfulInput(''))
              }
              disabled={!handfulInput.trim()}
              className="px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-800 disabled:bg-slate-300 text-white text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1 shrink-0 font-sans"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* 2. IT Skills Datalist Input */}
        <div className="min-w-0 w-full bg-white p-2.5 rounded-lg border border-emerald-300/80 space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-900">
            <Code className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="truncate">IT Skills Input</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-1.5 min-w-0">
            <div className="relative flex-1 min-w-0">
              <input
                list="it-skills-datalist"
                type="text"
                value={itInput}
                onChange={(e) => setItInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill(itInput, itStatus, () => setItInput(''));
                  }
                }}
                placeholder="Type or select IT skill..."
                className="w-full min-w-0 px-2 py-1 pl-6 rounded border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700 text-xs font-sans"
              />
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
              <datalist id="it-skills-datalist">
                {IT_SKILLS_LIST.map((skill) => (
                  <option key={skill} value={skill} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <select
              value={itStatus}
              onChange={(e) => setItStatus(e.target.value as SkillStatus)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-slate-50 text-[11px] text-slate-800 cursor-pointer"
            >
              {SKILL_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAddSkill(itInput, itStatus, () => setItInput(''))}
              disabled={!itInput.trim()}
              className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1 shrink-0 font-sans"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* 3. Core Engineering Skills Datalist Input */}
        <div className="min-w-0 w-full bg-white p-2.5 rounded-lg border border-cyan-300/80 space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-900">
            <Sparkles className="w-3 h-3 text-cyan-700 shrink-0" />
            <span className="truncate">Core Engineering Input</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-1.5 min-w-0">
            <div className="relative flex-1 min-w-0">
              <input
                list="core-engineering-skills-datalist"
                type="text"
                value={coreInput}
                onChange={(e) => setCoreInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill(coreInput, coreStatus, () => setCoreInput(''));
                  }
                }}
                placeholder="Type or select engineering skill..."
                className="w-full min-w-0 px-2 py-1 pl-6 rounded border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700 text-xs font-sans"
              />
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
              <datalist id="core-engineering-skills-datalist">
                {CORE_ENGINEERING_SKILLS_LIST.map((skill) => (
                  <option key={skill} value={skill} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <select
              value={coreStatus}
              onChange={(e) => setCoreStatus(e.target.value as SkillStatus)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-slate-50 text-[11px] text-slate-800 cursor-pointer"
            >
              {SKILL_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAddSkill(coreInput, coreStatus, () => setCoreInput(''))}
              disabled={!coreInput.trim()}
              className="px-2.5 py-1 rounded bg-cyan-800 hover:bg-cyan-900 disabled:bg-slate-300 text-white text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1 shrink-0 font-sans"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Palette (3 Parts) */}
      <div className="w-full max-w-full min-w-0 p-2 rounded-lg border border-slate-200 bg-slate-50/80 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap gap-1 min-w-0">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    isActive
                      ? 'bg-cyan-800 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {getCategoryIcon(cat)}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-36 min-w-0">
            <input
              type="text"
              placeholder="Filter palette..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-2 py-0.5 rounded border border-slate-300 bg-white text-[10px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700 font-sans"
            />
          </div>
        </div>

        {/* Available Skills Grid */}
        <div className="max-h-28 overflow-y-auto pr-1 flex flex-wrap gap-1">
          {displayedSkills.map((item) => {
            const isSelected = currentSkillsSet.has(item.name.toLowerCase());
            return (
              <button
                key={`${item.category}-${item.name}`}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    handleRemoveSkill(item.name);
                  } else {
                    handleAddSkill(item.name, DEFAULT_SKILL_STATUS);
                  }
                }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-cyan-100 text-cyan-950 border-cyan-400 font-semibold'
                    : 'bg-white hover:bg-cyan-50 text-slate-700 border-slate-200 hover:border-cyan-300'
                }`}
                title={`${item.category} → ${item.subcategory}`}
              >
                {isSelected ? (
                  <Check className="w-2.5 h-2.5 text-cyan-700 shrink-0" />
                ) : (
                  <Plus className="w-2 h-2 text-slate-400 shrink-0" />
                )}
                <span className="truncate max-w-[200px]">{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
