import { useMemo, useState } from 'react';
import type {
  AdminContentItem,
  AdminContentUpsertInput,
  ContentActionType,
  ContentCategory,
  ContentSection,
  ContentStatus,
  DiscoverClickLogItem,
  DiscoverClickSummary
} from '../types/admin';
import type { ContentRolePermissions } from '../utils/contentPolicy';
import {
  applySectionActionPolicy,
  INTERNAL_TARGET_OPTIONS,
  sectionActionFallback,
  sectionActionLocked,
  sectionInternalTargetSuggestion
} from '../utils/contentPolicy';

type ContentCopy = {
  title: string;
  subtitle: string;
  readOnlyHint: string;
  refreshAuto: string;
  uploadImage: string;
  uploadingImage: string;
  newItem: string;
  editItem: string;
  saveCreate: string;
  saveUpdate: string;
  cancelEdit: string;
  filterAll: string;
  statusDraft: string;
  statusPublished: string;
  fieldCategory: string;
  fieldSection: string;
  fieldStatus: string;
  fieldPinned: string;
  fieldPriority: string;
  fieldSourceName: string;
  fieldSourceUrl: string;
  fieldImageUrl: string;
  fieldCtaUrl: string;
  fieldActionType: string;
  fieldInternalTarget: string;
  actionTypeLabel: Record<ContentActionType, string>;
  fieldTags: string;
  fieldStartsAt: string;
  fieldEndsAt: string;
  fieldPublishedAt: string;
  fieldSchedule: string;
  scheduleScheduled: string;
  scheduleExpiring: string;
  scheduleExpired: string;
  fieldTitleKo: string;
  fieldTitleEn: string;
  fieldTitleZh: string;
  fieldSummaryKo: string;
  fieldSummaryEn: string;
  fieldSummaryZh: string;
  fieldCtaKo: string;
  fieldCtaEn: string;
  fieldCtaZh: string;
  listTitle: string;
  listEmpty: string;
  clickLogTitle: string;
  clickLogEmpty: string;
  clickSummaryTotal: string;
  clickSummarySuccess: string;
  clickSummaryWindow: string;
  clickSummaryTop: string;
  edit: string;
  remove: string;
  publish: string;
  draft: string;
  manual: string;
  auto: string;
  categoryLabel: Record<ContentCategory, string>;
  sectionLabel: Record<ContentSection, string>;
};

