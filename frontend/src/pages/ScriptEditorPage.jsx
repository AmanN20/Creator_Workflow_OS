import { useState, useEffect } from 'react';
import { PenTool, BrainCircuit, Wand2, RefreshCw, Fish, History } from 'lucide-react';
import api from '../services/api';
import './ScriptEditorPage.css';

export default function ScriptEditorPage() {
  const [ideas, setIdeas] = useState([]);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [activeScript, setActiveScript] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('professional');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadIdeas();
  }, []);

  useEffect(() => {
    if (selectedIdea) {
      loadScripts(selectedIdea.id);
      setPrompt(selectedIdea.title + (selectedIdea.description ? ': ' + selectedIdea.description : ''));
    }
  }, [selectedIdea]);

  const loadIdeas = async () => {
    try {
      const data = await api.getIdeas();
      setIdeas(data);
    } catch (err) {
      console.error('Failed to load ideas:', err);
    }
  };

  const loadScripts = async (ideaId) => {
    try {
      const data = await api.getScriptsByIdea(ideaId);
      setScripts(data);
      if (data.length > 0) {
        setActiveScript(data[0]);
      } else {
        setActiveScript(null);
      }
    } catch (err) {
      console.error('Failed to load scripts:', err);
    }
  };

  const handleGenerate = async () => {
    if (!selectedIdea || !prompt.trim()) return;
    setGenerating(true);
    setError('');

    try {
      const result = await api.generateScript({
        ideaId: selectedIdea.id,
        prompt,
        tone,
      });
      setActiveScript(result);
      setScripts((prev) => [result, ...prev]);
    } catch (err) {
      setError(err.message || 'Failed to generate script');
    } finally {
      setGenerating(false);
    }
  };

  const handleImprove = async () => {
    if (!selectedIdea || !activeScript) return;
    setGenerating(true);
    setError('');

    try {
      const result = await api.improveScript({
        ideaId: selectedIdea.id,
        prompt: prompt || 'Improve this script',
        tone,
        existingScript: activeScript.content,
      });
      setActiveScript(result);
      setScripts((prev) => [result, ...prev]);
    } catch (err) {
      setError(err.message || 'Failed to improve script');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateHooks = async () => {
    if (!selectedIdea || !prompt.trim()) return;
    setGenerating(true);
    setError('');

    try {
      const result = await api.generateHook({
        ideaId: selectedIdea.id,
        prompt,
      });
      setActiveScript(result);
      setScripts((prev) => [result, ...prev]);
    } catch (err) {
      setError(err.message || 'Failed to generate hooks');
    } finally {
      setGenerating(false);
    }
  };

  const formatScriptContent = (content) => {
    if (!content) return '';
    return content
      .replace(/## (HOOK|BODY|CALL-TO-ACTION)/gi, '<h3 class="script-section-title">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="script-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PenTool size={28} /> Script Editor
          </h1>
          <p className="page-subtitle">AI-powered script generation for your content</p>
        </div>
      </div>

      <div className="script-layout">
        {/* Left: Idea selection & AI Controls */}
        <div className="script-sidebar">
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 12 }}>Select Idea</h3>
            <div className="idea-list">
              {ideas.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                  No ideas yet. Create some ideas first!
                </p>
              ) : (
                ideas.map((idea) => (
                  <button
                    key={idea.id}
                    className={`idea-list-item ${selectedIdea?.id === idea.id ? 'idea-list-item-active' : ''}`}
                    onClick={() => setSelectedIdea(idea)}
                  >
                    <span className="idea-list-title">{idea.title}</span>
                    {idea.tags && (
                      <div className="idea-list-tags">
                        {idea.tags.split(',').slice(0, 2).map((t, i) => (
                          <span key={i} className="tag tag-outline" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedIdea && (
            <div className="card ai-panel">
              <h3 className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BrainCircuit size={20} /> AI Controls
              </h3>

              <div className="form-group">
                <label className="form-label">Prompt / Context</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what the script should cover..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tone</label>
                <select
                  className="form-input"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  <option value="professional">Professional</option>
                  <option value="storytelling">Storytelling</option>
                  <option value="funny">Funny</option>
                  <option value="casual">Casual</option>
                  <option value="motivational">Motivational</option>
                </select>
              </div>

              {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="ai-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={16} className="spin" /> Generating...</span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Wand2 size={16} /> Generate Script</span>
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleImprove}
                  disabled={generating || !activeScript}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={16} /> Improve Script</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleGenerateHooks}
                  disabled={generating}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Fish size={16} /> Generate Hooks</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Script Content */}
        <div className="script-content-area">
          {activeScript ? (
            <div className="card script-viewer">
              <div className="script-viewer-header">
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                    {activeScript.scriptType === 'HOOKS' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Fish size={18} /> Generated Hooks</span>
                    ) : activeScript.scriptType === 'IMPROVED' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={18} /> Improved Script</span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Wand2 size={18} /> Generated Script</span>
                    )}
                  </h3>
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {new Date(activeScript.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className="tag">{activeScript.scriptType}</span>
              </div>
              <div
                className="script-content-render"
                dangerouslySetInnerHTML={{ __html: formatScriptContent(activeScript.content) }}
              />
            </div>
          ) : selectedIdea ? (
            <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
              <h3 style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }}>Ready to create</h3>
              <p className="text-muted">
                Use the AI controls on the left to generate a script for "{selectedIdea.title}"
              </p>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
              <h3 style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }}>Select an idea</h3>
              <p className="text-muted">Choose an idea from the list to start creating scripts</p>
            </div>
          )}

          {/* Script History */}
          {scripts.length > 1 && (
            <div className="card" style={{ marginTop: 20 }}>
              <h3 className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={20} /> Script History
              </h3>
              <div className="script-history">
                {scripts.map((s) => (
                  <button
                    key={s.id}
                    className={`script-history-item ${activeScript?.id === s.id ? 'script-history-active' : ''}`}
                    onClick={() => setActiveScript(s)}
                  >
                    <span className="tag tag-outline" style={{ fontSize: '0.65rem' }}>{s.scriptType}</span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
