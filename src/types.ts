export type UserRole = 'member' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  memberCode: string;
}

export interface AuthStatus {
  adminClaimed: boolean;
  usesEnvPasscode: boolean;
  libraryStats: {
    totalBooks: number;
    totalPdfs: number;
    categoriesCount: number;
  };
}

export interface ActiveBookLoan {
  id: string;
  book_id: string;
  status: 'borrowed' | 'overdue';
  due_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  published_year: number;
  pages: number;
  total_copies: number;
  available_copies: number;
  description: string;
  cover_url: string | null;
  has_pdf: boolean;
  pdf_original_name: string | null;
  pdf_size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
  active_loan: ActiveBookLoan | null;
}

export interface Loan {
  id: string;
  book_id: string;
  user_id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  status: 'borrowed' | 'returned' | 'overdue';
  book_title: string;
  book_author: string;
  book_category: string;
  book_cover_url: string | null;
  has_pdf: boolean;
}

export interface AdminLoan {
  id: string;
  book_id: string;
  user_id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  status: 'borrowed' | 'returned' | 'overdue';
  reminder_sent_h2: number;
  reminder_sent_overdue: number;
  book_title: string;
  book_category: string;
  member_name: string;
  member_email: string;
  member_code: string;
}

export interface NotificationItem {
  id: string;
  loan_id: string | null;
  book_id: string | null;
  type: 'due_soon' | 'overdue' | 'loan_created' | 'loan_returned' | 'new_book' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ReminderLog {
  id: string;
  type: 'due_soon' | 'overdue';
  title: string;
  message: string;
  created_at: string;
  member_name: string;
  member_code: string;
}

export interface AnalyticsData {
  kpis: {
    totalTitles: number;
    totalPdfs: number;
    activeLoans: number;
    overdueLoans: number;
    totalCirculation: number;
    onTimeRate: number;
    registeredMembers: number;
  };
  monthlyTrend: Array<{
    month: string;
    peminjaman: number;
    pengembalian: number;
    tepatWaktu: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    totalBooks: number;
    loanCount: number;
  }>;
  topBooks: Array<{
    id: string;
    title: string;
    author: string;
    category: string;
    available_copies: number;
    total_copies: number;
    borrow_count: number;
  }>;
  reminderLeadHours: number;
  lastSweepAt: string;
}
