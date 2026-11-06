import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { alertService } from '../../services/swal.js';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Building2,
  Activity,
  ShieldCheck,
  KeyRound,
  LogOut,
  Globe,
  Menu,
  X,
  FileText,
  GitBranch,
  QrCode,
  FileBarChart,
  Database,
  Building,
  Lock,
  ChevronRight,
  TrendingUp,
  Briefcase,
  Layers,
  Bell,
  CheckCheck,
} from 'lucide-react';

interface LayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  children: React.ReactNode;
}

export const EnterpriseLayout: React.FC<LayoutProps> = ({
  currentTab,
  onSelectTab,
  children,
}) => {
  const { user, logout, language, setLanguage, t, fetchWithAuth } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const isSuperAdmin = user?.roles.includes('SUPER_ADMIN');

  // Load notifications from database
  const loadNotifications = async () => {
    try {
      const res = await fetchWithAuth('/api/workflows/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {}
  };

  // Real-Time WebSocket connection
  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const token = localStorage.getItem('lhse_session_token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    let socket: WebSocket | null = null;
    let isMounted = true;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        // Authenticate socket session
        socket?.send(JSON.stringify({ type: 'AUTH', token }));
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'NOTIFICATION_RECEIVED' && msg.notification) {
            setNotifications(prev => [msg.notification, ...prev]);
            setUnreadCount(c => c + 1);

            const notifTitle = language === 'lo' ? msg.notification.title_lo : msg.notification.title_en;
            const notifMsg = language === 'lo' ? msg.notification.message_lo : msg.notification.message_en;
            alertService.toast('info', `${notifTitle}: ${notifMsg}`);
          } else if (msg.type === 'CONNECTED' || msg.type === 'AUTHENTICATED') {
            if (typeof msg.unreadCount === 'number') {
              setUnreadCount(msg.unreadCount);
            }
          }
        } catch (err) {}
      };

      socket.onerror = () => {};
    } catch (e) {}

    // Close popover when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      isMounted = false;
      document.removeEventListener('mousedown', handleClickOutside);
      if (socket) socket.close();
    };
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await fetchWithAuth('/api/workflows/notifications/read-all', { method: 'POST' });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {}
  };

  const navGroups = [
    {
      title: language === 'lo' ? 'ເອກະສານ & ສາຍງານ (Core E-Doc)' : 'Document Operations',
      items: [
        {
          id: 'documents',
          label: t.navDocuments,
          icon: FileText,
          badge: 'Phase 3',
        },
        {
          id: 'workflows',
          label: t.navWorkflows,
          icon: GitBranch,
          badge: 'Phase 4',
        },
        {
          id: 'signatures',
          label: t.navSignatures,
          icon: QrCode,
          badge: 'Phase 5',
        },
        {
          id: 'reports',
          label: t.navReports,
          icon: FileBarChart,
          badge: 'Phase 6',
        },
      ],
    },
    {
      title: language === 'lo' ? 'ແດຊບອດ & ພາບລວມ' : 'Dashboards & KPIs',
      items: [
        {
          id: 'dashboard',
          label: t.navDashboard,
          icon: LayoutDashboard,
          badge: null,
        },
        {
          id: 'executive-dashboard',
          label: t.navExecDashboard,
          icon: TrendingUp,
          badge: 'Recharts',
        },
        {
          id: 'department-dashboard',
          label: t.navDeptDashboard,
          icon: Building,
          badge: 'Dept',
        },
      ],
    },
    {
      title: language === 'lo' ? 'ໂຄງຮ່າງອົງກອນ & ບຸກຄະລາກອນ' : 'Organization & Staff',
      items: [
        {
          id: 'org-tree',
          label: t.navOrgTree,
          icon: Layers,
          badge: '3-Tier',
        },
        {
          id: 'positions',
          label: t.navPositions,
          icon: Briefcase,
          badge: 'Roles',
        },
        {
          id: 'users',
          label: t.navUsers,
          icon: Users,
          badge: 'RBAC',
        },
        {
          id: 'departments',
          label: t.navDepartments,
          icon: Building2,
          badge: '5 Depts',
        },
        {
          id: 'organization',
          label: t.navOrgProfile,
          icon: Building2,
          badge: 'LHSE',
        },
      ],
    },
    {
      title: language === 'lo' ? 'ຄວາມປອດໄພ & ການກວດສອບ' : 'Security & Compliance',
      items: [
        {
          id: 'audit',
          label: t.navAudit,
          icon: Activity,
          badge: 'Ledger',
        },
        {
          id: 'backup',
          label: t.navBackup,
          icon: Database,
          badge: 'D1/R2 DR',
        },
        {
          id: 'tests',
          label: t.navSecurityTest,
          icon: ShieldCheck,
          badge: 'Automated',
        },
        {
          id: 'security',
          label: t.navSecuritySettings,
          icon: KeyRound,
          badge: user?.mfa_enabled ? 'MFA ON' : 'MFA OFF',
        },
        ...(isSuperAdmin ? [{
          id: 'auth-diagnostics',
          label: language === 'lo' ? 'ວິນິດໄສການເຂົ້າລະບົບ' : 'Auth Diagnostics',
          icon: ShieldAlert,
          badge: 'Live',
        }] : []),
      ],
    },
  ];

  const allNavItems = navGroups.flatMap(g => g.items);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-slate-900 border-r border-slate-800 text-white shrink-0">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 border border-blue-400/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white line-clamp-1">
                {language === 'lo' ? 'ລັດວິສາຫະກິດຖືຮຸ້ນລາວ' : 'Lao State Enterprise Holding'}
              </h2>
              <span className="text-[10px] text-blue-400 font-mono font-bold uppercase tracking-wider block">
                Smart E-Doc-LHSE-V01
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-sans leading-tight">
            ຖະໜົນລ້ານຊ້າງ, ບ້ານຫັດສະດີ, ເມືອງຈັນທະບູລີ, ນະຄອນຫຼວງວຽງຈັນ
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx}>
              <div className="text-[10px] uppercase font-bold text-slate-400 px-3 mb-2 tracking-wider">
                {group.title}
              </div>
              <nav className="space-y-1">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-blue-800 text-blue-100'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* User Card at bottom */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {user?.full_name_lo.substring(0, 1) || 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="font-semibold text-xs text-slate-200 truncate">
                  {language === 'lo' ? user?.full_name_lo : user?.full_name_en}
                </div>
                <div className="text-[10px] text-blue-400 font-mono truncate">
                  {user?.roles[0]}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title={t.navLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-900">
                {t.orgName} • {t.appSubName}
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                {t.timezoneNotice}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Department Scoping Pill */}
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <Building className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {isSuperAdmin
                  ? (language === 'lo' ? 'ສິດທິອົງກອນສູນກາງ (Super Admin)' : 'Central Org Scope')
                  : `${user?.dept_name_lo || 'ພະແນກ'} (${user?.dept_code})`}
              </span>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setLanguage('lo')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  language === 'lo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ລາວ
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                EN
              </button>
            </div>

            {/* Real-Time Notification Bell Popover */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                title={language === 'lo' ? 'ການແຈ້ງເຕືອນແບບ Real-Time' : 'Real-Time Alerts'}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Popover */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-fadeIn text-xs">
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                      <Bell className="w-3.5 h-3.5 text-blue-600" />
                      <span>{language === 'lo' ? 'ການແຈ້ງເຕືອນ Real-Time' : 'Live Notifications'}</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono text-[10px] font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center space-x-1 cursor-pointer font-medium"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>{language === 'lo' ? 'ອ່ານທັງໝົດ' : 'Mark all read'}</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">
                        {language === 'lo' ? 'ບໍ່ມີການແຈ້ງເຕືອນໃໝ່' : 'No notifications yet'}
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n: any) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            setShowNotifDropdown(false);
                            if (n.entity_type === 'DOCUMENT') onSelectTab('workflows');
                          }}
                          className={`p-3 hover:bg-slate-50 transition cursor-pointer ${
                            !n.is_read ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-900 truncate">
                              {language === 'lo' ? n.title_lo : n.title_en}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {n.created_at?.split('T')[0] || 'Today'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2">
                            {language === 'lo' ? n.message_lo : n.message_en}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Mini Badge */}
            <button
              onClick={() => onSelectTab('security')}
              className="flex items-center space-x-2 pl-2 border-l border-slate-200 hover:opacity-80 transition"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                {user?.full_name_lo.substring(0, 1) || 'U'}
              </div>
            </button>
          </div>
        </header>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 text-white p-4 space-y-2 border-b border-slate-800 animate-fadeIn">
            {allNavItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={logout}
              className="w-full flex items-center space-x-3 p-2.5 rounded-xl text-xs font-medium text-red-400 hover:bg-slate-800 pt-3 border-t border-slate-800"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.navLogout}</span>
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
