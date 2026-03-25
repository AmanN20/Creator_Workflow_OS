import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Lightbulb, PenTool, FileText, Calendar, TrendingUp, Zap } from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { path: '/ideas', label: 'Ideas', icon: <Lightbulb size={20} /> },
  { path: '/scripts', label: 'Script Editor', icon: <PenTool size={20} /> },
  { path: '/content', label: 'Content', icon: <FileText size={20} /> },
  { path: '/scheduler', label: 'Scheduler', icon: <Calendar size={20} /> },
  { path: '/analytics', label: 'Analytics', icon: <TrendingUp size={20} /> },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-icon"><Zap size={24} /></span>
          <div className="logo-text">
            <h1>Creator OS</h1>
            <span className="logo-subtitle">Workflow Platform</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span className="sidebar-link-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-username">{user?.username || 'User'}</span>
            <span className="sidebar-email">{user?.email || ''}</span>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm sidebar-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
