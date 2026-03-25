import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lightbulb, FileText, CheckCircle, Flame, BrainCircuit, Activity, Clock } from 'lucide-react';
import api from '../services/api';
import './DashboardPage.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [analyticsData, recData, postsData] = await Promise.all([
        api.getAnalytics(),
        api.getRecommendation(),
        api.getContentPosts(),
      ]);
      setAnalytics(analyticsData);
      setRecommendation(recData);
      setRecentPosts(postsData.slice(0, 5));
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    return `status-badge status-${status?.toLowerCase()}`;
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Loading your workspace...</p>
          </div>
        </div>
        <div className="grid-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card stat-card">
              <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 36, width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Welcome back, {user?.username}
          </h1>
          <p className="page-subtitle">Here's what's happening with your content</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/ideas')}>
            + New Idea
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid-4 dashboard-stats">
        <div className="card stat-card">
          <span className="stat-icon"><Lightbulb size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Total Ideas</span>
            <span className="stat-value">{analytics?.totalIdeas || 0}</span>
          </div>
        </div>
        <div className="card stat-card">
          <span className="stat-icon"><FileText size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Total Posts</span>
            <span className="stat-value">{analytics?.totalPosts || 0}</span>
          </div>
        </div>
        <div className="card stat-card">
          <span className="stat-icon"><CheckCircle size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{analytics?.completedPosts || 0}</span>
          </div>
        </div>
        <div className="card stat-card">
          <span className="stat-icon"><Flame size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Completion Rate</span>
            <span className="stat-value">
              {analytics?.totalPosts > 0
                ? Math.round((analytics.completedPosts / analytics.totalPosts) * 100)
                : 0}%
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recommendation Card */}
        <div className="card recommendation-card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BrainCircuit size={20} /> AI Recommendation
          </h3>
          {recommendation ? (
            <div className="recommendation-content">
              <p className="recommendation-message">{recommendation.message}</p>
              <div className="recommendation-meta">
                <span className={`tag ${recommendation.urgency === 'CRITICAL' ? '' : 'tag-outline'}`}>
                  {recommendation.urgency}
                </span>
                {recommendation.suggestedContentType && (
                  <span className="tag tag-outline">
                    Try: {recommendation.suggestedContentType}
                  </span>
                )}
              </div>
              {recommendation.suggestedTags?.length > 0 && (
                <div className="recommendation-tags">
                  <span className="rec-tags-label">Trending topics:</span>
                  {recommendation.suggestedTags.map((tag, i) => (
                    <span key={i} className="tag tag-outline">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted">Start creating content to get personalized recommendations!</p>
          )}
        </div>

        {/* Workflow Progress */}
        <div className="card workflow-card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} /> Workflow Progress
          </h3>
          {analytics?.statusBreakdown && (
            <div className="workflow-bars">
              {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
                <div key={status} className="workflow-bar-row">
                  <div className="workflow-bar-label">
                    <span className={getStatusClass(status)}>{status}</span>
                    <span className="workflow-bar-count">{count}</span>
                  </div>
                  <div className="workflow-bar-track">
                    <div
                      className={`workflow-bar-fill bar-${status.toLowerCase()}`}
                      style={{
                        width: `${analytics.totalPosts > 0
                          ? (count / analytics.totalPosts) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card recent-card">
          <div className="card-header-row">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} /> Recent Activity
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/content')}>
              View All
            </button>
          </div>
          {recentPosts.length > 0 ? (
            <div className="recent-list">
              {recentPosts.map((post) => (
                <div key={post.id} className="recent-item">
                  <div className="recent-item-info">
                    <span className="recent-item-title">{post.title}</span>
                    <span className="recent-item-date">
                      {new Date(post.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className={getStatusClass(post.status)}>{post.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted" style={{ padding: '24px 0', textAlign: 'center' }}>
              No content posts yet. Create your first idea!
            </p>
          )}
        </div>

        {/* Weekly Activity */}
        <div className="card weekly-card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} /> Weekly Activity
          </h3>
          {analytics?.weeklyActivity && (
            <div className="weekly-chart">
              {Object.entries(analytics.weeklyActivity).map(([day, count]) => (
                <div key={day} className="weekly-bar-col">
                  <div className="weekly-bar-wrapper">
                    <div
                      className="weekly-bar"
                      style={{
                        height: `${Math.max(count * 20, 4)}px`
                      }}
                    />
                  </div>
                  <span className="weekly-day">{day}</span>
                  <span className="weekly-count">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
