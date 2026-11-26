import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  Clock,
  Info,
} from 'lucide-react';
import { apiRequest } from '../api';
import type { NotificationItem } from '../types';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  loading: boolean;
  token: string;
  onRefresh: () => void;
  onGoToLoans: () => void;
}

export function NotificationsView({
  notifications,
  loading,
  token,
  onRefresh,
  onGoToLoans,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'reminders'>('all');
  const [busy, setBusy] = useState(false);

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'reminders')
      return n.type === 'due_soon' || n.type === 'overdue';
    return true;
  });

  const handleMarkAllRead = async () => {
    setBusy(true);
    try {
      await apiRequest('/api/notifications/read-all', {
        method: 'POST',
        token,
      });
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await apiRequest(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      token,
    });
    onRefresh();
  };

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'due_soon':
        return <Clock className="h-4 w-4 text-amber-600" />;
      case 'new_book':
        return <BookOpen className="h-4 w-4 text-teal-700" />;
      default:
        return <Info className="h-4 w-4 text-slate-600" />;
    }
  };

  const getTypeLabel = (type: NotificationItem['type']) => {
    switch (type) {
      case 'overdue':
        return 'Peringatan Terlambat';
      case 'due_soon':
        return 'Pengingat Tenggat Otomatis';
      case 'loan_created':
        return 'Konfirmasi Peminjaman';
      case 'loan_returned':
        return 'Konfirmasi Pengembalian';
      case 'new_book':
        return 'Koleksi Baru';
      default:
        return 'Informasi Sistem';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Pusat Notifikasi & Pengingat
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pengingat otomatis batas waktu pengembalian buku, konfirmasi sirkulasi, dan pembaruan koleksi baru.
          </p>
        </div>

        <button
          type="button"
          disabled={busy || notifications.every((n) => n.is_read)}
          onClick={handleMarkAllRead}
          className="inline-flex min-h-[40px] items-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto whitespace-nowrap"
        >
          <CheckCheck className="h-4 w-4 text-teal-700" />
          <span>Tandai Semua Dibaca</span>
        </button>
      </div>

      <div className="flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1 w-fit">
        {[
          { id: 'all', label: 'Semua' },
          { id: 'unread', label: 'Belum Dibaca' },
          { id: 'reminders', label: 'Pengingat Tenggat' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as 'all' | 'unread' | 'reminders')}
            className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
            Tidak ada notifikasi pada filter ini
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Pengingat batas waktu pengembalian akan muncul di sini secara otomatis saat masa pinjam mendekati tenggat.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col justify-between gap-4 p-5 transition-colors sm:flex-row sm:items-center ${
                item.is_read ? 'bg-white' : 'bg-teal-50/35'
              }`}
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                    {renderIcon(item.type)}
                    <span>{getTypeLabel(item.type)}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {new Date(item.created_at).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {!item.is_read && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-teal-700">Baru</span>
                    </>
                  )}
                </div>

                <h3 className="font-display text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  {item.message}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {(item.type === 'due_soon' ||
                  item.type === 'overdue' ||
                  item.type === 'loan_created') && (
                  <button
                    type="button"
                    onClick={onGoToLoans}
                    className="inline-flex min-h-[38px] items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Buka Pinjaman
                  </button>
                )}

                {!item.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(item.id)}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Tandai Dibaca</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
