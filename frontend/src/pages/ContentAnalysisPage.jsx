import { useState, useEffect, useRef } from 'react';
import {
  BarChart3, TrendingUp, Target, Rocket, FileText, Lightbulb,
  ChevronDown, ChevronUp, BookmarkPlus, Trash2, Upload, Sparkles, X,
} from 'lucide-react';
import api from '../services/api';
import './ContentAnalysisPage.css';

export default function ContentAnalysisPage() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAnalyses, setExpandedAnalyses] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  // CSV upload states
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    try {
      const data = await api.getAnalyses();
      setAnalyses(data);
      if (data.length > 0) {
        setExpandedAnalyses({ [data[0].id]: true });
      }
    } catch (err) {
      console.error('Failed to load analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── CSV Upload Logic ──
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Please select a CSV file');
      setCsvFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCsvError('File size must be under 10MB');
      setCsvFile(null);
      return;
    }
    setCsvError('');
    setCsvFile(file);
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setCsvError('Please select a CSV file');
      return;
    }
    setCsvUploading(true);
    setCsvError('');
    try {
      await api.uploadCsvIdea(csvFile);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      const refreshed = await api.getAnalyses();
      setAnalyses(refreshed);
      if (refreshed.length > 0) {
        setExpandedAnalyses(prev => ({ ...prev, [refreshed[0].id]: true }));
      }
    } catch (err) {
      setCsvError(err.message || 'Failed to process CSV');
    } finally {
      setCsvUploading(false);
    }
  };

  const toggleAnalysis = (id) => {
    setExpandedAnalyses(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isSectionExpanded = (analysisId, sectionName) => {
    const key = `${analysisId}_${sectionName}`;
    return expandedSections[key] !== false;
  };

  const handleBookmarkIdea = async (title, description, context) => {
    try {
      await api.createIdea({
        title,
        description: description + (context ? '\n\nContext: ' + context : ''),
        tags: 'AI-Generated',
      });
      alert('Idea bookmarked to your Ideas board!');
    } catch (err) {
      alert('Failed to bookmark: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this analysis?')) return;
    try {
      await api.deleteIdea(id);
      loadAnalyses();
    } catch (err) {
      alert('Failed to delete: ' + (err.message || 'Unknown error'));
    }
  };

  const parseAiOutput = (outputData) => {
    if (!outputData) return null;
    if (typeof outputData !== 'string') return outputData;
    try {
      return JSON.parse(outputData);
    } catch {
      try {
        let cleaned = outputData
          .replace(/,\s*([\]}])/g, '$1')
          .replace(/\n(?! *[{}"[\]])/g, '\\n')
          .replace(/[\u0000-\u001F]+/g, ' ');
        return JSON.parse(cleaned);
      } catch {
        try {
          // eslint-disable-next-line no-new-func
          return new Function('return ' + outputData)();
        } catch {
          let baseText = outputData.trim();
          const fixAttempts = [']}', '}', ']}', '] }', '} ] }'];
          for (let fix of fixAttempts) {
            try { return JSON.parse(baseText + fix); } catch {}
            try { return new Function('return ' + baseText + fix)(); } catch {}
          }
          return null;
        }
      }
    }
  };

  const renderAnalysisContent = (analysis) => {
    const output = parseAiOutput(analysis.outputData);
    if (!output) {
      return (
        <div className="alert alert-error">
          <p><b>Could not parse AI results.</b> Raw data:</p>
          <div style={{ marginTop: 10, padding: 10, background: 'rgba(0,0,0,0.05)', borderRadius: 4, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
            {analysis.outputData}
          </div>
        </div>
      );
    }

    return (
      <div className="video-analysis-list">
        {output.video_analyses?.map((video, idx) => {
          const vKey = `${analysis.id}_v_${idx}`;
          const isExp = isSectionExpanded(analysis.id, `v_${idx}`);

          return (
            <div key={idx} className="analysis-video-card">
              <button 
                className="video-card-header" 
                onClick={() => toggleSection(vKey)}
              >
                <div className="video-header-left">
                  <span className="video-number">{idx + 1}</span>
                  <h3 className="video-title">{video.original_title}</h3>
                </div>
                {isExp ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {isExp && (
                <div className="video-card-body">
                  {/* Metric Insights */}
                  {video.metric_insights && (
                    <div className="video-insight-box">
                      <BarChart3 size={16} className="insight-icon" />
                      <p><strong>Metrics Insight:</strong> {video.metric_insights}</p>
                    </div>
                  )}

                  <div className="video-card-columns">
                    {/* Improved Titles */}
                    {video.improved_titles?.length > 0 && (
                      <div className="video-card-col">
                        <h4 className="col-title"><FileText size={16} /> Improved Titles</h4>
                        <div className="col-items">
                          {video.improved_titles.map((hook, i) => (
                            <div key={i} className="analysis-item">
                              <span className="improved-text" style={{fontWeight: 600, color: 'var(--color-success)'}}>{hook.improved}</span>
                              {hook.reason && <p className="analysis-item-reason" style={{marginTop: 4}}><TrendingUp size={13} /> {hook.reason}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Content Gaps */}
                    {video.content_gaps?.length > 0 && (
                      <div className="video-card-col">
                        <h4 className="col-title"><Target size={16} /> Content Gaps</h4>
                        <div className="col-items">
                          {video.content_gaps.map((gap, i) => (
                            <div key={i} className="analysis-item">
                              <h5 className="gap-title" style={{fontWeight: 700}}>{gap.gap}</h5>
                              <p className="gap-desc" style={{fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 4}}>{gap.opportunity}</p>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ marginTop: 8, padding: '4px 8px', color: 'var(--color-primary)' }}
                                onClick={() => handleBookmarkIdea(gap.gap, gap.opportunity, video.original_title)}
                              >
                                <BookmarkPlus size={14} style={{ marginRight: 4 }} /> Save to Ideas
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="analysis-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={28} /> Content Analysis
          </h1>
          <p className="page-subtitle">Upload your YouTube analytics CSV and get AI-powered content insights</p>
        </div>
      </div>

      {/* ── CSV Upload Section ── */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={20} /> Upload YouTube Analytics CSV
        </h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
          Export from <strong>YouTube Studio → Analytics → See More → Download (↓) → CSV</strong>
        </p>

        <div
          className={`csv-upload-zone ${csvFile ? 'csv-upload-zone-active' : ''} ${csvUploading ? 'csv-upload-zone-uploading' : ''}`}
          onClick={() => !csvUploading && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!csvUploading) {
              const file = e.dataTransfer.files[0];
              if (file) handleFileChange({ target: { files: [file] } });
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {csvFile ? (
            <div className="csv-file-selected">
              <FileText size={28} style={{ color: 'var(--color-success)' }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{csvFile.name}</p>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>{(csvFile.size / 1024).toFixed(1)} KB</p>
              </div>
              {!csvUploading && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); setCsvFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="csv-upload-placeholder">
              <Upload size={32} />
              <p>Drag & drop your CSV file here, or click to browse</p>
            </div>
          )}
        </div>

        {csvError && <div className="alert alert-error" style={{ marginTop: 'var(--space-3)' }}>{csvError}</div>}

        <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleCsvUpload}
            disabled={!csvFile || csvUploading}
          >
            {csvUploading ? (
              <><span className="spinner" /> Analyzing with AI...</>
            ) : (
              <><Sparkles size={16} /> Analyze with AI</>
            )}
          </button>
        </div>
      </div>

      {/* ── Analyses List ── */}
      {loading ? (
        <div className="card">
          <div className="skeleton" style={{ height: 20, width: '50%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: '60%' }} />
        </div>
      ) : analyses.length === 0 ? (
        <div className="card analysis-empty">
          <BarChart3 size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 16 }} />
          <h3>No analyses yet</h3>
          <p>Upload a YouTube Studio CSV above to get AI-powered content strategy insights, improved titles, content gaps, and growth strategies.</p>
        </div>
      ) : (
        <div className="analysis-list">
          {analyses.map((analysis) => (
            <div key={analysis.id} className="analysis-entry">
              <div className="analysis-entry-header" onClick={() => toggleAnalysis(analysis.id)}>
                <div className="analysis-entry-title">
                  <Sparkles size={20} style={{ color: 'var(--color-primary)' }} />
                  <div>
                    <h3>{analysis.title}</h3>
                    <span className="analysis-date">
                      {new Date(analysis.createdAt).toLocaleDateString()} at {new Date(analysis.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm analysis-delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(analysis.id); }}
                    title="Delete analysis"
                  >
                    <Trash2 size={16} />
                  </button>
                  {expandedAnalyses[analysis.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
              {expandedAnalyses[analysis.id] && (
                <div className="analysis-entry-body">
                  {renderAnalysisContent(analysis)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
