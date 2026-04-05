import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  PenTool, Wand2, RefreshCw, Fish, History, Save,
  Bold, Italic, Underline, Link as LinkIcon, Image as ImageIcon,
  List, ListOrdered,
  Grid, Layers, Trash2, ChevronUp, ChevronDown, Move,
} from 'lucide-react';
import api from '../services/api';
import './ScriptEditorPage.css';

/* ─────────────────────── helpers ─────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);

const SNAP = 16; // grid size in px
function snap(v) { return Math.round(v / SNAP) * SNAP; }

/* ─────────────────────── DraggableImage ─────────────────────── */
function DraggableImage({ img, isSelected, snapEnabled, canvasRef, onSelect, onUpdate, onDelete }) {
  const elRef = useRef(null);
  const dragState = useRef(null);
  const resizeState = useRef(null);

  /* ── drag-to-move ── */
  const startMove = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(img.id);

    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();

    dragState.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: img.x,
      startY: img.y,
      canvasRect,
    };

    const onMove = (me) => {
      if (!dragState.current) return;
      const { startMouseX, startMouseY, startX, startY, canvasRect } = dragState.current;
      let nx = startX + (me.clientX - startMouseX);
      let ny = startY + (me.clientY - startMouseY);
      /* clamp to canvas */
      nx = Math.max(0, Math.min(nx, canvasRect.width - img.width));
      ny = Math.max(0, Math.min(ny, canvas.scrollHeight - 60));
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      onUpdate(img.id, { x: nx, y: ny });
    };

    const onUp = () => {
      dragState.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  /* ── corner resize ── */
  const startResize = (e, corner) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    resizeState.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: img.width,
      startH: img.height,
      startX: img.x,
      startY: img.y,
      corner,
    };

    const onMove = (me) => {
      if (!resizeState.current) return;
      const { startMouseX, startMouseY, startW, startH, startX, startY, corner } = resizeState.current;
      const dx = me.clientX - startMouseX;
      const dy = me.clientY - startMouseY;

      let newW = startW, newH = startH, newX = startX, newY = startY;

      switch (corner) {
        case 'se': newW = startW + dx; newH = startH + dy; break;
        case 'sw': newW = startW - dx; newH = startH + dy; newX = startX + dx; break;
        case 'ne': newW = startW + dx; newH = startH - dy; newY = startY + dy; break;
        case 'nw': newW = startW - dx; newH = startH - dy; newX = startX + dx; newY = startY + dy; break;
      }

      newW = Math.max(60, newW);
      newH = Math.max(40, newH);
      onUpdate(img.id, { width: newW, height: newH, x: newX, y: newY });
    };

    const onUp = () => {
      resizeState.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={elRef}
      className={`canvas-image-wrapper ${isSelected ? 'canvas-image-selected' : ''}`}
      style={{
        position: 'absolute',
        left: img.x,
        top: img.y,
        width: img.width,
        height: img.height,
        zIndex: img.zIndex,
        userSelect: 'none',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(img.id); }}
    >
      {/* The image itself */}
      <img
        src={img.src}
        alt={img.alt || 'canvas image'}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 6 }}
        draggable={false}
      />

      {/* Drag handle — only visible when selected */}
      {isSelected && (
        <>
          {/* Full overlay for move */}
          <div
            className="img-move-handle"
            onMouseDown={startMove}
            title="Drag to move"
          >
            <Move size={14} />
          </div>

          {/* Delete */}
          <button className="img-action-btn img-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(img.id); }} title="Delete image">
            <Trash2 size={12} />
          </button>

          {/* Resize corner handles */}
          {['nw', 'ne', 'sw', 'se'].map(c => (
            <div
              key={c}
              className={`img-resize-handle img-resize-${c}`}
              onMouseDown={(e) => startResize(e, c)}
            />
          ))}
        </>
      )}
    </div>
  );
}

