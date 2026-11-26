import { FormEvent, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { apiRequest } from '../api';
import type { AuthStatus, User } from '../types';

interface AuthPortalProps {
  authStatus: AuthStatus | null;
  onAuthenticated: (token: string, user: User) => void;
  onStatusRefresh: () => void;
}

export function AuthPortal({
  authStatus,
  onAuthenticated,
  onStatusRefresh,
}: AuthPortalProps) {
  const [portal, setPortal] = useState<'member' | 'admin'>('member');
  const [memberMode, setMemberMode] = useState<'login' | 'register'>('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFirstTimeAdminSetup =
    portal === 'admin' &&
    authStatus !== null &&
    !authStatus.adminClaimed &&
    !authStatus.usesEnvPasscode;

  const resetFormErrors = () => {
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (portal === 'member') {
        if (memberMode === 'register') {
          const res = await apiRequest<{ token: string; user: User }>(
            '/api/auth/member/register',
            {
              method: 'POST',
              body: { name, email, password },
            }
          );
          onAuthenticated(res.token, res.user);
        } else {
          const res = await apiRequest<{ token: string; user: User }>(
            '/api/auth/member/login',
            {
              method: 'POST',
              body: { email, password },
            }
          );
          onAuthenticated(res.token, res.user);
        }
      } else if (isFirstTimeAdminSetup) {
        const res = await apiRequest<{ token: string; user: User }>(
          '/api/auth/admin/claim',
          {
            method: 'POST',
            body: { name, email, password },
          }
        );
        onStatusRefresh();
        onAuthenticated(res.token, res.user);
      } else if (authStatus?.usesEnvPasscode) {
        const res = await apiRequest<{ token: string; user: User }>(
          '/api/auth/admin/login',
          {
            method: 'POST',
            body: { passcode, email: email || undefined },
          }
        );
        onAuthenticated(res.token, res.user);
      } else {
        const res = await apiRequest<{ token: string; user: User }>(
          '/api/auth/admin/login',
          {
            method: 'POST',
            body: { email, password },
          }
        );
        onAuthenticated(res.token, res.user);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Autentikasi gagal. Periksa kembali data Anda.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 lg:grid-cols-12">
        {/* Left Editorial Sanctuary Showcase */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-slate-900 p-6 text-white sm:p-10 lg:col-span-6 lg:p-14">
          <img
            src="/src/assets/images/library_login_architecture_1795675455247.jpg"
            alt="Ruang baca arsitektur modern Lentera Pustaka"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-slate-950/40"
          />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight text-white">
              Lentera Pustaka
            </span>
          </div>

          <div className="relative z-10 my-10 max-w-xl lg:my-0">
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              Perpustakaan digital terpadu untuk membaca, meminjam, dan mengelola literasi.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-200 sm:text-base">
              Akses peminjaman dan pengembalian buku secara daring, pembaca PDF terintegrasi,
              pengingat tenggat pengembalian otomatis, serta analitik sirkulasi koleksi dalam satu ruang kerja.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums text-white">
                {authStatus?.libraryStats.totalBooks ?? 8}
              </p>
              <p className="mt-1 text-xs text-slate-300">Judul Terkurasi</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums text-white">
                {authStatus?.libraryStats.totalPdfs ?? 8}
              </p>
              <p className="mt-1 text-xs text-slate-300">Berkas PDF Siap Baca</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums text-white">
                {authStatus?.libraryStats.categoriesCount ?? 5}
              </p>
              <p className="mt-1 text-xs text-slate-300">Bidang Literasi</p>
            </div>
          </div>
        </section>

        {/* Right Dual Authentication Portal */}
        <section className="flex items-center justify-center p-6 sm:p-10 lg:col-span-6 lg:p-14">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
                Masuk ke Sistem Pustaka
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Pilih portal akses sesuai peran Anda sebagai Anggota atau Pengelola Perpustakaan.
              </p>
            </div>

            {/* Segmented Portal Selector: Member vs Admin */}
            <div
              role="tablist"
              aria-label="Pilih portal login"
              className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={portal === 'member'}
                onClick={() => {
                  setPortal('member');
                  resetFormErrors();
                }}
                className={`flex min-h-[42px] items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  portal === 'member'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="h-4 w-4 text-teal-700" />
                <span>Portal Anggota</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={portal === 'admin'}
                onClick={() => {
                  setPortal('admin');
                  resetFormErrors();
                }}
                className={`flex min-h-[42px] items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  portal === 'admin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="h-4 w-4 text-teal-700" />
                <span>Portal Admin</span>
              </button>
            </div>

            {/* Member Mode Switcher */}
            {portal === 'member' && (
              <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-medium text-slate-500">
                  {memberMode === 'login'
                    ? 'Sudah memiliki akun anggota?'
                    : 'Buat keanggotaan baru secara instan'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMemberMode(memberMode === 'login' ? 'register' : 'login');
                    resetFormErrors();
                  }}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline whitespace-nowrap"
                >
                  {memberMode === 'login' ? 'Daftar Anggota' : 'Masuk Anggota'}
                </button>
              </div>
            )}

            {/* Admin Context Banner */}
            {portal === 'admin' && (
              <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
                {isFirstTimeAdminSetup ? (
                  <div>
                    <p className="font-semibold text-slate-900">
                      Aktivasi Admin Pertama Kali
                    </p>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      Belum ada akun pengelola terdaftar. Buat akun Admin utama Anda di bawah ini untuk mengakses fitur unggah PDF dan manajemen sirkulasi.
                    </p>
                  </div>
                ) : authStatus?.usesEnvPasscode ? (
                  <div>
                    <p className="font-semibold text-slate-900">
                      Autentikasi Pengelola Terproteksi
                    </p>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      Masukkan kode akses Admin yang dikonfigurasi pada server untuk membuka dashboard pengelola.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-slate-900">
                      Akses Khusus Pustakawan / Admin
                    </p>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      Masuk menggunakan akun pengelola terdaftar untuk mengunggah koleksi PDF dan mengatur notifikasi pengingat.
                    </p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {((portal === 'member' && memberMode === 'register') ||
                isFirstTimeAdminSetup) && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Nama Lengkap
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      portal === 'admin' ? 'Contoh: Pustakawan Utama' : 'Contoh: Raka Pratama'
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                  />
                </div>
              )}

              {!(portal === 'admin' && authStatus?.usesEnvPasscode) && (
                <div>
                  <label
                    htmlFor="auth-email"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Alamat Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@domain.id"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                  />
                </div>
              )}

              {portal === 'admin' && authStatus?.usesEnvPasscode ? (
                <>
                  <div>
                    <label
                      htmlFor="auth-admin-email"
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Email Pengelola (Opsional)
                    </label>
                    <input
                      id="auth-admin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@lenterapustaka.id"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="auth-passcode"
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Kode Akses Admin
                    </label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        id="auth-passcode"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Masukkan kode akses admin"
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Tampilkan atau sembunyikan kode"
                        className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label
                    htmlFor="auth-password"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={portal === 'admin' ? 8 : 6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        portal === 'admin' ? 'Minimal 8 karakter' : 'Minimal 6 karakter'
                      }
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Tampilkan atau sembunyikan kata sandi"
                      className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>
                  {submitting
                    ? 'Memverifikasi...'
                    : portal === 'member'
                    ? memberMode === 'register'
                      ? 'Daftar & Masuk sebagai Anggota'
                      : 'Masuk sebagai Anggota'
                    : isFirstTimeAdminSetup
                    ? 'Klaim & Aktifkan Akun Admin'
                    : 'Masuk ke Dashboard Admin'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
