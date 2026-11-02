import './globals.css';
import AdminLayoutShell from '../components/AdminLayoutShell';

export const metadata = {
  title: 'Super Admin Portal — Rupadiya Platform HQ',
  description: 'Control all 34 franchise companies (Passenger Ranking), Hub-and-Spoke corridors, tour packages, master bookings, and compliance.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-900 min-h-screen">
        <AdminLayoutShell>
          {children}
        </AdminLayoutShell>
      </body>
    </html>
  );
}
