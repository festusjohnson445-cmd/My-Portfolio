import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  RefreshCw,
  Plus,
  Edit3,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Save,
  Eye,
  Copy,
  Check,
} from 'lucide-react';
import { supabase, getAuthenticatedOwnerUid } from '../utils/supabase';

export interface SupabaseTableDescriptor {
  name: string;
  label: string;
  pk: string;
  description: string;
  template: () => Record<string, any>;
}

const SUPABASE_TABLES: SupabaseTableDescriptor[] = [
  {
    name: 'profiles',
    label: 'profiles',
    pk: 'id',
    description: 'Owner bio, avatar, header, credentials & metadata',
    template: () => ({
      id: getAuthenticatedOwnerUid() || crypto.randomUUID(),
      full_name: '',
      header: '',
      avatar_url: '',
      bio: {},
      documents: [],
      updated_at: new Date().toISOString(),
    }),
  },
  {
    name: 'projects',
    label: 'projects',
    pk: 'id',
    description: 'Engineering portfolio projects & media assets',
    template: () => ({
      id: `proj_${Date.now()}`,
      owner_id: getAuthenticatedOwnerUid() || undefined,
      slug: `project-${Date.now()}`,
      title: 'New Engineering Project',
      category: 'Mechanical Design',
      summary: '',
      description: '',
      tools: [],
      featured: false,
      likes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  },
  {
    name: 'articles',
    label: 'articles',
    pk: 'id',
    description: 'Published & draft technical articles / blog posts',
    template: () => ({
      id: `art_${Date.now()}`,
      owner_id: getAuthenticatedOwnerUid() || undefined,
      slug: `article-${Date.now()}`,
      title: 'New Technical Article',
      category: 'Mechanical Systems',
      summary: '',
      content: '',
      author_name: 'Festus, Olorunsogo Johnson',
      status: 'published',
      featured: false,
      likes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  },
  {
    name: 'article_comments',
    label: 'article_comments',
    pk: 'id',
    description: 'Visitor & owner comments and moderation status',
    template: () => ({
      id: `cmt_${Date.now()}`,
      article_id: '',
      author_name: '',
      author_email: '',
      body: '',
      status: 'approved',
      created_at: new Date().toISOString(),
    }),
  },
  {
    name: 'profile_experiences',
    label: 'profile_experiences',
    pk: 'id',
    description: 'Work & leadership experience timeline records',
    template: () => ({
      id: `exp_${Date.now()}`,
      owner_id: getAuthenticatedOwnerUid() || undefined,
      role_title: '',
      organization: '',
      location: '',
      start_date: '',
      end_date: '',
      is_current: false,
      summary: '',
      highlights: [],
    }),
  },
  {
    name: 'profile_publications',
    label: 'profile_publications',
    pk: 'id',
    description: 'Research papers, journals & whitepapers',
    template: () => ({
      id: `pub_${Date.now()}`,
      owner_id: getAuthenticatedOwnerUid() || undefined,
      title: '',
      venue_or_journal: '',
      year: String(new Date().getFullYear()),
      authors: '',
      doi_or_url: '',
      abstract: '',
      category: 'Journal Article',
    }),
  },
  {
    name: 'profile_achievements',
    label: 'profile_achievements',
    pk: 'id',
    description: 'Awards, honors, licenses & verified achievements',
    template: () => ({
      id: `ach_${Date.now()}`,
      owner_id: getAuthenticatedOwnerUid() || undefined,
      title: '',
      issuer: '',
      date_str: String(new Date().getFullYear()),
      category: 'Award',
      description: '',
      verified: true,
    }),
  },
  {
    name: 'website_settings',
    label: 'website_settings',
    pk: 'id',
    description: 'Global theme, appearance, footer & moderation rules',
    template: () => ({
      id: 'global',
      allow_visitor_articles: true,
      require_article_approval: false,
      require_comment_approval: false,
      updated_at: new Date().toISOString(),
    }),
  },
  {
    name: 'media_assets',
    label: 'media_assets',
    pk: 'id',
    description: 'Optimized image & video metadata records',
    template: () => ({
      id: `ma_${Date.now()}`,
      bucket: 'projects',
      storage_path: '',
      media_type: 'image',
      file_name: '',
      primary_url: '',
      status: 'completed',
      created_at: new Date().toISOString(),
    }),
  },
  {
    name: 'materials',
    label: 'materials',
    pk: 'id',
    description: 'Uploaded credential & reference documents',
    template: () => ({
      id: `mat_${Date.now()}`,
      title: '',
      category: 'Credential',
      file_url: '',
      created_at: new Date().toISOString(),
    }),
  },
  {
    name: 'conversations',
    label: 'conversations',
    pk: 'id',
    description: 'Visitor inquiry & direct chat threads',
    template: () => ({
      id: `conv_${Date.now()}`,
      visitor_name: '',
      visitor_email: '',
      subject: '',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  },
  {
    name: 'messages',
    label: 'messages',
    pk: 'id',
    description: 'Individual messages inside inquiry threads',
    template: () => ({
      id: `msg_${Date.now()}`,
      conversation_id: '',
      sender_role: 'owner',
      content: '',
      created_at: new Date().toISOString(),
    }),
  },
  {
    name: 'visitor_profiles',
    label: 'visitor_profiles',
    pk: 'visitor_id',
    description: 'Visitor preferences & bookmarks (saved projects/articles)',
    template: () => ({
      visitor_id: `visitor_${Date.now()}`,
      display_name: '',
      email: '',
      liked_projects: [],
      liked_articles: [],
      updated_at: new Date().toISOString(),
    }),
  },
];

interface SupabaseDatabaseManagerProps {
  onTableMutated?: (tableName: string) => void;
}

function summarizeValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val.length > 72 ? `${val.slice(0, 72)}…` : val;
  if (Array.isArray(val)) return `[${val.length} item${val.length === 1 ? '' : 's'}]`;
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''}}`;
  }
  return String(val);
}

function pickPreviewColumns(rows: Record<string, any>[], pk: string): string[] {
  if (!rows.length) return [pk];
  const preferred = [
    pk,
    'title',
    'full_name',
    'role_title',
    'file_name',
    'author_name',
    'visitor_name',
    'display_name',
    'email',
    'category',
    'status',
    'bucket',
    'media_type',
    'organization',
    'venue_or_journal',
    'issuer',
    'subject',
    'updated_at',
    'created_at',
  ];
  const availableKeys = Array.from(new Set(rows.slice(0, 10).flatMap((r) => Object.keys(r))));
  const chosen: string[] = [];
  for (const k of preferred) {
    if (availableKeys.includes(k) && !chosen.includes(k)) {
      chosen.push(k);
    }
    if (chosen.length >= 5) break;
  }
  for (const k of availableKeys) {
    if (chosen.length >= 5) break;
    if (!chosen.includes(k)) chosen.push(k);
  }
  return chosen;
}

export const SupabaseDatabaseManager: React.FC<SupabaseDatabaseManagerProps> = ({
  onTableMutated,
}) => {
  const [selectedTable, setSelectedTable] = useState<string>('profiles');
  const [rowsByTable, setRowsByTable] = useState<Record<string, Record<string, any>[]>>({});
  const [countsByTable, setCountsByTable] = useState<Record<string, number | null>>({});
  const [errorsByTable, setErrorsByTable] = useState<Record<string, string | null>>({});
  const [loadingTable, setLoadingTable] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusNotice, setStatusNotice] = useState<{ text: string; isError?: boolean } | null>(
    null
  );

  // Modal state for Inspect / Edit / Insert
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [editingRowPkVal, setEditingRowPkVal] = useState<any>(null);
  const [editorJson, setEditorJson] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);
  const [confirmDeletePk, setConfirmDeletePk] = useState<any>(null);
  const [deletingPk, setDeletingPk] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tableDescriptor = useMemo(
    () => SUPABASE_TABLES.find((t) => t.name === selectedTable) || SUPABASE_TABLES[0],
    [selectedTable]
  );

  const showNotice = (text: string, isError = false) => {
    setStatusNotice({ text, isError });
    setTimeout(() => setStatusNotice(null), 5000);
  };

  const fetchTableRows = useCallback(async (tableName: string, silent = false) => {
    if (!silent) setLoadingTable(tableName);
    try {
      // Try ordering by updated_at / created_at if column exists, else raw select
      let res = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .limit(200);

      if (res.error && /column .*updated_at.* does not exist/i.test(res.error.message || '')) {
        res = await supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(200);
      }
      if (res.error && /column .*created_at.* does not exist/i.test(res.error.message || '')) {
        res = await supabase.from(tableName).select('*', { count: 'exact' }).limit(200);
      }

      if (res.error) {
        setErrorsByTable((prev) => ({
          ...prev,
          [tableName]: res.error?.message || 'Unable to query table.',
        }));
        setRowsByTable((prev) => ({ ...prev, [tableName]: prev[tableName] || [] }));
        return;
      }

      const data = Array.isArray(res.data) ? res.data : [];
      setRowsByTable((prev) => ({ ...prev, [tableName]: data }));
      setCountsByTable((prev) => ({
        ...prev,
        [tableName]: typeof res.count === 'number' ? res.count : data.length,
      }));
      setErrorsByTable((prev) => ({ ...prev, [tableName]: null }));
    } catch (err: any) {
      setErrorsByTable((prev) => ({
        ...prev,
        [tableName]: err?.message || 'Unexpected database error.',
      }));
    } finally {
      if (!silent) setLoadingTable(null);
    }
  }, []);

  const fetchAllTables = useCallback(async () => {
    setLoadingAll(true);
    try {
      await Promise.all(SUPABASE_TABLES.map((t) => fetchTableRows(t.name, true)));
      showNotice('Fetched live data from all Supabase tables.');
    } finally {
      setLoadingAll(false);
    }
  }, [fetchTableRows]);

  useEffect(() => {
    void fetchAllTables();
  }, [fetchAllTables]);

  const activeRows = rowsByTable[selectedTable] || [];
  const activeError = errorsByTable[selectedTable] || null;

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter((row) => {
      try {
        return JSON.stringify(row).toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  }, [activeRows, searchQuery]);

  const previewColumns = useMemo(
    () => pickPreviewColumns(activeRows, tableDescriptor.pk),
    [activeRows, tableDescriptor.pk]
  );

  const openCreateModal = () => {
    const templateObj = tableDescriptor.template();
    setEditorMode('create');
    setEditingRowPkVal(null);
    setEditorJson(JSON.stringify(templateObj, null, 2));
  };

  const openEditModal = (row: Record<string, any>, mode: 'edit' | 'view') => {
    setEditorMode(mode);
    setEditingRowPkVal(row[tableDescriptor.pk]);
    setEditorJson(JSON.stringify(row, null, 2));
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editorMode === 'view') {
      setEditorMode(null);
      return;
    }

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(editorJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        showNotice('Record JSON must be a valid JSON object.', true);
        return;
      }
    } catch (parseErr: any) {
      showNotice(`Invalid JSON: ${parseErr?.message || 'Check syntax.'}`, true);
      return;
    }

    setSavingRecord(true);
    try {
      if (editorMode === 'create') {
        const { error } = await supabase.from(selectedTable).insert(parsed);
        if (error) throw new Error(error.message);
        showNotice(`Inserted new record into "${selectedTable}".`);
      } else if (editorMode === 'edit') {
        const pkCol = tableDescriptor.pk;
        const pkVal = editingRowPkVal ?? parsed[pkCol];
        if (pkVal === undefined || pkVal === null || pkVal === '') {
          throw new Error(`Missing primary key "${pkCol}" for update.`);
        }
        const updateBody = { ...parsed };
        delete updateBody[pkCol];
        const { error } = await supabase
          .from(selectedTable)
          .update(updateBody)
          .eq(pkCol, pkVal);
        if (error) throw new Error(error.message);
        showNotice(`Updated record (${pkVal}) in "${selectedTable}".`);
      }

      setEditorMode(null);
      await fetchTableRows(selectedTable);
      onTableMutated?.(selectedTable);
    } catch (err: any) {
      showNotice(err?.message || `Failed to save record in "${selectedTable}".`, true);
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDeleteRecord = async (pkVal: any) => {
    const pkCol = tableDescriptor.pk;
    setDeletingPk(pkVal);
    try {
      const { error } = await supabase.from(selectedTable).delete().eq(pkCol, pkVal);
      if (error) throw new Error(error.message);
      setConfirmDeletePk(null);
      showNotice(`Deleted record (${pkVal}) from "${selectedTable}".`);
      await fetchTableRows(selectedTable);
      onTableMutated?.(selectedTable);
    } catch (err: any) {
      showNotice(err?.message || `Failed to delete record from "${selectedTable}".`, true);
    } finally {
      setDeletingPk(null);
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-4 h-4 text-cyan-800 shrink-0" />
          <div>
            <h4 className="font-bold text-slate-950 text-xs sm:text-sm">
              Supabase Database Tables &amp; Live Record Manager
            </h4>
            <p className="text-[11px] text-slate-600">
              Directly view, insert, update, and delete rows across your connected Supabase PostgreSQL tables.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchAllTables}
          disabled={loadingAll}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-[11px] font-semibold cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingAll ? 'animate-spin' : ''}`} />
          <span>{loadingAll ? 'Syncing Tables...' : 'Refresh All Tables'}</span>
        </button>
      </div>

      {statusNotice && (
        <div
          className={`px-3 py-2 rounded-lg border text-[11px] font-semibold flex items-center gap-2 ${
            statusNotice.isError
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          {statusNotice.isError ? (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="flex-1 break-words">{statusNotice.text}</span>
        </div>
      )}

      {/* Tables Grid Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
        {SUPABASE_TABLES.map((tbl) => {
          const isSelected = selectedTable === tbl.name;
          const count = countsByTable[tbl.name];
          const hasErr = Boolean(errorsByTable[tbl.name]);
          return (
            <button
              key={tbl.name}
              type="button"
              onClick={() => {
                setSelectedTable(tbl.name);
                setConfirmDeletePk(null);
                setSearchQuery('');
              }}
              className={`px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-0.5 min-w-0 ${
                isSelected
                  ? 'bg-cyan-900 text-white border-cyan-950 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-300 hover:border-cyan-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className="font-mono font-bold text-[11px] truncate">{tbl.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold shrink-0 ${
                    hasErr
                      ? isSelected
                        ? 'bg-rose-500 text-white'
                        : 'bg-rose-100 text-rose-800'
                      : isSelected
                      ? 'bg-cyan-700 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {hasErr ? 'ERR' : count === null || count === undefined ? '—' : count}
                </span>
              </div>
              <span
                className={`text-[9.5px] truncate ${
                  isSelected ? 'text-cyan-100' : 'text-slate-500'
                }`}
              >
                PK: {tbl.pk}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Table Controls */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-950 text-xs sm:text-sm">
                {tableDescriptor.name}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-semibold text-slate-700">
                {filteredRows.length} {filteredRows.length === 1 ? 'row' : 'rows'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">{tableDescriptor.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fetchTableRows(selectedTable)}
              disabled={loadingTable === selectedTable}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-semibold cursor-pointer"
            >
              <RefreshCw
                className={`w-3 h-3 ${loadingTable === selectedTable ? 'animate-spin' : ''}`}
              />
              <span>Reload</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-[11px] font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Insert Row</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${selectedTable} records by any field or ID...`}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-700"
          />
        </div>

        {/* Table Error State */}
        {activeError && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Could not query "{selectedTable}"</div>
              <div className="break-words">{activeError}</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loadingTable === selectedTable ? (
          <div className="py-8 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-800" />
            <span>Fetching rows from {selectedTable}...</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-6 text-center text-slate-500 italic">
            {activeRows.length === 0
              ? `No records currently stored in "${selectedTable}".`
              : 'No matching rows for your search filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                  {previewColumns.map((col) => (
                    <th key={col} className="px-2.5 py-2 font-bold font-mono whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="px-2.5 py-2 font-bold text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRows.map((row, idx) => {
                  const pkVal = row[tableDescriptor.pk];
                  const rowKey = pkVal !== undefined && pkVal !== null ? String(pkVal) : `row_${idx}`;
                  const isConfirming = confirmDeletePk === pkVal && pkVal !== undefined;
                  return (
                    <tr key={rowKey} className="hover:bg-slate-50/80 transition-colors">
                      {previewColumns.map((col) => (
                        <td
                          key={col}
                          className="px-2.5 py-2 text-slate-800 max-w-[200px] truncate font-sans"
                          title={
                            typeof row[col] === 'object'
                              ? JSON.stringify(row[col])
                              : String(row[col] ?? '')
                          }
                        >
                          {col === tableDescriptor.pk ? (
                            <span className="font-mono font-semibold text-cyan-900">
                              {summarizeValue(row[col])}
                            </span>
                          ) : (
                            summarizeValue(row[col])
                          )}
                        </td>
                      ))}
                      <td className="px-2.5 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(row, 'view')}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            title="Inspect JSON"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(row, 'edit')}
                            className="p-1 rounded bg-cyan-50 hover:bg-cyan-100 text-cyan-900 cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                disabled={deletingPk === pkVal}
                                onClick={() => handleDeleteRecord(pkVal)}
                                className="px-1.5 py-0.5 rounded bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-bold cursor-pointer"
                              >
                                {deletingPk === pkVal ? '...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePk(null)}
                                className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePk(pkVal)}
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Create / Edit / Inspect Modal */}
      {editorMode && (
        <div
          className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => !savingRecord && setEditorMode(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl border border-slate-300 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold truncate">
                  {editorMode === 'create'
                    ? `Insert Row → ${selectedTable}`
                    : editorMode === 'edit'
                    ? `Update Row (${editingRowPkVal}) → ${selectedTable}`
                    : `Inspect Record (${editingRowPkVal}) → ${selectedTable}`}
                </h3>
                <p className="text-[10px] text-slate-300">
                  Primary Key: {tableDescriptor.pk} · Direct Supabase PostgreSQL operation
                </p>
              </div>
              <button
                type="button"
                onClick={() => !savingRecord && setEditorMode(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-700">
                  {editorMode === 'view'
                    ? 'Read-only JSON representation'
                    : 'Edit JSON fields carefully (valid JSON object required)'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(editorJson);
                    setCopiedId('modal');
                    setTimeout(() => setCopiedId(null), 1500);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-semibold cursor-pointer"
                >
                  {copiedId === 'modal' ? (
                    <Check className="w-3 h-3 text-emerald-700" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedId === 'modal' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              <textarea
                rows={14}
                readOnly={editorMode === 'view'}
                value={editorJson}
                onChange={(e) => setEditorJson(e.target.value)}
                spellCheck={false}
                className="w-full p-3 rounded-xl border border-slate-300 bg-slate-950 text-emerald-300 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-700"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  disabled={savingRecord}
                  onClick={() => setEditorMode(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  {editorMode === 'view' ? 'Close' : 'Cancel'}
                </button>
                {editorMode === 'view' && (
                  <button
                    type="button"
                    onClick={() => setEditorMode('edit')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Switch to Edit</span>
                  </button>
                )}
                {editorMode !== 'view' && (
                  <button
                    type="submit"
                    disabled={savingRecord}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                  >
                    {savingRecord ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {savingRecord
                        ? 'Saving...'
                        : editorMode === 'create'
                        ? 'Insert into Supabase'
                        : 'Save Changes'}
                    </span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
