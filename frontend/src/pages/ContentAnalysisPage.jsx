import { useState, useEffect, useRef } from 'react';
import {
  BarChart3, TrendingUp, Target, Rocket, FileText, Lightbulb,
  ChevronDown, ChevronUp, BookmarkPlus, Trash2, Upload, Sparkles, X,
  Eye, Clock, Zap, Trophy, ArrowUpDown, Filter,
} from 'lucide-react';
import api from '../services/api';
import './ContentAnalysisPage.css';

/* ─── Helpers ─────────────────────────────── */
const parseCtr = (val) => {
  if (val == null) return null;
  const n = parseFloat(String(val).replace('%', ''));
  return isNaN(n) ? null : n;
};

const ctrColor = (ctr) => {
  if (ctr == null) return 'var(--color-text-muted)';
  if (ctr >= 6) return 'var(--color-success)';
  if (ctr >= 3) return 'var(--color-warning)';
  return 'var(--color-error)';
};

const ctrLabel = (ctr) => {
  if (ctr == null) return null;
  if (ctr >= 6) return 'strong';
  if (ctr >= 3) return 'fair';
  return 'low';
};

const fmtNum = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const thumbUrl = (videoId) =>
  videoId ? `https://img.youtube.com/vi/${videoId.trim()}/0.jpg` : null;