type Props = {
  items: AdminContentItem[];
  clickLogs: DiscoverClickLogItem[];
  clickSummary: DiscoverClickSummary | null;
  permissions: ContentRolePermissions;
  copy: ContentCopy;
  onCreate: (payload: AdminContentUpsertInput) => Promise<void>;
  onUpdate: (id: string, payload: Partial<AdminContentUpsertInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefreshAuto: () => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
};

const categoryOrder: ContentCategory[] = ['featured', 'market', 'dex', 'lending', 'yield', 'solana', 'social', 'games'];
const sectionOrder: ContentSection[] = ['feature', 'earn', 'dapps', 'watchlist', 'sites', 'latest'];

const initialDraft = (): AdminContentUpsertInput => ({
  status: 'draft',
  category: 'featured',
  section: 'feature',
  pinned: false,
  priority: 40,
  title: { ko: '', en: '', zh: '' },
  summary: { ko: '', en: '', zh: '' },
  sourceName: '',
  sourceUrl: '',
  imageUrl: '',
  ctaLabel: { ko: '', en: '', zh: '' },
  ctaUrl: '',
  actionType: 'external',
  internalTarget: '',
  tags: [],
  startsAt: null,
  endsAt: null,
  publishedAt: null
});

const itemToDraft = (item: AdminContentItem): AdminContentUpsertInput => ({
  status: item.status,
  category: item.category,
  section: item.section,
  pinned: item.pinned,
  priority: item.priority,
  title: { ...item.title },
  summary: { ...item.summary },
  sourceName: item.sourceName,
  sourceUrl: item.sourceUrl,
  imageUrl: item.imageUrl,
  ctaLabel: { ...item.ctaLabel },
  ctaUrl: item.ctaUrl,
  actionType: item.actionType,
  internalTarget: item.internalTarget,
  tags: [...item.tags],
  startsAt: item.startsAt,
  endsAt: item.endsAt,
  publishedAt: item.publishedAt
});

const toInputDateTimeValue = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const fromInputDateTimeValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

const ensureRequired = (draft: AdminContentUpsertInput) => {
  const koTitle = draft.title.ko.trim();
  const enTitle = draft.title.en.trim();
  const zhTitle = draft.title.zh.trim();
  if (!koTitle && !enTitle && !zhTitle) {
    throw new Error('제목(ko/en/zh) 중 최소 1개는 필요합니다.');
  }
};

const scheduleState = (item: AdminContentItem): Array<'scheduled' | 'expiring' | 'expired'> => {
  const now = Date.now();
  const flags: Array<'scheduled' | 'expiring' | 'expired'> = [];
  if (item.startsAt && Date.parse(item.startsAt) > now) flags.push('scheduled');
  if (item.endsAt) {
    const endsTs = Date.parse(item.endsAt);
    if (Number.isFinite(endsTs)) {
      if (endsTs < now) flags.push('expired');
      else if (endsTs - now <= 48 * 60 * 60 * 1000) flags.push('expiring');
    }
  }
  return flags;
};

export const ContentPage = ({
  items,
  clickLogs,
  clickSummary,
  permissions,
  copy,
  onCreate,
  onUpdate,
  onDelete,
  onRefreshAuto,
  onUploadImage
}: Props) => {
  const [draft, setDraft] = useState<AdminContentUpsertInput>(() => initialDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ContentStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ContentCategory>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | ContentSection>('all');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const effectiveActionType: ContentActionType = sectionActionLocked.has(draft.section) ? sectionActionFallback[draft.section] : draft.actionType;

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => item.kind === 'manual')
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) => (categoryFilter === 'all' ? true : item.category === categoryFilter))
      .filter((item) => (sectionFilter === 'all' ? true : item.section === sectionFilter))
      .filter((item) => {
        if (!normalizedQuery) return true;
        const haystack = [
          item.title.ko,
          item.title.en,
          item.title.zh,
          item.summary.ko,
          item.summary.en,
          item.summary.zh,
          item.sourceName
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [items, statusFilter, categoryFilter, sectionFilter, query]);

  const manualCount = useMemo(() => items.filter((item) => item.kind === 'manual').length, [items]);
  const autoCount = useMemo(() => items.filter((item) => item.kind === 'auto').length, [items]);
  const successRate = clickSummary && clickSummary.totalClicks > 0 ? Math.round((clickSummary.successClicks / clickSummary.totalClicks) * 100) : 0;

  const handleCreateOrUpdate = async () => {
    if (!permissions.canWrite) return;
    setSaving(true);
    try {
      ensureRequired(draft);
      const payload: AdminContentUpsertInput = {
        ...draft,
        actionType: effectiveActionType,
        internalTarget: effectiveActionType === 'internal' ? draft.internalTarget : ''
      };
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      setEditingId(null);
      setDraft(initialDraft());
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: AdminContentItem) => {
    if (!permissions.canWrite) return;
    setEditingId(item.id);
    setDraft(itemToDraft(item));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraft(initialDraft());
  };

  const handleImageFileChange = async (file?: File | null) => {
    if (!file || !permissions.canUpload) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      setDraft((prev) => ({ ...prev, imageUrl: url }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="panel content-panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h3>{copy.title}</h3>
          <p className="meta">{copy.subtitle}</p>
          {!permissions.canWrite ? <p className="meta">{copy.readOnlyHint}</p> : null}
        </div>
        <div className="filter-wrap">
          <button className="ghost-btn" onClick={onRefreshAuto} disabled={saving || !permissions.canRefresh}>
            {copy.refreshAuto}
          </button>
        </div>
      </div>

      <div className="content-counters">
        <span className="badge status-approved">
          {copy.manual}: {manualCount}
        </span>
        <span className="badge status-review">
          {copy.auto}: {autoCount}
        </span>
      </div>

      <div className="content-form-grid">
        <label>
          <span>{copy.fieldCategory}</span>
          <select
            value={draft.category}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value as ContentCategory }))}
          >
            {categoryOrder.map((category) => (
              <option key={`cat-opt-${category}`} value={category}>
                {copy.categoryLabel[category]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.fieldSection}</span>
          <select
            value={draft.section}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => applySectionActionPolicy(event.target.value as ContentSection, prev))}
          >
            {sectionOrder.map((section) => (
              <option key={`section-opt-${section}`} value={section}>
                {copy.sectionLabel[section]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.fieldStatus}</span>
          <select
            value={draft.status}
            disabled={!permissions.canWrite || !permissions.canPublish}
            onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value as ContentStatus }))}
          >
            <option value="draft">{copy.statusDraft}</option>
            <option value="published">{copy.statusPublished}</option>
          </select>
        </label>
        <label>
          <span>{copy.fieldPinned}</span>
          <select
            value={draft.pinned ? 'true' : 'false'}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, pinned: event.target.value === 'true' }))}
          >
            <option value="false">OFF</option>
            <option value="true">ON</option>
          </select>
        </label>
        <label>
          <span>{copy.fieldActionType}</span>
          <select
            value={effectiveActionType}
            disabled={!permissions.canWrite || sectionActionLocked.has(draft.section)}
            onChange={(event) =>
              setDraft((prev) => {
                const nextAction = sectionActionLocked.has(prev.section) ? sectionActionFallback[prev.section] : (event.target.value as ContentActionType);
                return {
                  ...prev,
                  actionType: nextAction,
                  internalTarget:
                    nextAction === 'internal'
                      ? prev.internalTarget || sectionInternalTargetSuggestion[prev.section]
                      : ''
                };
              })
            }
          >
            <option value="external">{copy.actionTypeLabel.external}</option>
            <option value="internal">{copy.actionTypeLabel.internal}</option>
            <option value="none">{copy.actionTypeLabel.none}</option>
          </select>
        </label>
      </div>
      <p className="meta">{`${copy.sectionLabel[draft.section]} → ${copy.actionTypeLabel[sectionActionLocked.has(draft.section) ? sectionActionFallback[draft.section] : effectiveActionType]}`}</p>

      <div className="content-form-grid">
        <label>
          <span>{copy.fieldTitleKo}</span>
          <input
            value={draft.title.ko}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: { ...prev.title, ko: event.target.value } }))}
          />
        </label>
        <label>
          <span>{copy.fieldTitleEn}</span>
          <input
            value={draft.title.en}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: { ...prev.title, en: event.target.value } }))}
          />
        </label>
        <label>
          <span>{copy.fieldTitleZh}</span>
          <input
            value={draft.title.zh}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: { ...prev.title, zh: event.target.value } }))}
          />
        </label>
      </div>

      <div className="content-form-grid">
        <label>
          <span>{copy.fieldSummaryKo}</span>
          <textarea
            value={draft.summary.ko}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, summary: { ...prev.summary, ko: event.target.value } }))}
          />
        </label>
        <label>
          <span>{copy.fieldSummaryEn}</span>
          <textarea
            value={draft.summary.en}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, summary: { ...prev.summary, en: event.target.value } }))}
          />
        </label>
        <label>
          <span>{copy.fieldSummaryZh}</span>
          <textarea
            value={draft.summary.zh}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, summary: { ...prev.summary, zh: event.target.value } }))}
          />
        </label>
      </div>

      <div className="content-form-grid">
        <label>
          <span>{copy.fieldSourceName}</span>
          <input value={draft.sourceName} disabled={!permissions.canWrite} onChange={(event) => setDraft((prev) => ({ ...prev, sourceName: event.target.value }))} />
        </label>
        <label>
          <span>{copy.fieldSourceUrl}</span>
          <input value={draft.sourceUrl} disabled={!permissions.canWrite} onChange={(event) => setDraft((prev) => ({ ...prev, sourceUrl: event.target.value }))} />
        </label>
        <label>
          <span>{copy.fieldImageUrl}</span>
          <input value={draft.imageUrl} disabled={!permissions.canWrite} onChange={(event) => setDraft((prev) => ({ ...prev, imageUrl: event.target.value }))} />
        </label>
        <label>
          <span>{copy.uploadImage}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!permissions.canUpload || uploading}
            onChange={(event) => {
              void handleImageFileChange(event.target.files?.[0] ?? null);
              event.currentTarget.value = '';
            }}
          />
          {uploading ? <span className="meta">{copy.uploadingImage}</span> : null}
        </label>
      </div>

      <div className="content-form-grid">
        <label>
          <span>{copy.fieldCtaKo}</span>
          <input
            value={draft.ctaLabel.ko}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, ctaLabel: { ...prev.ctaLabel, ko: event.target.value } }))}
          />
        </label>
        <label>
          <span>{copy.fieldCtaEn}</span>
          <input
            value={draft.ctaLabel.en}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, ctaLabel: { ...prev.ctaLabel, en: event.target.value } }))}
          />
        </label>
        <label>
          <span>{copy.fieldCtaZh}</span>
          <input
            value={draft.ctaLabel.zh}
            disabled={!permissions.canWrite}
            onChange={(event) => setDraft((prev) => ({ ...prev, ctaLabel: { ...prev.ctaLabel, zh: event.target.value } }))}
          />
        </label>
      </div>

      <div className="content-form-grid">
        <label>
          <span>{copy.fieldCtaUrl}</span>
          <input value={draft.ctaUrl} disabled={!permissions.canWrite} onChange={(event) => setDraft((prev) => ({ ...prev, ctaUrl: event.target.value }))} />
        </label>
        <label>
          <span>{copy.fieldInternalTarget}</span>
          <select
            value={draft.internalTarget}
            disabled={!permissions.canWrite || effectiveActionType !== 'internal'}
            onChange={(event) => setDraft((prev) => ({ ...prev, internalTarget: event.target.value }))}
          >
            <option value="">{sectionInternalTargetSuggestion[draft.section] || '-'}</option>
            {INTERNAL_TARGET_OPTIONS.map((option) => (
              <option key={`internal-target-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.fieldTags}</span>
          <input
            value={draft.tags.join(', ')}
            disabled={!permissions.canWrite}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                tags: event.target.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean)
              }))
            }
          />
        </label>
      </div>

      <div className="content-form-grid">
        <label>
          <span>{copy.fieldPublishedAt}</span>
          <input
            type="datetime-local"
            disabled={!permissions.canWrite || !permissions.canPublish}
            value={toInputDateTimeValue(draft.publishedAt)}
            onChange={(event) => setDraft((prev) => ({ ...prev, publishedAt: fromInputDateTimeValue(event.target.value) }))}
          />
        </label>
        <label>
          <span>{copy.fieldStartsAt}</span>
          <input
            type="datetime-local"
            disabled={!permissions.canWrite}
            value={toInputDateTimeValue(draft.startsAt)}
            onChange={(event) => setDraft((prev) => ({ ...prev, startsAt: fromInputDateTimeValue(event.target.value) }))}
          />
        </label>
        <label>
          <span>{copy.fieldEndsAt}</span>
          <input
            type="datetime-local"
            disabled={!permissions.canWrite}
            value={toInputDateTimeValue(draft.endsAt)}
            onChange={(event) => setDraft((prev) => ({ ...prev, endsAt: fromInputDateTimeValue(event.target.value) }))}
          />
        </label>
      </div>

      <div className="content-form-grid">
        <label>
          <span>{copy.fieldPriority}</span>
          <input
            type="number"
            min={0}
            max={100}
            disabled={!permissions.canWrite}
            value={draft.priority}
            onChange={(event) => setDraft((prev) => ({ ...prev, priority: Number(event.target.value) || 0 }))}
          />
        </label>
      </div>

      <div className="content-form-actions">
        <button className="primary-btn" onClick={() => void handleCreateOrUpdate()} disabled={saving || !permissions.canWrite}>
          {editingId ? copy.saveUpdate : copy.saveCreate}
        </button>
        <button className="ghost-btn" onClick={handleCancelEdit} disabled={saving}>
          {editingId ? copy.cancelEdit : copy.newItem}
        </button>
      </div>

      <div className="panel-head" style={{ marginTop: 18 }}>
        <h3>{copy.listTitle}</h3>
        <div className="filter-wrap">
          <button className={statusFilter === 'all' ? 'chip active' : 'chip'} onClick={() => setStatusFilter('all')}>
            {copy.filterAll}
          </button>
          <button className={statusFilter === 'published' ? 'chip active' : 'chip'} onClick={() => setStatusFilter('published')}>
            {copy.statusPublished}
          </button>
          <button className={statusFilter === 'draft' ? 'chip active' : 'chip'} onClick={() => setStatusFilter('draft')}>
            {copy.statusDraft}
          </button>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)}>
            <option value="all">{copy.filterAll}</option>
            {categoryOrder.map((category) => (
              <option key={`filter-cat-${category}`} value={category}>
                {copy.categoryLabel[category]}
              </option>
            ))}
          </select>
          <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value as typeof sectionFilter)}>
            <option value="all">{copy.filterAll}</option>
            {sectionOrder.map((section) => (
              <option key={`filter-section-${section}`} value={section}>
                {copy.sectionLabel[section]}
              </option>
            ))}
          </select>
          <input className="search" placeholder="search..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>

      {!rows.length ? (
        <p className="meta">{copy.listEmpty}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Section</th>
                <th>{copy.fieldActionType}</th>
                <th>{copy.fieldSchedule}</th>
                <th>Status</th>
                <th>Pinned</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const flags = scheduleState(item);
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title.ko || item.title.en || item.title.zh}</strong>
                      <span>{item.summary.ko || item.summary.en || item.summary.zh}</span>
                    </td>
                    <td>{copy.categoryLabel[item.category]}</td>
                    <td>{copy.sectionLabel[item.section]}</td>
                    <td>
                      <strong>{copy.actionTypeLabel[item.actionType]}</strong>
                      {item.internalTarget ? <span>{item.internalTarget}</span> : null}
                    </td>
                    <td>
                      {flags.includes('scheduled') ? <span className="badge status-review">{copy.scheduleScheduled}</span> : null}
                      {flags.includes('expiring') ? <span className="badge status-pending">{copy.scheduleExpiring}</span> : null}
                      {flags.includes('expired') ? <span className="badge status-blocked">{copy.scheduleExpired}</span> : null}
                      {item.startsAt ? <span>start: {new Date(item.startsAt).toLocaleString()}</span> : null}
                      {item.endsAt ? <span>end: {new Date(item.endsAt).toLocaleString()}</span> : null}
                    </td>
                    <td>{item.status === 'published' ? copy.statusPublished : copy.statusDraft}</td>
                    <td>{item.pinned ? 'ON' : 'OFF'}</td>
                    <td>{new Date(item.updatedAt).toLocaleString()}</td>
                    <td>
                      <div className="action-wrap">
                        <button className="ghost-btn tiny" onClick={() => handleEdit(item)} disabled={!permissions.canWrite}>
                          {copy.edit}
                        </button>
                        {permissions.canPublish ? (
                          <button
                            className="ghost-btn tiny"
                            onClick={() =>
                              void onUpdate(item.id, {
                                status: item.status === 'published' ? 'draft' : 'published'
                              })
                            }
                          >
                            {item.status === 'published' ? copy.draft : copy.publish}
                          </button>
                        ) : null}
                        {permissions.canDelete ? (
                          <button className="ghost-btn tiny" onClick={() => void onDelete(item.id)}>
                            {copy.remove}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel" style={{ marginTop: 10 }}>
        <div className="panel-head">
          <h3>{copy.clickLogTitle}</h3>
          {clickSummary ? (
            <p className="meta">
              {copy.clickSummaryWindow}: {clickSummary.windowDays}d
            </p>
          ) : null}
        </div>
        {clickSummary ? (
          <div className="content-counters">
            <span className="badge status-approved">
              {copy.clickSummaryTotal}: {clickSummary.totalClicks}
            </span>
            <span className="badge status-review">
              {copy.clickSummarySuccess}: {clickSummary.successClicks} ({successRate}%)
            </span>
            <span className="badge status-pending">
              {copy.clickSummaryTop}: {clickSummary.topItems[0]?.itemTitle || '-'}
            </span>
          </div>
        ) : null}
        {!clickLogs.length ? (
          <p className="meta">{copy.clickLogEmpty}</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Item</th>
                  <th>Section</th>
                  <th>Action</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {clickLogs.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.clickedAt).toLocaleString()}</td>
                    <td>
                      <strong>{row.itemTitle}</strong>
                      <span>{row.itemId}</span>
                    </td>
                    <td>{row.section}</td>
                    <td>
                      <strong>{row.resolvedActionType}</strong>
                      {row.externalUrl ? <span>{row.externalUrl}</span> : row.internalTarget ? <span>{row.internalTarget}</span> : null}
                    </td>
                    <td>
                      <span className={`badge ${row.success ? 'status-approved' : 'status-blocked'}`}>{row.success ? 'OK' : 'FAIL'}</span>
                      {row.reason ? <span>{row.reason}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
