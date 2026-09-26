import React, { useState } from 'react';
import { Wrench, CheckCircle, Search, Sparkles } from 'lucide-react';
import { TOOLBOX_CATEGORIES, TOOLBOX_ITEMS, ToolItem } from '../data/toolboxData';

export const ToolboxSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = TOOLBOX_ITEMS.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.highlight.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <section id="toolbox" className="py-12 sm:py-18 border-t border-[#b8c6d4] bg-[#dce1e8] font-serif">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-800" />
              <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wider">
                Engineering Stack &amp; Machinery
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-950 tracking-tight mt-1">
              Categorized Software &amp; Machining Toolbox
            </h2>
            <p className="text-base sm:text-lg text-slate-700 mt-1 max-w-2xl leading-relaxed">
              From parametric CAD topologies and non-linear Ansys simulations to 5-axis Haas CNC setups and sub-micron CMM metrology inspection.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tools, materials, G-code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#edf2f8] border border-[#b8c6d4] rounded-xl text-sm font-sans text-slate-900 placeholder-slate-500 focus:outline-none focus:border-cyan-700 focus:bg-white shadow-xs transition-colors"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-[#e2e8f0] rounded-xl border border-[#b8c6d4] overflow-x-auto mb-8 text-sm font-sans">
          <button
            onClick={() => setActiveCategory('All')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeCategory === 'All'
                ? 'bg-slate-900 text-white font-bold shadow'
                : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            All Capabilities ({TOOLBOX_ITEMS.length})
          </button>
          {TOOLBOX_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === cat
                  ? 'bg-slate-900 text-white font-bold shadow'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Toolbox Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-6 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] hover:border-cyan-700 hover:bg-white transition-all flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md group"
            >
              <div>
                {/* Metadata */}
                <div className="flex items-center justify-between text-xs sm:text-sm font-sans text-slate-600 mb-2">
                  <span className="text-cyan-900 font-bold">{item.category}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{item.yoe} YOE</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-emerald-800 font-bold">{item.level}</span>
                  </div>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-950 group-hover:text-cyan-900 transition-colors">
                  {item.name}
                </h3>

                <p className="mt-2 text-sm sm:text-base text-slate-700 leading-relaxed">
                  {item.highlight}
                </p>
              </div>

              {/* Tags */}
              <div className="pt-3 border-t border-[#cbd5e1] flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm font-sans text-slate-600">
                {item.tags.map((tag, tIdx) => (
                  <React.Fragment key={tIdx}>
                    <span className="hover:text-cyan-900 transition-colors font-medium">#{tag}</span>
                    {tIdx < item.tags.length - 1 && <span className="text-slate-400">·</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