/* ─────────────────────── Main Page ─────────────────────── */
export default function ScriptEditorPage() {
  const [ideas, setIdeas] = useState([]);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [activeScript, setActiveScript] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('professional');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  /* Canvas images state */
  const [canvasImages, setCanvasImages] = useState([]); // { id, src, x, y, width, height, zIndex, alt }
  const [selectedImgId, setSelectedImgId] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(false);

  const location = useLocation();
  const editorRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Flag: when true the next canvasImages change should NOT trigger auto-save
  // (because it came from a restore, not a user action).
  const isRestoringRef = useRef(false);
  // Debounce timer for auto-saving canvas to backend
  const canvasSaveTimerRef = useRef(null);

  /* ──────── Data loading ──────── */
  useEffect(() => { loadIdeas(); }, []);

  useEffect(() => {
    if (ideas.length > 0 && location.state?.selectedIdeaId) {
      const incomingIdea = ideas.find(i => i.id === location.state.selectedIdeaId);
      if (incomingIdea) setSelectedIdea(incomingIdea);
    }
  }, [ideas, location.state]);

  useEffect(() => {
    if (selectedIdea) {
      loadScripts(selectedIdea.id);
      setPrompt(selectedIdea.title + (selectedIdea.description ? ': ' + selectedIdea.description : ''));
    }
  }, [selectedIdea]);

  const loadIdeas = async () => {
    try { setIdeas(await api.getIdeas()); }
    catch (err) { console.error('Failed to load ideas:', err); }
  };

  const loadScripts = async (ideaId) => {
    try {
      const data = await api.getScriptsByIdea(ideaId);
      setScripts(data);
      setActiveScript(data.length > 0 ? data[0] : null);
    } catch (err) { console.error('Failed to load scripts:', err); }
  };

  /* ──────── AI Actions ──────── */
  const handleGenerate = async () => {
    if (!selectedIdea || !prompt.trim()) return;
    setGenerating(true); setError('');
    try {
      const result = await api.generateScript({ ideaId: selectedIdea.id, prompt, tone });
      // After AI generates, carry current canvas images to the new script
      if (canvasImages.length > 0) {
        try {
          await api.updateScriptCanvas(result.id, JSON.stringify(canvasImages));
          result.canvasData = JSON.stringify(canvasImages);
        } catch { /* non-critical */ }
      }
      setActiveScript(result);
      setScripts(prev => [result, ...prev]);
    } catch (err) { setError(err.message || 'Failed to generate script'); }
    finally { setGenerating(false); }
  };

  const handleImprove = async () => {
    if (!selectedIdea || !activeScript) return;
    setGenerating(true); setError('');
    try {
      const result = await api.improveScript({ ideaId: selectedIdea.id, prompt: prompt || 'Improve this script', tone, existingScript: activeScript.content });
      // Carry current canvas images to the improved script
      if (canvasImages.length > 0) {
        try {
          await api.updateScriptCanvas(result.id, JSON.stringify(canvasImages));
          result.canvasData = JSON.stringify(canvasImages);
        } catch { /* non-critical */ }
      }
      setActiveScript(result);
      setScripts(prev => [result, ...prev]);
    } catch (err) { setError(err.message || 'Failed to improve script'); }
    finally { setGenerating(false); }
  };

  const handleGenerateHooks = async () => {
    if (!selectedIdea || !prompt.trim()) return;
    setGenerating(true); setError('');
    try {
      const result = await api.generateHook({ ideaId: selectedIdea.id, prompt });
      if (canvasImages.length > 0) {
        try {
          await api.updateScriptCanvas(result.id, JSON.stringify(canvasImages));
          result.canvasData = JSON.stringify(canvasImages);
        } catch { /* non-critical */ }
      }
      setActiveScript(result);
      setScripts(prev => [result, ...prev]);
    } catch (err) { setError(err.message || 'Failed to generate hooks'); }
    finally { setGenerating(false); }
  };

  const handleSaveManual = async () => {
    if (!selectedIdea) return;
    setGenerating(true); setError('');
    try {
      const result = await api.saveManualScript({
        ideaId: selectedIdea.id,
        prompt: prompt || 'Manual save',
        existingScript: editorContent,
        canvasData: JSON.stringify(canvasImages),   // ← images persisted to DB
      });
      setActiveScript(result);
      setScripts(prev => [result, ...prev]);
    } catch (err) { setError(err.message || 'Failed to save script'); }
    finally { setGenerating(false); }
  };

  /* ──────── Format script content ──────── */
  const formatScriptContent = (content) => {
    if (!content) return '';
    return content
      .replace(/## (HOOK|BODY|CALL-TO-ACTION)/gi, '<h3 class="script-section-title">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  /* ──────── Restore text + canvas when activeScript changes ──────── */
  useEffect(() => {
    // ── 1. Sync text content into the contenteditable ──
    let content = '';
    if (activeScript) {
      content = (activeScript.content.includes('<p>') || activeScript.content.includes('<strong>'))
        ? activeScript.content
        : formatScriptContent(activeScript.content);
    }
    setEditorContent(content);
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }

    // ── 2. Restore canvas images from backend (canvasData field) ──
    isRestoringRef.current = true; // prevent auto-save from firing for this restore
    if (activeScript && activeScript.canvasData) {
      try {
        const parsed = JSON.parse(activeScript.canvasData);
        setCanvasImages(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCanvasImages([]);
      }
    } else {
      setCanvasImages([]);
    }

    setSelectedImgId(null);
  }, [activeScript, selectedIdea]);

  /* ──────── Text Formatting ──────── */
  const handleFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const addLink = () => {
    const url = window.prompt('Enter link URL:');
    if (url) handleFormat('createLink', url);
  };

  /* ──────── Image Upload → Canvas ──────── */
  const addImage = () => fileInputRef.current?.click();

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target.result; // base64 data URL — persists across reloads
      /* Get a natural-size hint via a temp Image element */
      const tempImg = new Image();
      tempImg.onload = () => {
        const maxW = (canvasRef.current?.clientWidth || 600) * 0.45;
        const ratio = tempImg.naturalHeight / tempImg.naturalWidth;
        const w = Math.min(tempImg.naturalWidth, maxW);
        const h = w * ratio;

        const maxZ = canvasImages.reduce((m, i) => Math.max(m, i.zIndex), 0);

        setCanvasImages(prev => [...prev, {
          id: uid(),
          src,
          alt: file.name,
          x: 40,
          y: 40,
          width: Math.round(w),
          height: Math.round(h),
          zIndex: maxZ + 1,
        }]);
      };
      tempImg.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ──────── Canvas Image Management ──────── */
  const updateImage = useCallback((id, patch) => {
    setCanvasImages(prev => prev.map(img => img.id === id ? { ...img, ...patch } : img));
  }, []);

  const deleteImage = useCallback((id) => {
    setCanvasImages(prev => prev.filter(img => img.id !== id));
    setSelectedImgId(null);
  }, []);

  const selectedImg = canvasImages.find(i => i.id === selectedImgId);

  const bringForward = () => {
    if (!selectedImg) return;
    const maxZ = canvasImages.reduce((m, i) => Math.max(m, i.zIndex), 0);
    updateImage(selectedImg.id, { zIndex: Math.min(selectedImg.zIndex + 1, maxZ + 1) });
  };

  const sendBackward = () => {
    if (!selectedImg) return;
    updateImage(selectedImg.id, { zIndex: Math.max(selectedImg.zIndex - 1, 1) });
  };

  /* Deselect image when clicking empty canvas area */
  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current || e.target === editorRef.current) {
      setSelectedImgId(null);
    }
  };

  /* ──────── Auto-save canvas images to backend (debounced) ──────────
   *  Whenever canvasImages changes from a user action (not a restore),
   *  debounce-save the JSON to the backend via PUT /script/:id/canvas.
   *  Falls back to localStorage for unsaved drafts.
   */
  useEffect(() => {
    // Skip the save if this change came from a restore
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }

    // Clear any pending save timer
    if (canvasSaveTimerRef.current) {
      clearTimeout(canvasSaveTimerRef.current);
    }

    // Debounce: save 800ms after the last change
    canvasSaveTimerRef.current = setTimeout(() => {
      const json = JSON.stringify(canvasImages);

      if (activeScript?.id) {
        // Save to backend database
        api.updateScriptCanvas(activeScript.id, json).catch((err) => {
          console.warn('Canvas auto-save failed, falling back to localStorage:', err);
          // Fallback: save to localStorage
          try { localStorage.setItem(`canvas_script_${activeScript.id}`, json); } catch { /* ignore */ }
        });
      } else if (selectedIdea?.id) {
        // No script yet (draft) — save to localStorage only
        try { localStorage.setItem(`canvas_draft_${selectedIdea.id}`, json); } catch { /* ignore */ }
      }
    }, 800);

    return () => {
      if (canvasSaveTimerRef.current) clearTimeout(canvasSaveTimerRef.current);
    };
  }, [canvasImages]); // only canvasImages — activeScript read from closure at save time

  /* ──────── Keyboard shortcuts ──────── */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImgId &&
          document.activeElement !== editorRef.current) {
        deleteImage(selectedImgId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedImgId, deleteImage]);

  /* ──────── JSX ──────── */
  return (
    <div className="script-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PenTool size={28} /> Script Editor
          </h1>
          <p className="page-subtitle">AI-powered script generation · drag &amp; drop images freely on canvas</p>
        </div>
      </div>

      <div className="script-layout">
        <div className="script-content-area" style={{ width: '100%' }}>
          {selectedIdea ? (
            <div className="card script-viewer">
              {/* Script header */}
              {activeScript && (
                <div className="script-viewer-header">
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                      {activeScript.scriptType === 'HOOKS' ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Fish size={18} /> Generated Hooks</span>
                        : activeScript.scriptType === 'IMPROVED' ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><RefreshCw size={18} /> Improved Script</span>
                        : activeScript.scriptType === 'MANUAL' ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Save size={18} /> Manually Saved</span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wand2 size={18} /> Generated Script</span>}
                    </h3>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {new Date(activeScript.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="tag">{activeScript.scriptType}</span>
                  </div>
                </div>
              )}

              {!activeScript && (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>New Script: {selectedIdea.title}</h3>
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>Start typing below or use the AI tools. Upload an image to place it on the canvas.</p>
                </div>
              )}

              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

              {/* ─── Editor Container ─── */}
              <div className="script-editor-container" style={{ marginTop: 16 }}>

                {/* ── Toolbar ── */}
                <div className="editor-toolbar">
                  {/* AI buttons */}
                  <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating} title="AI Write">
                    {generating ? <RefreshCw size={14} className="spin" /> : <Wand2 size={14} />}
                    <span style={{ marginLeft: 4 }}>AI Write</span>
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleImprove} disabled={generating || !activeScript} title="Improve">
                    <RefreshCw size={14} /> <span style={{ marginLeft: 4 }}>Improve</span>
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleGenerateHooks} disabled={generating} title="Hooks">
                    <Fish size={14} /> <span style={{ marginLeft: 4 }}>Hooks</span>
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleSaveManual} disabled={generating} title="Save">
                    <Save size={14} /> <span style={{ marginLeft: 4 }}>Save</span>
                  </button>

                  <div className="toolbar-divider" />

                  {/* Text formatting */}
                  <button className="btn btn-ghost btn-sm" onClick={() => handleFormat('formatBlock', 'H3')} title="Heading"><span style={{ fontWeight: 700, fontSize: 12 }}>H3</span></button>
                  <div className="toolbar-divider" />
                  <button className="btn btn-ghost btn-sm" onClick={() => handleFormat('bold')} title="Bold"><Bold size={16} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleFormat('italic')} title="Italic"><Italic size={16} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleFormat('underline')} title="Underline"><Underline size={16} /></button>
                  <div className="toolbar-divider" />
                  <button className="btn btn-ghost btn-sm" onClick={() => handleFormat('insertUnorderedList')} title="Bullet List"><List size={16} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleFormat('insertOrderedList')} title="Numbered List"><ListOrdered size={16} /></button>
                  <div className="toolbar-divider" />
                  <button className="btn btn-ghost btn-sm" onClick={addLink} title="Add Link"><LinkIcon size={16} /></button>

                  {/* Image upload */}
                  <button className="btn btn-ghost btn-sm" onClick={addImage} title="Add Image to Canvas">
                    <ImageIcon size={16} />
                  </button>
                  <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageChange} />

                  {/* Snap-to-grid toggle */}
                  <button
                    className={`btn btn-sm ${snapEnabled ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSnapEnabled(s => !s)}
                    title="Toggle snap-to-grid"
                    style={{ marginLeft: 2 }}
                  >
                    <Grid size={14} /> <span style={{ marginLeft: 4, fontSize: 11 }}>Snap</span>
                  </button>

                  {/* Layer controls — shown when an image is selected */}
                  {selectedImg && (
                    <div className="toolbar-layer-controls">
                      <span className="layer-label"><Layers size={12} style={{ marginRight: 4 }} />Layer</span>
                      <button className="btn btn-ghost btn-sm" onClick={bringForward} title="Bring Forward"><ChevronUp size={14} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={sendBackward} title="Send Backward"><ChevronDown size={14} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteImage(selectedImg.id)} title="Delete Image" style={{ color: 'var(--color-error)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Canvas + Editor ── */}
                <div
                  ref={canvasRef}
                  className="editor-canvas"
                  onClick={handleCanvasClick}
                >
                  {/* Snap grid overlay (decorative) */}
                  {snapEnabled && <div className="editor-snap-grid" />}

                  {/* Contenteditable text layer */}
                  <div
                    ref={editorRef}
                    contentEditable
                    className="native-rich-editor"
                    placeholder="Start writing your script here…"
                    onBlur={(e) => setEditorContent(e.currentTarget.innerHTML)}
                    onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
                    suppressContentEditableWarning
                  />

                  {/* Floating image layer */}
                  {canvasImages.map(img => (
                    <DraggableImage
                      key={img.id}
                      img={img}
                      isSelected={img.id === selectedImgId}
                      snapEnabled={snapEnabled}
                      canvasRef={canvasRef}
                      onSelect={setSelectedImgId}
                      onUpdate={updateImage}
                      onDelete={deleteImage}
                    />
                  ))}
                </div>

                {/* Canvas image hint */}
                {canvasImages.length > 0 && (
                  <div className="canvas-image-hint">
                    {canvasImages.length} image{canvasImages.length > 1 ? 's' : ''} on canvas
                    {selectedImg ? ' · selected — drag to move, corners to resize, Del to delete' : ' · click an image to select it'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '100px 32px' }}>
              <h3 style={{ color: 'var(--color-text)', marginBottom: 16, fontSize: '1.5rem', fontWeight: 800 }}>Start your script</h3>
              <p className="text-muted" style={{ marginBottom: 24 }}>Select an idea from the Ideas board to launch the Script Editor.</p>
              <button className="btn btn-primary" onClick={() => window.location.href = '/ideas'}>
                Go to Ideas
              </button>
            </div>
          )}

          {/* Script History */}
          {scripts.length > 1 && (
            <div className="card" style={{ marginTop: 20 }}>
              <h3 className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(s.createdAt).toLocaleString()}</span>
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
