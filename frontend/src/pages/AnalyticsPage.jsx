import { useState, useEffect } from 'react';
import { TrendingUp, RefreshCcw, Lightbulb, FileText, Rocket, Activity, CheckCircle, ArrowDown } from 'lucide-react';
import api from '../services/api';
import './AnalyticsPage.css';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const data = await api.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={28} /> Analytics
            </h1>
            <p className="page-subtitle">Loading your insights...</p>
          </div>
        </div>
        <div className="grid-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 48, width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxWeeklyValue = analytics?.weeklyActivity
    ? Math.max(...Object.values(analytics.weeklyActivity), 1)
    : 1;

  const maxStatusValue = analytics?.statusBreakdown
    ? Math.max(...Object.values(analytics.statusBreakdown), 1)
    : 1;

  const completionRate = analytics?.totalPosts > 0
    ? Math.round((analytics.completedPosts / analytics.totalPosts) * 100)
    : 0;

  return (
    <div className="analytics-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={28} /> Analytics
          </h1>
          <p className="page-subtitle">Track your content creation performance</p>
        </div>
        <button className="btn btn-secondary" onClick={loadAnalytics} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid-4 analytics-overview">
        <div className="card analytics-stat-card">
          <div className="analytics-stat-header">
            <span className="analytics-stat-icon"><Lightbulb size={24} /></span>
            <span className="analytics-stat-trend">Total</span>
          </div>
          <span className="analytics-stat-value">{analytics?.totalIdeas || 0}</span>
          <span className="analytics-stat-label">Ideas Created</span>
        </div>

        <div className="card analytics-stat-card">
          <div className="analytics-stat-header">
            <span className="analytics-stat-icon"><FileText size={24} /></span>
            <span className="analytics-stat-trend">Total</span>
          </div>
          <span className="analytics-stat-value">{analytics?.totalPosts || 0}</span>
          <span className="analytics-stat-label">Content Items</span>
        </div>

        <div className="card analytics-stat-card">
          <div className="analytics-stat-header">
            <span className="analytics-stat-icon"><Rocket size={24} /></span>
            <span className="analytics-stat-trend">Published</span>
          </div>
          <span className="analytics-stat-value">{analytics?.completedPosts || 0}</span>
          <span className="analytics-stat-label">Posts Completed</span>
        </div>

        <div className="card analytics-stat-card">
          <div className="analytics-stat-header">
            <span className="analytics-stat-icon"><Activity size={24} /></span>
            <span className="analytics-stat-trend">Rate</span>
          </div>
          <span className="analytics-stat-value">{completionRate}%</span>
          <span className="analytics-stat-label">Completion Rate</span>
        </div>
      </div>

      <div className="analytics-charts">
        {/* Weekly Activity Bar Chart */}
        <div className="card analytics-chart-card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} /> Weekly Activity
          </h3>
          <div className="bar-chart">
            {analytics?.weeklyActivity && Object.entries(analytics.weeklyActivity).map(([day, count]) => (
              <div key={day} className="bar-chart-col">
                <span className="bar-chart-value">{count}</span>
                <div className="bar-chart-bar-wrapper">
                  <div
                    className="bar-chart-bar"
                    style={{ height: `${(count / maxWeeklyValue) * 100}%` }}
                  />
                </div>
                <span className="bar-chart-label">{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="card analytics-chart-card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} /> Content Pipeline
          </h3>
          <div className="horizontal-bars">
            {analytics?.statusBreakdown && Object.entries(analytics.statusBreakdown).map(([status, count]) => (
              <div key={status} className="h-bar-row">
                <div className="h-bar-info">
                  <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>
                  <span className="h-bar-count">{count}</span>
                </div>
                <div className="h-bar-track">
                  <div
                    className={`h-bar-fill bar-${status.toLowerCase()}`}
                    style={{ width: `${(count / maxStatusValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Completion Donut (CSS-based) */}
        <div className="card analytics-chart-card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} /> Completion Overview
          </h3>
          <div className="donut-container">
            <div
              className="donut"
              style={{
                background: `conic-gradient(var(--color-primary) ${completionRate * 3.6}deg, var(--color-background) 0deg)`
              }}
            >
              <div className="donut-inner">
                <span className="donut-value">{completionRate}%</span>
                <span className="donut-label">Complete</span>
              </div>
            </div>
            <div className="donut-legend">
              <div className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--color-primary)' }} />
                <span>Published ({analytics?.completedPosts || 0})</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--color-background)' }} />
                <span>In Progress ({(analytics?.totalPosts || 0) - (analytics?.completedPosts || 0)})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ideas vs Posts */}
        <div className="card analytics-chart-card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lightbulb size={20} /> Ideas → Posts Funnel
          </h3>
          <div className="funnel">
            <div className="funnel-stage">
              <div className="funnel-bar" style={{ width: '100%' }}>
                <span>Ideas: {analytics?.totalIdeas || 0}</span>
              </div>
            </div>
            <div className="funnel-arrow"><ArrowDown size={16} /></div>
            <div className="funnel-stage">
              <div
                className="funnel-bar funnel-bar-mid"
                style={{
                  width: analytics?.totalIdeas > 0
                    ? `${Math.max((analytics.totalPosts / analytics.totalIdeas) * 100, 20)}%`
                    : '20%'
                }}
              >
                <span>Posts: {analytics?.totalPosts || 0}</span>
              </div>
            </div>
            <div className="funnel-arrow"><ArrowDown size={16} /></div>
            <div className="funnel-stage">
              <div
                className="funnel-bar funnel-bar-end"
                style={{
                  width: analytics?.totalIdeas > 0
                    ? `${Math.max((analytics.completedPosts / analytics.totalIdeas) * 100, 15)}%`
                    : '15%'
                }}
              >
                <span>Done: {analytics?.completedPosts || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