/* ─── Component ───────────────────────────── */
export default function ContentAnalysisPage() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAnalyses, setExpandedAnalyses] = useState({});
  const [expandedCards, setExpandedCards] = useState({});

  // CSV upload
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef(null);

  // Sort/Filter
  const [sortMode, setSortMode] = useState('default');
  const [showLowOnly, setShowLowOnly] = useState(false);

  useEffect(() => { loadAnalyses(); }, []);

  const loadAnalyses = async () => {
    try {
      const data = await api.getAnalyses();
      setAnalyses(data);
      if (data.length > 0) setExpandedAnalyses({ [data[0].id]: true });
    } catch (err) {
      console.error('Failed to load analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ─── CSV Logic ─── */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setCsvError('Please select a CSV file'); setCsvFile(null); return; }
    if (file.size > 10 * 1024 * 1024) { setCsvError('File size must be under 10MB'); setCsvFile(null); return; }
    setCsvError(''); setCsvFile(file);
  };

  const handleCsvUpload = async () => {
    if (!csvFile) { setCsvError('Please select a CSV file'); return; }
    setCsvUploading(true); setCsvError('');
    try {
      await api.uploadCsvIdea(csvFile);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      const refreshed = await api.getAnalyses();
      setAnalyses(refreshed);
      if (refreshed.length > 0) setExpandedAnalyses(prev => ({ ...prev, [refreshed[0].id]: true }));
    } catch (err) { setCsvError(err.message || 'Failed to process CSV'); }
    finally { setCsvUploading(false); }
  };

  const toggleAnalysis = (id) => setExpandedAnalyses(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleCard = (key) => setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));

  const handleBookmarkIdea = async (title, description, context) => {
    try {
      await api.createIdea({ title, description: description + (context ? '\n\nContext: ' + context : ''), tags: 'AI-Generated' });
      alert('Idea bookmarked to your Ideas board!');
    } catch (err) { alert('Failed to bookmark: ' + err.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this analysis?')) return;
    try { await api.deleteIdea(id); loadAnalyses(); }
    catch (err) { alert('Failed to delete: ' + (err.message || 'Unknown error')); }
  };

  const parseAiOutput = (outputData) => {
    if (!outputData) return null;
    if (typeof outputData !== 'string') return outputData;

    let text = outputData.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '');

    // Pass 1 — standard parse
    try { return JSON.parse(text); } catch { /* continue */ }

    // Pass 2 — strip trailing commas + control chars
    try {
      return JSON.parse(
        text.replace(/,\s*([\]}])/g, '$1').replace(/[\u0000-\u001F\u007F]+/g, ' ')
      );
    } catch { /* continue */ }

    // Pass 3 — bracket-counting repair for truncated JSON
    const repaired = _repairTruncated(text);
    if (repaired) return repaired;

    // Pass 4 — extract summary + complete video objects via bracket counting
    return _extractPartial(text);
  };

  /** Repair truncated JSON by trimming incomplete tokens and closing brackets */
  const _repairTruncated = (raw) => {
    const start = raw.indexOf('{');
    if (start < 0) return null;
    let str = raw.substring(start);

    for (let attempt = 0; attempt < 15; attempt++) {
      let inStr = false, esc = false;
      const stack = [];

      for (const ch of str) {
        if (esc) { esc = false; continue; }
        if (ch === '\\' && inStr) { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if ((ch === '}' || ch === ']') && stack.length) stack.pop();
      }

      // Complete & balanced — try parsing directly
      if (stack.length === 0 && !inStr) {
        try { return JSON.parse(str); } catch { return null; }
      }

      // Truncated inside an unclosed string — trim it
      if (inStr) {
        const idx = str.lastIndexOf('"');
        if (idx > 0) {
          str = str.substring(0, idx)
            .replace(/[,:\s]+$/, '')
            .replace(/,?\s*"[^"]*"$/, ''); // remove dangling key
          continue;
        }
        return null;
      }

      // Not in string, has unclosed brackets — close them
      str = str.replace(/[,:\s]+$/, '');
      const closing = [...stack].reverse().join('');
      try {
        const result = JSON.parse(str + closing);
        result._partial = true;
        return result;
      } catch {
        // Trim back to last comma (before partial entry) and retry
        const lastComma = str.lastIndexOf(',');
        if (lastComma > 0) {
          str = str.substring(0, lastComma);
          continue;
        }
        return null;
      }
    }
    return null;
  };

  /** Extract summary + individually complete video objects via bracket counting */
  const _extractPartial = (text) => {
    let summary = null;
    const sMatch = text.match(/"summary"\s*:\s*(\{[^}]+\})/s);
    if (sMatch) { try { summary = JSON.parse(sMatch[1]); } catch { /* skip */ } }

    const videos = [];
    const arrIdx = text.indexOf('"video_analyses"');
    const arrStart = arrIdx >= 0 ? text.indexOf('[', arrIdx) : -1;

    if (arrStart >= 0) {
      let i = arrStart + 1;
      while (i < text.length) {
        // Skip whitespace and commas between array elements
        while (i < text.length && /[\s,]/.test(text[i])) i++;
        if (i >= text.length || text[i] !== '{') break;

        // Extract one object using bracket counting (handles any nesting depth)
        let depth = 0, inStr = false, esc = false;
        const objStart = i;
        let complete = false;
        for (; i < text.length; i++) {
          const ch = text[i];
          if (esc) { esc = false; continue; }
          if (ch === '\\' && inStr) { esc = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) { complete = true; i++; break; }
          }
        }
        if (!complete) break; // truncated mid-object, stop

        try {
          const obj = JSON.parse(text.substring(objStart, i));
          if (obj.original_title || obj.metrics) videos.push(obj);
        } catch { /* skip malformed object */ }
      }
    }

    if (summary || videos.length > 0) {
      return { summary, video_analyses: videos, _partial: true };
    }
    return null;
  };

  /* ─── Field accessor (handles nested metrics OR flat layout) ─── */
  const getVideoMetrics = (video) => {
    let rawId = video.metrics?.video_id ?? video.video_id ?? video.Content ?? null;
    if (rawId && rawId.startsWith('[ID:')) {
      rawId = rawId.replace('[ID:', '').replace(']', '').trim();
    }
    return {
      ctr:       parseCtr(video.metrics?.ctr       ?? video.ctr),
      views:     parseFloat(video.metrics?.views   ?? video.views) || null,
      watchTime: video.metrics?.watch_time_hours != null
        ? video.metrics.watch_time_hours + 'h'
        : (video.metrics?.watch_time ?? video.watch_time ?? null),
      aiScore:   parseFloat(video.metrics?.ai_score ?? video.ai_score ?? video.score) || null,
      videoId:   rawId,
      insight:   video.insight ?? video.metric_insights ?? null,
    };
  };

  /* ─── Metrics Summary — use AI summary when present ─── */
  const computeSummary = (output) => {
    const videos = output.video_analyses || [];
    // Use pre-computed AI summary if available
    if (output.summary) {
      const s = output.summary;
      const avgCtr  = parseCtr(s.average_ctr);
      const bestTitle = s.best_performing_video ?? null;
      const bestIdx = bestTitle
        ? videos.findIndex(v => v.original_title === bestTitle)
        : -1;
      return {
        totalVideos: s.total_videos ?? videos.length,
        avgCtr,
        totalViews: parseFloat(s.total_views) || null,
        bestTitle,
        bestIdx,
      };
    }
    // Fallback — compute from video array
    const ctrs  = videos.map(v => getVideoMetrics(v).ctr).filter(c => c != null);
    const views = videos.map(v => getVideoMetrics(v).views).filter(n => n != null);
    const avgCtr     = ctrs.length  ? ctrs.reduce((a, b) => a + b, 0) / ctrs.length : null;
    const totalViews = views.length ? views.reduce((a, b) => a + b, 0)               : null;
    const bestIdx    = ctrs.length  ? ctrs.indexOf(Math.max(...ctrs))                : -1;
    return { totalVideos: videos.length, avgCtr, totalViews, bestIdx, bestTitle: null };
  };

  /* ─── Sort / Filter Videos ─── */
  const sortVideos = (videos) => {
    let arr = [...videos];
    if (showLowOnly)           arr = arr.filter(v => { const c = getVideoMetrics(v).ctr; return c == null || c < 3; });
    if (sortMode === 'ctr-desc')   arr.sort((a, b) => (getVideoMetrics(b).ctr ?? -1)  - (getVideoMetrics(a).ctr ?? -1));
    else if (sortMode === 'ctr-asc')   arr.sort((a, b) => (getVideoMetrics(a).ctr ?? 999) - (getVideoMetrics(b).ctr ?? 999));
    else if (sortMode === 'views-desc') arr.sort((a, b) => (getVideoMetrics(b).views || 0) - (getVideoMetrics(a).views || 0));
    return arr;
  };

  /* ─── Render Video Grid ─── */
  const renderAnalysisContent = (analysis) => {
    const output = parseAiOutput(analysis.outputData);
    console.log('[ContentAnalysis] Parse result:', output
      ? `${output.video_analyses?.length ?? 0} videos, summary: ${!!output.summary}, partial: ${!!output._partial}`
      : 'FAILED — raw length: ' + analysis.outputData?.length);
    if (!output) return (
      <div className="alert alert-error">
        <p><b>Could not parse AI results.</b> Raw data:</p>
        <div style={{ marginTop: 10, padding: 10, background: 'rgba(0,0,0,0.05)', borderRadius: 4, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>{analysis.outputData}</div>
      </div>
    );

    const videos = output.video_analyses || [];
    const { totalVideos, avgCtr, totalViews, bestIdx, bestTitle } = computeSummary(output);
    const sorted = sortVideos(videos);
    // Find top performer by CTR globally (for badge)
    const allCtrs = videos.map(v => getVideoMetrics(v).ctr);
    const maxCtr = allCtrs.filter(c => c != null).length > 0 ? Math.max(...allCtrs.filter(c => c != null)) : -1;

    return (
      <div className="ca-analysis-content">
        {output._partial && (
          <div className="alert" style={{ background: 'rgba(184, 150, 58, 0.12)', color: 'var(--color-warning)', border: '1px solid rgba(184, 150, 58, 0.25)', marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
            ⚠️ AI response was partially truncated — showing {videos.length} of {totalVideos} videos. Delete this analysis and re-upload for complete results.
          </div>
        )}
        {/* ── Metrics Bar ── */}
        <div className="ca-metrics-bar">
          <div className="ca-metric-card">
            <div className="ca-metric-icon ca-metric-icon--primary">
              <FileText size={18} />
            </div>
            <div className="ca-metric-body">
              <span className="ca-metric-value">{totalVideos}</span>
              <span className="ca-metric-label">Total Videos</span>
            </div>
          </div>
          <div className="ca-metric-card">
            <div className="ca-metric-icon ca-metric-icon--success">
              <TrendingUp size={18} />
            </div>
            <div className="ca-metric-body">
              <span className="ca-metric-value" style={{ color: avgCtr != null ? ctrColor(avgCtr) : undefined }}>
                {avgCtr != null ? avgCtr.toFixed(1) + '%' : '—'}
              </span>
              <span className="ca-metric-label">Average CTR</span>
            </div>
          </div>
          <div className="ca-metric-card">
            <div className="ca-metric-icon ca-metric-icon--info">
              <Eye size={18} />
            </div>
            <div className="ca-metric-body">
              <span className="ca-metric-value">{fmtNum(totalViews)}</span>
              <span className="ca-metric-label">Total Views</span>
            </div>
          </div>
          <div className="ca-metric-card">
            <div className="ca-metric-icon ca-metric-icon--warning">
              <Trophy size={18} />
            </div>
            <div className="ca-metric-body">
              <span className="ca-metric-value ca-metric-value--title">
                {bestTitle
                  ? bestTitle.split(':')[0]
                  : bestIdx >= 0
                    ? (videos[bestIdx].original_title?.split(':')[0] || 'Video ' + (bestIdx + 1))
                    : '—'}
              </span>
              <span className="ca-metric-label">Best Performer</span>
            </div>
          </div>
        </div>

        {/* ── Sort / Filter Bar ── */}
        <div className="ca-sort-bar">
          <div className="ca-sort-group">
            <ArrowUpDown size={14} />
            <span className="ca-sort-label">Sort by:</span>
            {[
              { key: 'default', label: 'Default' },
              { key: 'ctr-desc', label: 'CTR ↓' },
              { key: 'ctr-asc', label: 'CTR ↑' },
              { key: 'views-desc', label: 'Views ↓' },
            ].map(s => (
              <button
                key={s.key}
                className={`ca-sort-pill ${sortMode === s.key ? 'ca-sort-pill--active' : ''}`}
                onClick={() => setSortMode(s.key)}
              >{s.label}</button>
            ))}
          </div>
          <button
            className={`ca-filter-pill ${showLowOnly ? 'ca-filter-pill--active' : ''}`}
            onClick={() => setShowLowOnly(p => !p)}
          >
            <Filter size={13} /> Low performers
          </button>
        </div>

        {/* ── Video Grid ── */}
        {sorted.length === 0 ? (
          <div className="ca-no-results">No videos match the current filter.</div>
        ) : (
          <div className="ca-video-grid">
            {sorted.map((video, idx) => {
              const originalIdx = videos.indexOf(video);
              const cardKey = `${analysis.id}_v_${originalIdx}`;
              const isExpanded = !!expandedCards[cardKey];
              const { ctr, views, watchTime, aiScore, videoId, insight } = getVideoMetrics(video);
              const thumb = thumbUrl(videoId);
              const isTopPerformer = ctr != null && maxCtr > 0 && ctr === maxCtr;
              const hasThumbnail = !!thumb;

              return (
                <div key={cardKey} className={`ca-video-card ${isExpanded ? 'ca-video-card--expanded' : ''}`}>
                  <div className="ca-video-card-main">
                    {/* Thumbnail */}
                    <div className="ca-video-left">
                      <div className="ca-thumb-wrap">
                        <img
                          src={hasThumbnail ? thumb : "https://via.placeholder.com/480x180?text=No+Thumbnail"}
                          alt={video.original_title || 'Video thumbnail'}
                          className="ca-thumb"
                          onError={e => { e.target.src = "https://via.placeholder.com/480x180?text=No+Thumbnail"; }}
                        />
                      </div>
                    </div>

                    {/* Data Panel */}
                    <div className="ca-video-right">
                      {/* Badges + Number */}
                      <div className="ca-video-top-row">
                        <div className="ca-video-badges">
                          {isTopPerformer && (
                            <span className="ca-badge ca-badge--gold">
                              <Trophy size={10} /> Top Performer
                            </span>
                          )}
                          {ctrLabel(ctr) && (
                            <span className="ca-badge" style={{ background: ctrColor(ctr) + '20', color: ctrColor(ctr), border: `1px solid ${ctrColor(ctr)}40` }}>
                              CTR {ctrLabel(ctr)}
                            </span>
                          )}
                        </div>
                        <span className="ca-video-num">#{originalIdx + 1}</span>
                      </div>

                      {/* Title */}
                      <h3 className="ca-video-title">{video.original_title || `Video ${originalIdx + 1}`}</h3>

                      {/* Metrics */}
                      <div className="ca-metrics-row">
                        {ctr != null && (
                          <div className="ca-metric-chip">
                            <BarChart3 size={13} />
                            <span style={{ color: ctrColor(ctr), fontWeight: 700 }}>{ctr.toFixed(1)}%</span>
                            <span className="ca-chip-label">CTR</span>
                          </div>
                        )}
                        {views > 0 && (
                          <div className="ca-metric-chip">
                            <Eye size={13} />
                            <span>{fmtNum(views)}</span>
                            <span className="ca-chip-label">Views</span>
                          </div>
                        )}
                        {watchTime && (
                          <div className="ca-metric-chip">
                            <Clock size={13} />
                            <span>{watchTime}</span>
                            <span className="ca-chip-label">Watch time</span>
                          </div>
                        )}
                      </div>

                      {/* AI Insight */}
                      {insight && (
                        <div className="ca-ai-insight">
                          <div className="ca-ai-insight-header">
                            <Sparkles size={13} />
                            <span>AI Insight</span>
                          </div>
                          <p className="ca-ai-insight-text">{insight}</p>
                        </div>
                      )}

                      {/* AI Score */}
                      {aiScore > 0 && (
                        <div className="ca-ai-score">
                          <div className="ca-ai-score-header">
                            <Zap size={13} />
                            <span>AI Score</span>
                            <strong style={{ marginLeft: 'auto' }}>{aiScore}/100</strong>
                          </div>
                          <div className="ca-score-bar-bg">
                            <div
                              className="ca-score-bar-fill"
                              style={{ width: `${Math.min(aiScore, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Expand Toggle */}
                      <button
                        className="ca-expand-btn"
                        onClick={() => toggleCard(cardKey)}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? <><ChevronUp size={15} /> Hide details</> : <><ChevronDown size={15} /> View suggestions</>}
                      </button>
                    </div>
                  </div>

                  {/* ── Expandable Section ── */}
                  <div className={`ca-expand-body ${isExpanded ? 'ca-expand-body--open' : ''}`}>
                    <div className="ca-expand-inner">
                      <div className="ca-expand-grid">
                        {/* Improved Titles */}
                        {video.improved_titles?.length > 0 && (
                          <div className="ca-expand-col">
                            <div className="ca-expand-col-header">
                              <FileText size={15} />
                              <h4>Improved Titles</h4>
                            </div>
                            <div className="ca-expand-items">
                              {video.improved_titles.map((hook, i) => (
                                <div key={i} className="ca-expand-item ca-expand-item--title">
                                  <span className="ca-item-num">{i + 1}</span>
                                  <div>
                                    <p className="ca-improved-title">{hook.improved}</p>
                                    {hook.reason && <p className="ca-item-reason"><TrendingUp size={11} /> {hook.reason}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Content Gaps */}
                        {video.content_gaps?.length > 0 && (
                          <div className="ca-expand-col">
                            <div className="ca-expand-col-header">
                              <Target size={15} />
                              <h4>Content Gaps</h4>
                            </div>
                            <div className="ca-expand-items">
                              {video.content_gaps.map((gap, i) => (
                                <div key={i} className="ca-expand-item ca-expand-item--gap">
                                  <h5 className="ca-gap-title">{gap.gap}</h5>
                                  <p className="ca-gap-opp">{gap.opportunity}</p>
                                  <button
                                    className="ca-bookmark-btn"
                                    onClick={() => handleBookmarkIdea(gap.gap, gap.opportunity, video.original_title)}
                                  >
                                    <BookmarkPlus size={13} /> Save to Ideas
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Suggestions */}
                        {(video.suggestions?.length > 0 || video.optimization_tips?.length > 0) && (
                          <div className="ca-expand-col ca-expand-col--full">
                            <div className="ca-expand-col-header">
                              <Rocket size={15} />
                              <h4>Suggestions & Tips</h4>
                            </div>
                            <div className="ca-tips-list">
                              {(video.suggestions || video.optimization_tips).map((tip, i) => (
                                <div key={i} className="ca-tip-item">
                                  <Lightbulb size={13} className="ca-tip-icon" />
                                  <span>{typeof tip === 'string' ? tip : tip.tip || tip.suggestion || JSON.stringify(tip)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="analysis-page animate-fade-in">
      {/* ── Page Header ── */}
      <div className="ca-page-header">
        <div className="ca-page-header-text">
          <h1 className="ca-page-title">
            <BarChart3 size={26} /> Content Analysis
          </h1>
          <p className="ca-page-subtitle">Upload your YouTube analytics CSV and get AI-powered insights per video</p>
        </div>
      </div>

      {/* ── CSV Upload ── */}
      <div className="ca-upload-card">
        <div className="ca-upload-card-header">
          <h3><Upload size={18} /> Upload YouTube Analytics CSV</h3>
          <p className="ca-upload-hint">
            YouTube Studio → Analytics → See More → <strong>Download (↓) → CSV</strong>
          </p>
        </div>

        <div
          className={`ca-drop-zone ${csvFile ? 'ca-drop-zone--active' : ''} ${csvUploading ? 'ca-drop-zone--uploading' : ''}`}
          onClick={() => !csvUploading && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault(); e.stopPropagation();
            if (!csvUploading) { const file = e.dataTransfer.files[0]; if (file) handleFileChange({ target: { files: [file] } }); }
          }}
        >
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
          {csvFile ? (
            <div className="ca-file-selected">
              <FileText size={24} style={{ color: 'var(--color-success)' }} />
              <div>
                <p className="ca-file-name">{csvFile.name}</p>
                <p className="ca-file-size">{(csvFile.size / 1024).toFixed(1)} KB</p>
              </div>
              {!csvUploading && (
                <button className="ca-file-clear" onClick={(e) => { e.stopPropagation(); setCsvFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="ca-drop-placeholder">
              <div className="ca-drop-icon"><Upload size={24} /></div>
              <p className="ca-drop-text">Drag & drop your CSV, or <span className="ca-drop-browse">click to browse</span></p>
              <p className="ca-drop-sub">Supports YouTube Studio analytics export · Max 10MB</p>
            </div>
          )}
        </div>

        {csvError && <div className="alert alert-error" style={{ marginTop: 12 }}>{csvError}</div>}

        <div className="ca-upload-actions">
          <button className="btn btn-primary" onClick={handleCsvUpload} disabled={!csvFile || csvUploading}>
            {csvUploading ? <><span className="ca-spinner" /> Analyzing with AI…</> : <><Sparkles size={15} /> Analyze with AI</>}
          </button>
        </div>
      </div>

      {/* ── Analyses List ── */}
      {loading ? (
        <div className="ca-loading">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 16, marginBottom: 12 }} />)}
        </div>
      ) : analyses.length === 0 ? (
        <div className="ca-empty">
          <div className="ca-empty-icon"><BarChart3 size={40} /></div>
          <h3>No analyses yet</h3>
          <p>Upload a YouTube Studio CSV above to get AI-powered content strategy insights, improved titles, content gaps, and growth strategies.</p>
        </div>
      ) : (
        <div className="ca-analysis-list">
          {analyses.map((analysis) => (
            <div key={analysis.id} className="ca-analysis-entry">
              <div className="ca-analysis-entry-header" onClick={() => toggleAnalysis(analysis.id)}>
                <div className="ca-entry-title-group">
                  <div className="ca-entry-icon"><Sparkles size={16} /></div>
                  <div>
                    <h3 className="ca-entry-title">{analysis.title}</h3>
                    <span className="ca-entry-date">
                      {new Date(analysis.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(analysis.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="ca-entry-actions">
                  <button
                    className="ca-delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(analysis.id); }}
                    title="Delete analysis"
                  >
                    <Trash2 size={15} />
                  </button>
                  <div className="ca-chevron-wrap">
                    {expandedAnalyses[analysis.id] ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  </div>
                </div>
              </div>

              <div className={`ca-entry-body ${expandedAnalyses[analysis.id] ? 'ca-entry-body--open' : ''}`}>
                <div className="ca-entry-body-inner">
                  {renderAnalysisContent(analysis)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Performance Visual (no-thumbnail fallback) ─── */
function PerformanceVisual({ ctr, views, aiScore }) {
  return (
    <div className="ca-perf-visual">
      {ctr != null && (
        <div className="ca-perf-row">
          <span className="ca-perf-label">CTR</span>
          <div className="ca-perf-bar-bg">
            <div className="ca-perf-bar-fill" style={{ width: `${Math.min(ctr * 10, 100)}%`, background: ctrColor(ctr) }} />
          </div>
          <span className="ca-perf-value" style={{ color: ctrColor(ctr) }}>{ctr.toFixed(1)}%</span>
        </div>
      )}
      {views > 0 && (
        <div className="ca-perf-stat">
          <Eye size={12} />
          <span>{fmtNum(views)}</span>
        </div>
      )}
      {aiScore > 0 && (
        <div className="ca-perf-stat">
          <Zap size={12} />
          <span>{aiScore}/100</span>
        </div>
      )}
      {ctr == null && views <= 0 && !aiScore && (
        <div className="ca-perf-placeholder">
          <BarChart3 size={28} />
        </div>
      )}
    </div>
  );
}
