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
  GraduationCap,
  Users,
} from 'lucide-react';
import {
  SKILLS_DATABASE,
  ALL_PREDEFINED_SKILLS,
  SkillCategoryGroup,
  SkillCategoryName,
} from '../data/skillsData';

interface SkillSelectorProps {
  value: string;
  onChange: (newValue: string) => void;
  label?: string;
  required?: boolean;
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  value,
  onChange,
  label = 'Skills & Competencies',
  required = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [inputValue, setInputValue] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Parse comma-separated skills string into a clean array of trimmed skill names
  const currentSkills: string[] = useMemo(() => {
    if (!value) return [];
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [value]);

  // Set of current skill names for O(1) membership check
  const currentSkillsSet = useMemo(() => {
    return new Set(currentSkills.map((s) => s.toLowerCase()));
  }, [currentSkills]);

  // Add a skill
  const handleAddSkill = (skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed) return;
    if (currentSkillsSet.has(trimmed.toLowerCase())) {
      setInputValue('');
      return;
    }

    const updated = [...currentSkills, trimmed];
    onChange(updated.join(', '));
    setInputValue('');
  };

  // Remove a skill
  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = currentSkills.filter(
      (s) => s.toLowerCase() !== skillToRemove.toLowerCase()
    );
    onChange(updated.join(', '));
  };

  // Clear all skills
  const handleClearAll = () => {
    onChange('');
  };

  // Filter skills by category and search filter
  const displayedSkills = useMemo(() => {
    let list: { category: SkillCategoryName; subcategory: string; name: string }[] = [];

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
    'Generate Skills',
    'Educational Skills',
    'Handful Skills',
    'Personal Skills',
    'IT Skills',
  ];

  const getCategoryIcon = (cat: 'All' | SkillCategoryName) => {
    switch (cat) {
      case 'Generate Skills':
        return <Sparkles className="w-3 h-3 text-cyan-300" />;
      case 'Educational Skills':
        return <GraduationCap className="w-3 h-3 text-blue-300" />;
      case 'Handful Skills':
        return <Wrench className="w-3 h-3 text-amber-300" />;
      case 'Personal Skills':
        return <Users className="w-3 h-3 text-purple-300" />;
      case 'IT Skills':
        return <Code className="w-3 h-3 text-emerald-300" />;
      default:
        return <Layers className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <div className="w-full space-y-3 font-sans">
      {/* Label and Clear All */}
      <div className="flex items-center justify-between">
        <label className="block text-xs sm:text-sm font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {currentSkills.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] text-slate-500 hover:text-red-600 font-medium transition-colors cursor-pointer"
          >
            Clear All ({currentSkills.length})
          </button>
        )}
      </div>

      {/* Selected Skills Badges / Chips */}
      <div className="min-h-[46px] p-2.5 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] flex flex-wrap gap-1.5 items-center">
        {currentSkills.length === 0 ? (
          <span className="text-xs text-slate-400 italic">
            No skills selected yet. Select from the categorized dropdown / datalist below or type to add custom skills.
          </span>
        ) : (
          currentSkills.map((skill, index) => (
            <span
              key={`${skill}-${index}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-900 text-white shadow-xs animate-fade-in group"
            >
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="hover:bg-cyan-800 rounded-full p-0.5 transition-colors cursor-pointer text-cyan-200 hover:text-white"
                title={`Remove ${skill}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Search Input with Native HTML5 Datalist */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            list="predefined-skills-datalist"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSkill(inputValue);
              }
            }}
            placeholder="Search or add skill across Generate, Educational, Handful, Personal & IT..."
            className="w-full px-3 py-2 pl-9 rounded-lg border border-[#b8c6d4] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans placeholder:text-slate-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />

          {/* Native HTML5 datalist for instant autocomplete suggestions */}
          <datalist id="predefined-skills-datalist">
            {ALL_PREDEFINED_SKILLS.map((skill) => (
              <option key={skill} value={skill} />
            ))}
          </datalist>
        </div>

        <button
          type="button"
          onClick={() => handleAddSkill(inputValue)}
          disabled={!inputValue.trim()}
          className="px-3.5 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      {/* Category Dropdown & Quick Selector Palette */}
      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/80 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-1">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    isActive
                      ? 'bg-cyan-800 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {getCategoryIcon(cat)}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Search in palette */}
          <div className="relative w-full sm:w-44">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter palette..."
              className="w-full px-2 py-1 pl-6 text-[11px] rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1.5" />
          </div>
        </div>

        {/* Available Skills Grid for One-Click Selection */}
        <div className="max-h-48 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
          {displayedSkills.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic py-2 text-center">
              No skills match your filter. Type above to add a custom skill.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {displayedSkills.slice(0, 48).map((item) => {
                const isSelected = currentSkillsSet.has(item.name.toLowerCase());
                return (
                  <button
                    key={`${item.category}-${item.name}`}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        handleRemoveSkill(item.name);
                      } else {
                        handleAddSkill(item.name);
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-cyan-100 text-cyan-950 border-cyan-400 font-semibold'
                        : 'bg-white hover:bg-cyan-50 text-slate-700 border-slate-200 hover:border-cyan-300'
                    }`}
                    title={`${item.category} → ${item.subcategory}`}
                  >
                    {isSelected ? (
                      <Check className="w-3 h-3 text-cyan-700 shrink-0" />
                    ) : (
                      <Plus className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                    )}
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
