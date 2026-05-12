import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { extractYoutubeId } from '../../lib/utils';
import type { CatalogSearchResult, SongDetail } from '@lyricling/shared';
import { cn } from '../../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (song: SongDetail) => void;
}

type Tab = 'search' | 'upload' | 'youtube' | 'virtual';

export function AddSongDialog({ open, onClose, onCreated }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('search');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [level, setLevel] = useState('');
  const [description, setDescription] = useState('');
  const [lrcText, setLrcText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lrcFile, setLrcFile] = useState<File | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingExternalId, setAddingExternalId] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const reset = () => {
    setTitle('');
    setArtist('');
    setLevel('');
    setDescription('');
    setLrcText('');
    setYoutubeUrl('');
    setAudioFile(null);
    setLrcFile(null);
    setError(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setAddingExternalId(null);
  };

  useEffect(() => {
    if (tab !== 'search') return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearchLoading(true);
    setSearchError(null);
    const handle = setTimeout(async () => {
      try {
        const results = await api.catalog.search(q);
        if (seq !== searchSeq.current) return;
        setSearchResults(results);
      } catch (err) {
        if (seq !== searchSeq.current) return;
        setSearchError(err instanceof Error ? err.message : 'search failed');
        setSearchResults([]);
      } finally {
        if (seq === searchSeq.current) setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [searchQuery, tab]);

  const addFromCatalog = async (item: CatalogSearchResult) => {
    setAddingExternalId(item.externalId);
    setError(null);
    try {
      const song = await api.catalog.add(item.externalId);
      onCreated(song);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to add');
    } finally {
      setAddingExternalId(null);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      let song: SongDetail;
      if (tab === 'search') {
        throw new Error('use search results to add a song');
      } else if (tab === 'youtube') {
        const ytId = extractYoutubeId(youtubeUrl);
        if (!ytId) throw new Error('Invalid YouTube id/url');
        if (!lrcText.trim()) throw new Error('LRC text required');
        song = await api.songs.createYoutube({
          title,
          artist,
          youtubeId: ytId,
          lrc: lrcText,
          level: level || undefined,
          description: description || undefined,
        });
      } else if (tab === 'virtual') {
        if (!lrcText.trim()) throw new Error('LRC text required');
        song = await api.songs.createVirtual({
          title,
          artist,
          lrc: lrcText,
          level: level || undefined,
          description: description || undefined,
        });
      } else {
        const form = new FormData();
        form.set('title', title);
        form.set('artist', artist);
        if (level) form.set('level', level);
        if (description) form.set('description', description);
        if (audioFile) form.set('audio', audioFile);
        if (lrcFile) form.set('lrc', lrcFile);
        else if (lrcText.trim()) form.set('lrc', lrcText);
        else throw new Error('LRC required (file or text)');
        song = await api.songs.createUpload(form);
      }
      onCreated(song);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={t('add.title')} maxWidth="max-w-2xl">
      <div className="mb-4 flex items-center gap-1 rounded-xl bg-bg-soft border border-bg-ring p-1 text-sm">
        {(['search', 'upload', 'youtube', 'virtual'] as Tab[]).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 transition',
              tab === id ? 'bg-bg-panel text-ink shadow-inner' : 'text-ink-muted hover:text-ink',
            )}
          >
            {t(`add.tab.${id}` as any)}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div>
          <Label>{t('catalog.search.label')}</Label>
          <input
            className="input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('catalog.search.placeholder')}
            autoFocus
          />
          <p className="mt-1 text-[11px] text-ink-dim">{t('catalog.search.hint')}</p>

          <div className="mt-3 max-h-[340px] overflow-y-auto rounded-xl border border-bg-ring divide-y divide-bg-ring">
            {searchLoading && (
              <div className="px-3 py-4 text-sm text-ink-dim">{t('common.loading')}</div>
            )}
            {!searchLoading && searchError && (
              <div className="px-3 py-4 text-sm text-rose-400">{searchError}</div>
            )}
            {!searchLoading && !searchError && searchQuery.trim().length < 2 && (
              <div className="px-3 py-4 text-sm text-ink-dim">{t('catalog.search.empty')}</div>
            )}
            {!searchLoading && !searchError && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="px-3 py-4 text-sm text-ink-dim">{t('catalog.search.noResults')}</div>
            )}
            {searchResults.map((r) => (
              <div key={r.externalId} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink truncate">{r.title}</div>
                  <div className="text-xs text-ink-dim truncate">
                    {r.artist}
                    {r.durationMs ? ` · ${formatDuration(r.durationMs)}` : ''}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        'chip',
                        r.hasSyncedLyrics
                          ? 'border-brand/40 text-brand'
                          : 'border-amber-500/40 text-amber-300',
                      )}
                    >
                      {r.hasSyncedLyrics ? t('catalog.synced') : t('catalog.notSynced')}
                    </span>
                  </div>
                </div>
                <button
                  className="btn-primary text-xs px-3 py-1.5"
                  disabled={!r.hasSyncedLyrics || addingExternalId !== null}
                  onClick={() => addFromCatalog(r)}
                >
                  {addingExternalId === r.externalId ? t('common.loading') : t('catalog.add')}
                </button>
              </div>
            ))}
          </div>

          {error && <div className="mt-3 text-sm text-rose-400">{t('add.error', { message: error })}</div>}

          <div className="mt-4 flex items-center justify-end">
            <button className="btn-ghost" onClick={handleClose} disabled={addingExternalId !== null}>
              {t('add.cancel')}
            </button>
          </div>
        </div>
      )}

      {tab !== 'search' && (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>{t('add.field.title')}</Label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>{t('add.field.artist')}</Label>
          <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </div>
        <div>
          <Label>{t('add.field.level')}</Label>
          <input className="input" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="A2" />
        </div>
        <div>
          <Label>{t('add.field.description')}</Label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {tab === 'youtube' && (
        <div className="mt-3">
          <Label>{t('add.field.youtubeId')}</Label>
          <input
            className="input"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtu.be/..."
          />
          <p className="mt-1 text-xs text-ink-dim">{t('add.youtube.help')}</p>
        </div>
      )}

      {tab === 'upload' && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>{t('add.field.audio')}</Label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-brand"
            />
          </div>
          <div>
            <Label>{t('add.field.lrcFile')}</Label>
            <input
              type="file"
              accept=".lrc,text/plain"
              onChange={(e) => setLrcFile(e.target.files?.[0] ?? null)}
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-brand"
            />
          </div>
        </div>
      )}

      {tab === 'virtual' && (
        <p className="mt-3 text-xs text-ink-dim">{t('add.virtual.help')}</p>
      )}

      <div className="mt-4">
        <Label>{t('add.field.lrcText')}</Label>
        <textarea
          className="input min-h-[180px] font-mono text-sm"
          value={lrcText}
          onChange={(e) => setLrcText(e.target.value)}
          placeholder={t('add.lrc.placeholder')}
        />
      </div>

      {error && <div className="mt-3 text-sm text-rose-400">{t('add.error', { message: error })}</div>}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button className="btn-ghost" onClick={handleClose} disabled={submitting}>
          {t('add.cancel')}
        </button>
        <button className="btn-primary" onClick={submit} disabled={submitting || !title || !artist}>
          {submitting ? t('common.loading') : t('add.submit')}
        </button>
      </div>
      </>
      )}
    </Modal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-ink-muted mb-1">{children}</label>;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
