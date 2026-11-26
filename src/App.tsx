import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Library,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from './api';
import { AuthPortal } from './components/AuthPortal';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { CatalogView } from './components/CatalogView';
import { LoansView } from './components/LoansView';
import { NotificationsView } from './components/NotificationsView';
import { AdminConsoleView } from './components/AdminConsoleView';
import { PdfReaderModal } from './components/PdfReaderModal';
import type {
  AnalyticsData,
  AuthStatus,
  Book,
  Loan,
  NotificationItem,
  User,
} from './types';

type ActiveTab = 'dashboard' | 'catalog' | 'loans' | 'notifications' | 'admin';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [pdfModal, setPdfModal] = useState<{ bookId: string; title: string } | null>(
    null
  );
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (message: string, tone: 'success' | 'error' = 'success') => {
      setToast({ message, tone });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const status = await apiRequest<AuthStatus>('/api/auth/status');
      setAuthStatus(status);
    } catch {
      // ignore initial status fetch error
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
  }, [fetchAuthStatus]);

  const refreshWorkspace = useCallback(async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      const [booksRes, loansRes, notifRes, analyticsRes] = await Promise.all([
        apiRequest<{ books: Book[] }>('/api/books', { token }),
        apiRequest<{ loans: Loan[] }>('/api/loans', { token }),
        apiRequest<{ notifications: NotificationItem[] }>('/api/notifications', {
          token,
        }),
        apiRequest<AnalyticsData>('/api/analytics', { token }),
      ]);
      setBooks(booksRes.books);
      setLoans(loansRes.loans);
      setNotifications(notifRes.notifications);
      setAnalytics(analyticsRes);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal memuat data perpustakaan.',
        'error'
      );
    } finally {
      setLoadingData(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    if (token) {
      refreshWorkspace();
    }
  }, [token, refreshWorkspace]);

  // Periodic background poll for automated due-date reminder notifications
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const notifRes = await apiRequest<{ notifications: NotificationItem[] }>(
          '/api/notifications',
          { token }
        );
        setNotifications(notifRes.notifications);
      } catch {
        // silent poll
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleAuthenticated = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setActiveTab(newUser.role === 'admin' ? 'dashboard' : 'dashboard');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setBooks([]);
    setLoans([]);
    setNotifications([]);
    setAnalytics(null);
    setActiveTab('dashboard');
    fetchAuthStatus();
  };

  if (!token || !user) {
    return (
      <AuthPortal
        authStatus={authStatus}
        onAuthenticated={handleAuthenticated}
        onStatusRefresh={fetchAuthStatus}
      />
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: typeof BarChart3;
    badge?: number;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      shortLabel: 'Beranda',
      icon: BarChart3,
    },
    {
      id: 'catalog',
      label: 'Katalog Buku',
      shortLabel: 'Katalog',
      icon: Library,
    },
    {
      id: 'loans',
      label: 'Pinjaman Saya',
      shortLabel: 'Pinjaman',
      icon: BookMarked,
    },
    {
      id: 'notifications',
      label: 'Notifikasi',
      shortLabel: 'Notifikasi',
      icon: Bell,
      badge: unreadCount,
    },
  ];

  if (user.role === 'admin') {
    navItems.push({
      id: 'admin',
      label: 'Admin & Upload PDF',
      shortLabel: 'Admin',
      icon: ShieldCheck,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white lg:flex">
          <div>
            <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="font-display text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap">
                Lentera Pustaka
              </span>
            </div>

            <nav aria-label="Menu utama" className="space-y-1 p-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex min-h-[42px] w-full items-center justify-between rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-teal-50 text-teal-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-3 whitespace-nowrap">
                      <Icon
                        className={`h-4 w-4 ${
                          active ? 'text-teal-700' : 'text-slate-500'
                        }`}
                      />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="font-mono text-xs font-semibold tabular-nums text-teal-800">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-slate-200 p-4">
            <div className="mb-3 px-2">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {user.role === 'admin' ? 'Admin Pustakawan' : 'Anggota'} ·{' '}
                <span className="font-mono">{user.memberCode}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4 text-slate-500" />
              <span>Keluar Sesi</span>
            </button>
          </div>
        </aside>

        {/* Main Viewport */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 3-Zone Top Header */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:h-16 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white">
                <BookOpen className="h-3.5 w-3.5" />
              </div>
              <span className="truncate font-display text-base font-semibold text-slate-900">
                Lentera Pustaka
              </span>
            </div>

            <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 lg:flex">
              <span>Perpustakaan Digital</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900">
                {navItems.find((n) => n.id === activeTab)?.label}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                aria-label="Buka notifikasi pengingat"
                className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Bell className="h-4 w-4 text-slate-600" />
                <span className="hidden sm:inline">Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="font-mono text-xs font-semibold tabular-nums text-red-700">
                    ({unreadCount})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 lg:hidden"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar</span>
              </button>
            </div>
          </header>

          {/* Content Container */}
          <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-10">
            {activeTab === 'dashboard' && (
              <DashboardAnalytics
                data={analytics}
                loading={loadingData && !analytics}
                role={user.role}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'catalog' && (
              <CatalogView
                books={books}
                loading={loadingData && books.length === 0}
                token={token}
                role={user.role}
                onRefresh={refreshWorkspace}
                onOpenPdf={(bookId, title) => setPdfModal({ bookId, title })}
                onNotifyToast={showToast}
              />
            )}

            {activeTab === 'loans' && (
              <LoansView
                loans={loans}
                loading={loadingData && loans.length === 0}
                token={token}
                onRefresh={refreshWorkspace}
                onOpenPdf={(bookId, title) => setPdfModal({ bookId, title })}
                onGoToCatalog={() => setActiveTab('catalog')}
                onNotifyToast={showToast}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsView
                notifications={notifications}
                loading={loadingData && notifications.length === 0}
                token={token}
                onRefresh={refreshWorkspace}
                onGoToLoans={() => setActiveTab('loans')}
              />
            )}

            {activeTab === 'admin' && user.role === 'admin' && (
              <AdminConsoleView
                books={books}
                token={token}
                onRefreshAll={refreshWorkspace}
                onOpenPdf={(bookId, title) => setPdfModal({ bookId, title })}
                onNotifyToast={showToast}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (compact height <= 56px to respect 15% sticky cap) */}
      <nav
        aria-label="Navigasi seluler"
        className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-slate-200 bg-white px-1 lg:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium transition-colors ${
                active ? 'text-teal-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.shortLabel}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="absolute right-2 top-1 font-mono text-[10px] font-bold tabular-nums text-red-600">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* PDF Reader Modal */}
      {pdfModal && (
        <PdfReaderModal
          bookId={pdfModal.bookId}
          bookTitle={pdfModal.title}
          token={token}
          onClose={() => setPdfModal(null)}
        />
      )}

      {/* Feedback Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-16 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-xs font-semibold shadow-lg lg:bottom-6 ${
            toast.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
