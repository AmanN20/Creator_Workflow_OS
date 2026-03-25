import { useState, useEffect } from 'react';
import { Lightbulb, Edit2, Trash2 } from 'lucide-react';
import api from '../services/api';
import './IdeasPage.css';

const TAG_OPTIONS = ['YouTube', 'Instagram', 'Reels', 'Blog', 'Twitter', 'LinkedIn', 'TikTok', 'Podcast'];

export default function IdeasPage() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [formData, setFormData] = useState({ title: '', description: '', tags: '' });
  const [formError, setFormError] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }

    try {
      if (editingIdea) {
        await api.updateIdea(editingIdea.id, formData);
      } else {
        await api.createIdea(formData);
      }
      closeModal();
      loadIdeas();
    } catch (err) {
      setFormError(err.message || 'Failed to save idea');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this idea?')) return;
    try {
      await api.deleteIdea(id);
      loadIdeas();
    } catch (err) {
      console.error('Failed to delete idea:', err);
    }
  };

  const openCreate = () => {
    setEditingIdea(null);
    setFormData({ title: '', description: '', tags: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (idea) => {
    setEditingIdea(idea);
    setFormData({ title: idea.title, description: idea.description || '', tags: idea.tags || '' });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIdea(null);
    setFormData({ title: '', description: '', tags: '' });
  };

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
          <button className="btn btn-primary" onClick={openCreate}>
            + New Idea
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
          <button className="btn btn-primary" onClick={openCreate}>+ Create Your First Idea</button>
        </div>
      ) : (
        <div className="grid-2">
          {ideas.map((idea, index) => (
            <div
              key={idea.id}
              className="card idea-card animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="idea-card-header">
                <h3 className="idea-title">{idea.title}</h3>
                <div className="idea-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(idea)}><Edit2 size={16} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(idea.id)}><Trash2 size={16} /></button>
                </div>
              </div>
              {idea.description && (
                <p className="idea-description">{idea.description}</p>
              )}
              <div className="idea-footer">
                <div className="idea-tags">
                  {idea.tags?.split(',').map((tag, i) => (
                    tag.trim() && <span key={i} className="tag tag-outline">{tag.trim()}</span>
                  ))}
                </div>
                <span className="idea-date">
                  {new Date(idea.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingIdea ? 'Edit Idea' : 'New Idea'}</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
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
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingIdea ? 'Update' : 'Create'} Idea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
