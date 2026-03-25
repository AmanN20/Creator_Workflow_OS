import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import api from '../services/api';
import './SchedulerPage.css';

export default function SchedulerPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [contentPosts, setContentPosts] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const [scheduled, allPosts] = await Promise.all([
        api.getScheduledPosts(startDate, endDate),
        api.getContentPosts(),
      ]);
      setScheduledPosts(scheduled);
      setContentPosts(allPosts);
    } catch (err) {
      console.error('Failed to load scheduler data:', err);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getDaysInMonth = () => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Empty cells for padding
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }

    return days;
  };

  const getPostsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return scheduledPosts.filter((p) => {
      if (!p.scheduledAt) return false;
      return p.scheduledAt.startsWith(dateStr);
    });
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const handleDayClick = (day) => {
    if (!day) return;
    setSelectedDate(new Date(year, month, day));
    setShowScheduleModal(true);
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!selectedPostId || !selectedDate) return;

    try {
      const scheduledAt = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}T${selectedTime}:00`;
      await api.schedulePost(Number(selectedPostId), scheduledAt);
      setShowScheduleModal(false);
      setSelectedPostId('');
      loadData();
    } catch (err) {
      console.error('Failed to schedule:', err);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = getDaysInMonth();

  return (
    <div className="scheduler-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={28} /> Content Scheduler
          </h1>
          <p className="page-subtitle">Plan and schedule your content calendar</p>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="calendar-nav">
        <button className="btn btn-ghost" onClick={prevMonth} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ChevronLeft size={16} /> Prev
        </button>
        <h2 className="calendar-month-title">{monthNames[month]} {year}</h2>
        <button className="btn btn-ghost" onClick={nextMonth} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Next <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid card">
        <div className="calendar-header-row">
          {dayNames.map((d) => (
            <div key={d} className="calendar-day-name">{d}</div>
          ))}
        </div>

        <div className="calendar-body">
          {days.map((day, index) => {
            const dayPosts = getPostsForDay(day);
            return (
              <div
                key={index}
                className={`calendar-cell ${!day ? 'calendar-cell-empty' : ''} ${isToday(day) ? 'calendar-cell-today' : ''}`}
                onClick={() => handleDayClick(day)}
              >
                {day && (
                  <>
                    <span className="calendar-day-number">{day}</span>
                    <div className="calendar-events">
                      {dayPosts.slice(0, 3).map((post) => (
                        <div key={post.id} className="calendar-event">
                          {post.title.length > 18 ? post.title.substring(0, 18) + '...' : post.title}
                        </div>
                      ))}
                      {dayPosts.length > 3 && (
                        <span className="calendar-more">+{dayPosts.length - 3} more</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={20} /> Upcoming Scheduled Posts
        </h3>
        {scheduledPosts.length > 0 ? (
          <div className="scheduled-list">
            {scheduledPosts.map((post) => (
              <div key={post.id} className="scheduled-item">
                <div>
                  <span className="scheduled-title">{post.title}</span>
                  <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>
                    {new Date(post.scheduledAt).toLocaleString()}
                  </span>
                </div>
                <span className={`status-badge status-${post.status.toLowerCase()}`}>{post.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
            No scheduled posts for this month. Click a day to schedule content.
          </p>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Schedule Content</h2>
              <button className="modal-close" onClick={() => setShowScheduleModal(false)}>×</button>
            </div>
            <form onSubmit={handleSchedule}>
              <div className="form-group">
                <label className="form-label">
                  Date: {selectedDate?.toLocaleDateString()}
                </label>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="schedule-post">Content Item</label>
                <select
                  id="schedule-post"
                  className="form-input"
                  value={selectedPostId}
                  onChange={(e) => setSelectedPostId(e.target.value)}
                  required
                >
                  <option value="">Select a content item...</option>
                  {contentPosts.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} ({p.status})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="schedule-time">Time</label>
                <input
                  id="schedule-time"
                  type="time"
                  className="form-input"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
