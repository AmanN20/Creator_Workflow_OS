import { useState, useEffect } from 'react';
import { FileText, Lightbulb, PenTool, Video, Paintbrush, Rocket } from 'lucide-react';
import api from '../services/api';
import './ContentPage.css';

const STATUSES = ['IDEA', 'SCRIPT', 'RECORDED', 'EDITED', 'POSTED'];
const getStatusIcon = (status, size = 16) => {
  switch(status) {
    case 'IDEA': return <Lightbulb size={size} />;
    case 'SCRIPT': return <PenTool size={size} />;
    case 'RECORDED': return <Video size={size} />;
    case 'EDITED': return <Paintbrush size={size} />;
    case 'POSTED': return <Rocket size={size} />;
    default: return <FileText size={size} />;
  }
};

export default function ContentPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const data = await api.getContentPosts();
      setPosts(data);
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }
    try {
      await api.createContentPost(formData);
      setShowModal(false);
      setFormData({ title: '' });
      loadPosts();
    } catch (err) {
      setFormError(err.message || 'Failed to create');
    }
  };

  const handleStatusChange = async (postId, newStatus) => {
    try {
      await api.updateContentStatus(postId, newStatus);
      loadPosts();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const getNextStatus = (currentStatus) => {
    const idx = STATUSES.indexOf(currentStatus);
    if (idx < STATUSES.length - 1) return STATUSES[idx + 1];
    return null;
  };

  const getProgressWidth = (status) => {
    const idx = STATUSES.indexOf(status);
    return `${((idx + 1) / STATUSES.length) * 100}%`;
  };

  return (
    <div className="content-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={28} /> Content Tracker
          </h1>
          <p className="page-subtitle">Track your content through the production pipeline</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Content
          </button>
        </div>
      </div>

      {/* Pipeline View */}
      <div className="pipeline-header">
        {STATUSES.map((status) => (
          <div key={status} className="pipeline-column-header">
            <span className="pipeline-emoji" style={{ display: 'inline-flex' }}>{getStatusIcon(status, 24)}</span>
            <span className="pipeline-status-name">{status}</span>
            <span className="pipeline-count">
              {posts.filter((p) => p.status === status).length}
            </span>
          </div>
        ))}
      </div>

      {/* Posts List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 20, width: '50%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 10, width: '80%' }} />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <h3>No content items yet</h3>
          <p>Start tracking your content workflow by creating your first item</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Create First Item
          </button>
        </div>
      ) : (
        <div className="content-list">
          {posts.map((post, index) => (
            <div
              key={post.id}
              className="card content-card animate-fade-in"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="content-card-top">
                <div className="content-card-info">
                  <h3 className="content-card-title">{post.title}</h3>
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Updated: {new Date(post.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <span className={`status-badge status-${post.status.toLowerCase()}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {getStatusIcon(post.status, 14)} {post.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="content-progress">
                <div className="content-progress-track">
                  <div
                    className="content-progress-fill"
                    style={{ width: getProgressWidth(post.status) }}
                  />
                </div>
                <div className="content-progress-steps">
                  {STATUSES.map((s) => (
                    <div
                      key={s}
                      className={`content-step ${STATUSES.indexOf(s) <= STATUSES.indexOf(post.status) ? 'content-step-done' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="content-card-actions">
                <select
                  className="form-input"
                  style={{ width: 'auto', padding: '4px 12px', fontSize: '0.8rem' }}
                  value={post.status}
                  onChange={(e) => handleStatusChange(post.id, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {getNextStatus(post.status) && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStatusChange(post.id, getNextStatus(post.status))}
                  >
                    Move to {getNextStatus(post.status)}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Content Item</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="content-title">Title</label>
                <input
                  id="content-title"
                  type="text"
                  className="form-input"
                  placeholder="What content are you creating?"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
