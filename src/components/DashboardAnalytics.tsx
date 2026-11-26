import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  BookCheck,
  BookOpen,
  Clock,
  FileText,
} from 'lucide-react';
import type { AnalyticsData, UserRole } from '../types';

interface DashboardAnalyticsProps {
  data: AnalyticsData | null;
  loading: boolean;
  role: UserRole;
  onNavigate: (tab: 'catalog' | 'loans' | 'notifications' | 'admin') => void;
}

export function DashboardAnalytics({
  data,
  loading,
  role,
  onNavigate,
}: DashboardAnalyticsProps) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-7" />
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-5" />
        </div>
      </div>
    );
  }

  const { kpis, monthlyTrend, categoryBreakdown, topBooks } = data;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Ringkasan & Visualisasi Peminjaman
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pantau sirkulasi koleksi literasi, kepatuhan pengembalian, dan aktivitas pembaca secara real-time.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('catalog')}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap"
          >
            <span>Jelajahi Katalog</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <span>Unggah PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Koleksi Buku</span>
            <BookOpen className="h-4 w-4 text-teal-700" />
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-slate-900">
            {kpis.totalTitles}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {kpis.totalPdfs} koleksi dilengkapi berkas PDF
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Sedang Dipinjam Aktif</span>
            <Clock className="h-4 w-4 text-slate-700" />
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-slate-900">
            {kpis.activeLoans}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Total sirkulasi tercatat {kpis.totalCirculation} transaksi
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pengembalian Tepat Waktu</span>
            <BookCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-emerald-700">
            {kpis.onTimeRate}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Berdasarkan riwayat pengembalian anggota
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Perlu Pengembalian Segera</span>
            <AlertTriangle
              className={`h-4 w-4 ${
                kpis.overdueLoans > 0 ? 'text-red-600' : 'text-amber-600'
              }`}
            />
          </div>
          <p
            className={`mt-3 font-mono text-3xl font-semibold tabular-nums ${
              kpis.overdueLoans > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {kpis.overdueLoans}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Pengingat otomatis aktif H-{Math.round(data.reminderLeadHours / 24)} hari
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Monthly Borrowing & Return Trend */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Tren Peminjaman & Pengembalian
              </h2>
              <p className="text-xs text-slate-500">
                Perbandingan volume peminjaman, pengembalian, dan ketepatan waktu 6 bulan terakhir
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-teal-700" />
                Peminjaman
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-slate-800" />
                Pengembalian
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyTrend}
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradPinjam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="gradKembali" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e293b" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#1e293b" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="peminjaman"
                  name="Peminjaman"
                  stroke="#0f766e"
                  strokeWidth={2.2}
                  fill="url(#gradPinjam)"
                />
                <Area
                  type="monotone"
                  dataKey="pengembalian"
                  name="Pengembalian"
                  stroke="#1e293b"
                  strokeWidth={2}
                  fill="url(#gradKembali)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Category Distribution Bar Chart */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Distribusi Kategori Literasi
            </h2>
            <p className="text-xs text-slate-500">
              Jumlah judul tersedia dibandingkan minat peminjaman per kategori
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryBreakdown}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={108}
                  tick={{ fill: '#334155', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="totalBooks"
                  name="Jumlah Judul"
                  fill="#0f766e"
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                />
                <Bar
                  dataKey="loanCount"
                  name="Pinjaman Aktif/Riwayat"
                  fill="#64748b"
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Top Collections Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Koleksi Literasi Utama & Ketersediaan
            </h2>
            <p className="text-xs text-slate-500">
              Daftar judul buku paling diminati beserta sisa kuota salinan daring
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('catalog')}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline self-start sm:self-auto whitespace-nowrap"
          >
            Lihat Semua Koleksi
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3">Judul Buku</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Ketersediaan</th>
                <th className="px-6 py-3 text-right">Total Dipinjam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {topBooks.map((book) => (
                <tr key={book.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{book.title}</p>
                        <p className="text-xs text-slate-500">{book.author}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">{book.category}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums text-slate-700">
                    {book.available_copies} / {book.total_copies} salinan
                  </td>
                  <td className="px-6 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                    {book.borrow_count}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
