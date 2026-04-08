import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Edit2, Trash2, Upload, PenTool, Sparkles, X, FileText, TrendingUp, Target, Rocket, ChevronDown, ChevronUp, Eye, BookmarkPlus, PenLine } from 'lucide-react';
import api from '../services/api';
import './IdeasPage.css';

const TAG_OPTIONS = ['YouTube', 'Instagram', 'Reels', 'Blog', 'Twitter', 'LinkedIn', 'TikTok', 'Podcast'];

export default function IdeasPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');

  // Modal states
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states
  const [formData, setFormData] = useState({ title: '', description: '', tags: '' });
  const [formError, setFormError] = useState('');
  const [editingIdea, setEditingIdea] = useState(null);

  // CSV states
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef(null);

  // AI Result state
  const [aiResult, setAiResult] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    video_ideas: true,
    title_hooks: true,
    content_gaps: true,
    growth_strategy: true
  });

  useEffect(() => {
    loadIdeas();
  }, [searchQuery, activeTag]);

  const loadIdeas = async () => {
    try {
      const data = await api.getIdeas(searchQuery, activeTag);
      setIdeas(data);
    } catch (err) {
      console.error('Failed to load ideas:', err);
    } finally {
      setLoading(false);
    }
  };

  // ────── Choice Modal ──────
  const openChoiceModal = () => {
    setShowChoiceModal(true);
  };

  const closeAllModals = () => {
    setShowChoiceModal(false);
    setShowManualModal(false);
    setShowCsvModal(false);
    setShowResultModal(false);
    setShowEditModal(false);
    setFormData({ title: '', description: '', tags: '' });
    setFormError('');
    setCsvFile(null);
    setCsvError('');
    setEditingIdea(null);
  };

  // ────── Manual Idea ──────
  const openManualModal = () => {
    setShowChoiceModal(false);
    setFormData({ title: '', description: '', tags: '' });
    setFormError('');
    setShowManualModal(true);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }
    try {
      await api.createIdea(formData);
      closeAllModals();
      loadIdeas();
    } catch (err) {
      setFormError(err.message || 'Failed to save idea');
    }
  };

  // ────── Edit Idea ──────
  const openEditModal = (idea) => {
    setEditingIdea(idea);
    setFormData({ title: idea.title, description: idea.description || '', tags: idea.tags || '' });
    setFormError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }
    try {
      await api.updateIdea(editingIdea.id, formData);
      closeAllModals();
      loadIdeas();
    } catch (err) {
      setFormError(err.message || 'Failed to update idea');
    }
  };

  // ────── CSV Upload ──────
  const openCsvModal = () => {
    setShowChoiceModal(false);
    setCsvFile(null);
    setCsvError('');
    setShowCsvModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
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
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setCsvError('Please select a CSV file');
      return;
    }
    setCsvUploading(true);
    setCsvError('');
    try {
      const result = await api.uploadCsvIdea(csvFile);
      setAiResult(result);
      setShowCsvModal(false);
      setShowResultModal(true);
      loadIdeas();
    } catch (err) {
      setCsvError(err.message || 'Failed to process CSV');
    } finally {
      setCsvUploading(false);
    }
  };

  // ────── View AI Result ──────
  const viewAiResult = (idea) => {
    setAiResult(idea);
    setShowResultModal(true);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // ────── Delete ──────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this idea?')) return;
    try {
      await api.deleteIdea(id);
      loadIdeas();
    } catch (err) {
      console.error('Failed to delete idea:', err);
      alert('Failed to delete idea: ' + (err.message || 'Unknown error'));
    }
  };

  // ────── Tag Helpers ──────
  const toggleTag = (tag) => {
    const currentTags = formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const index = currentTags.indexOf(tag);
    if (index > -1) {
      currentTags.splice(index, 1);
    } else {
      currentTags.push(tag);
    }
    setFormData({ ...formData, tags: currentTags.join(', ') });
  };

  const isTagSelected = (tag) => {
    return formData.tags?.split(',').map(t => t.trim()).includes(tag);
  };

  const handleBookmarkAiIdea = async (title, description, whyOrContext) => {
    try {
      const newIdea = {
        title: title,
        description: description + (whyOrContext ? '\n\nContext/Reason: ' + whyOrContext : ''),
        tags: 'AI-Generated'
      };
      await api.createIdea(newIdea);
      alert('Idea bookmarked successfully!');
      loadIdeas(); // Refresh background ideas list
    } catch (err) {
      alert('Failed to bookmark idea: ' + err.message);
    }
  };

  // Parse AI output safely with a resilient fallback
  const parseAiOutput = (outputData) => {
    if (!outputData) return null;
    if (typeof outputData !== 'string') return outputData;
    
    try {
      return JSON.parse(outputData);
    } catch (err) {
      try {
        let cleaned = outputData
          .replace(/,\s*([\]}])/g, '$1') 
          .replace(/\n(?! *[{}"\[\]])/g, '\\n')
          .replace(/[\u0000-\u001F]+/g, ' '); 
        return JSON.parse(cleaned);
      } catch (err2) {
        try {
          // eslint-disable-next-line no-new-func
          return new Function('return ' + outputData)();
        } catch (err3) {
          // Gemini sometimes truncates the final closing brackets ]}
          let baseText = outputData.trim();
          const fixAttempts = [']}', '}', ']}', '] }', '} ] }', '}\n  ]\n}'];
          for (let fix of fixAttempts) {
            try { return new Function('return ' + baseText + fix)(); } catch(e) {}
            try { return JSON.parse(baseText + fix); } catch(e) {}
          }
          return null;
        }
      }
    }
  };

  return (
    <div className="ideas-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lightbulb size={28} /> Ideas
          </h1>
          <p className="page-subtitle">Capture and organize your content ideas</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openChoiceModal}>
            <Sparkles size={18} /> New Idea
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="ideas-toolbar">
        <div className="ideas-search">
          <input
            type="text"
            className="form-input"
            placeholder="Search ideas..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveTag('');
            }}
          />
        </div>
        <div className="ideas-tags-filter">
          <button
            className={`tag ${!activeTag ? '' : 'tag-outline'}`}
            onClick={() => { setActiveTag(''); setSearchQuery(''); }}
          >
            All
          </button>
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              className={`tag ${activeTag === tag ? '' : 'tag-outline'}`}
              onClick={() => { setActiveTag(tag === activeTag ? '' : tag); setSearchQuery(''); }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Ideas Grid */}
      {loading ? (
        <div className="grid-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 14, width: '100%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '60%' }} />
            </div>
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="empty-state">
          <h3>No ideas yet</h3>
          <p>Start capturing your content ideas. Click the button above to create your first one!</p>
          <button className="btn btn-primary" onClick={openChoiceModal}>
            <Sparkles size={18} /> Create Your First Idea
          </button>
        </div>
      ) : (
        <div className="grid-2">
          {ideas.map((idea, index) => (
            <div
              key={idea.id}
              className={`card idea-card animate-fade-in ${idea.type === 'ai_csv' ? 'idea-card-ai' : ''}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {idea.type === 'ai_csv' && (
                <div className="idea-ai-badge">
                  <Sparkles size={12} /> AI Generated
                </div>
              )}
              <div className="idea-card-header">
                <h3 className="idea-title">{idea.title}</h3>
                <div className="idea-actions">
                  {idea.type === 'ai_csv' && idea.outputData && (
                    <button className="btn btn-ghost btn-sm" onClick={() => viewAiResult(idea)} title="View AI Analysis">
                      <Eye size={16} />
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(idea)}>
                    <Edit2 size={16} />
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(idea.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {idea.description && (
                <p className="idea-description">{idea.description}</p>
              )}
              <div className="idea-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="idea-tags">
                    {idea.tags?.split(',').map((tag, i) => (
                      tag.trim() && <span key={i} className="tag tag-outline">{tag.trim()}</span>
                    ))}
                  </div>
                  <span className="idea-date">
                    {new Date(idea.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {idea.type !== 'ai_csv' && (
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={() => navigate('/scripts', { state: { selectedIdeaId: idea.id } })}
                  >
                    <PenLine size={14} style={{ marginRight: '4px' }} /> Write Script
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL 1: CHOICE — Manual or CSV
          ═══════════════════════════════════════════ */}
      {showChoiceModal && (
        <div className="modal-overlay" onClick={closeAllModals}>
          <div className="modal modal-choice animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Idea</h2>
              <button className="modal-close" onClick={closeAllModals}><X size={20} /></button>
            </div>
            <p className="modal-subtitle">Choose how you want to create your idea</p>
            <div className="choice-grid">
              <button className="choice-card" onClick={openManualModal}>
                <div className="choice-icon choice-icon-manual">
                  <PenTool size={32} />
                </div>
                <h3>Create Manually</h3>
                <p>Write your own idea with title, description and tags</p>
              </button>
              <button className="choice-card" onClick={openCsvModal}>
                <div className="choice-icon choice-icon-csv">
                  <Upload size={32} />
                </div>
                <h3>Upload YouTube CSV</h3>
                <p>Upload your YouTube Studio analytics CSV and let AI generate viral ideas</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL 2: MANUAL IDEA
          ═══════════════════════════════════════════ */}
      {showManualModal && (
        <div className="modal-overlay" onClick={closeAllModals}>
          <div className="modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><PenTool size={20} /> New Manual Idea</h2>
              <button className="modal-close" onClick={closeAllModals}><X size={20} /></button>
            </div>
            <form onSubmit={handleManualSubmit}>
              {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="idea-title">Title</label>
                <input
                  id="idea-title"
                  type="text"
                  className="form-input"
                  placeholder="What's your content idea?"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="idea-desc">Description</label>
                <textarea
                  id="idea-desc"
                  className="form-input"
                  placeholder="Describe your idea in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tags</label>
                <div className="tag-selector">
                  {TAG_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`tag ${isTagSelected(tag) ? '' : 'tag-outline'}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeAllModals}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Idea</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL 3: CSV UPLOAD
          ═══════════════════════════════════════════ */}
      {showCsvModal && (
        <div className="modal-overlay" onClick={closeAllModals}>
          <div className="modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><Upload size={20} /> Upload YouTube CSV</h2>
              <button className="modal-close" onClick={closeAllModals}><X size={20} /></button>
            </div>

            <div className="csv-instructions">
              <h4>How to export from YouTube Studio:</h4>
              <ol>
                <li>Go to <strong>YouTube Studio → Analytics</strong></li>
                <li>Select <strong>Lifetime</strong> period</li>
                <li>Click <strong>"See More"</strong></li>
                <li>Click the <strong>Download</strong> icon (↓)</li>
                <li>Choose <strong>CSV</strong> format</li>
              </ol>
            </div>

            <div
              className={`csv-dropzone ${csvFile ? 'csv-dropzone-active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) handleFileChange({ target: { files: [file] } });
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
                <div className="csv-file-info">
                  <FileText size={32} />
                  <div>
                    <p className="csv-filename">{csvFile.name}</p>
                    <p className="csv-filesize">{(csvFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ) : (
                <div className="csv-placeholder">
                  <Upload size={40} />
                  <p>Drag & drop your CSV file here</p>
                  <span>or click to browse</span>
                </div>
              )}
            </div>

            {csvError && <div className="alert alert-error" style={{ marginTop: 16 }}>{csvError}</div>}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeAllModals}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCsvUpload}
                disabled={!csvFile || csvUploading}
              >
                {csvUploading ? (
                  <>
                    <span className="spinner" /> Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Analyze with AI
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL 4: EDIT IDEA
          ═══════════════════════════════════════════ */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeAllModals}>
          <div className="modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><Edit2 size={20} /> Edit Idea</h2>
              <button className="modal-close" onClick={closeAllModals}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-idea-title">Title</label>
                <input
                  id="edit-idea-title"
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-idea-desc">Description</label>
                <textarea
                  id="edit-idea-desc"
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tags</label>
                <div className="tag-selector">
                  {TAG_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`tag ${isTagSelected(tag) ? '' : 'tag-outline'}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeAllModals}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Idea</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL 5: AI RESULTS
          ═══════════════════════════════════════════ */}
      {showResultModal && aiResult && (
        <div className="modal-overlay" onClick={closeAllModals}>
          <div className="modal modal-results animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><Sparkles size={20} /> AI Analysis Results</h2>
              <button className="modal-close" onClick={closeAllModals}><X size={20} /></button>
            </div>

            <div className="ai-results-container">
              {(() => {
                const output = parseAiOutput(aiResult.outputData);
                if (!output) {
                  return (
                    <div className="alert alert-error">
                      <p><b>Could not parse AI results.</b> The AI returned invalid JSON format. Here is the raw data:</p>
                      <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px', overflowX: 'auto', maxHeight: '400px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' }}>
                        {aiResult.outputData}
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Video Ideas */}
                    {output.video_ideas && output.video_ideas.length > 0 && (
                      <div className="ai-section">
                        <button className="ai-section-header" onClick={() => toggleSection('video_ideas')}>
                          <div className="ai-section-title">
                            <Lightbulb size={20} />
                            <span>Viral Video Ideas ({output.video_ideas.length})</span>
                          </div>
                          {expandedSections.video_ideas ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {expandedSections.video_ideas && (
                          <div className="ai-section-content">
                            {output.video_ideas.map((idea, i) => (
                              <div key={i} className="ai-card" style={{ position: 'relative' }}>
                                <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 12, right: 12, color: 'var(--color-primary)' }} onClick={() => handleBookmarkAiIdea(idea.title, idea.description, idea.why)} title="Bookmark this Idea">
                                  <BookmarkPlus size={18} />
                                </button>
                                <h4 className="ai-card-title" style={{ paddingRight: 40 }}>{i + 1}. {idea.title}</h4>
                                {idea.description && <p className="ai-card-text">{idea.description}</p>}
                                {idea.why && <p className="ai-card-reason"><Target size={14} /> {idea.why}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Title Hooks */}
                    {output.title_hooks && output.title_hooks.length > 0 && (
                      <div className="ai-section">
                        <button className="ai-section-header" onClick={() => toggleSection('title_hooks')}>
                          <div className="ai-section-title">
                            <FileText size={20} />
                            <span>Improved Titles ({output.title_hooks.length})</span>
                          </div>
                          {expandedSections.title_hooks ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {expandedSections.title_hooks && (
                          <div className="ai-section-content">
                            {output.title_hooks.map((hook, i) => (
                              <div key={i} className="ai-card ai-card-comparison">
                                <div className="title-compare">
                                  <div className="title-original">
                                    <span className="compare-label">Original:</span>
                                    <span>{hook.original}</span>
                                  </div>
                                  <div className="title-improved">
                                    <span className="compare-label">Improved:</span>
                                    <span>{hook.improved}</span>
                                  </div>
                                </div>
                                {hook.reason && <p className="ai-card-reason"><TrendingUp size={14} /> {hook.reason}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content Gaps */}
                    {output.content_gaps && output.content_gaps.length > 0 && (
                      <div className="ai-section">
                        <button className="ai-section-header" onClick={() => toggleSection('content_gaps')}>
                          <div className="ai-section-title">
                            <Target size={20} />
                            <span>Content Gaps ({output.content_gaps.length})</span>
                          </div>
                          {expandedSections.content_gaps ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {expandedSections.content_gaps && (
                          <div className="ai-section-content">
                            {output.content_gaps.map((gap, i) => (
                              <div key={i} className="ai-card">
                                <h4 className="ai-card-title">{gap.gap}</h4>
                                {gap.opportunity && <p className="ai-card-text">{gap.opportunity}</p>}
                                {gap.action && <p className="ai-card-reason"><Rocket size={14} /> {gap.action}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Growth Strategy */}
                    {output.growth_strategy && output.growth_strategy.length > 0 && (
                      <div className="ai-section">
                        <button className="ai-section-header" onClick={() => toggleSection('growth_strategy')}>
                          <div className="ai-section-title">
                            <Rocket size={20} />
                            <span>Growth Strategy ({output.growth_strategy.length})</span>
                          </div>
                          {expandedSections.growth_strategy ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {expandedSections.growth_strategy && (
                          <div className="ai-section-content">
                            {output.growth_strategy.map((strat, i) => (
                              <div key={i} className="ai-card">
                                <h4 className="ai-card-title">{strat.strategy}</h4>
                                {strat.implementation && <p className="ai-card-text">{strat.implementation}</p>}
                                {strat.expected_impact && (
                                  <p className="ai-card-reason"><TrendingUp size={14} /> Expected: {strat.expected_impact}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
