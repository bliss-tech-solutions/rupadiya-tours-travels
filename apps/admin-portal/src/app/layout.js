import './globals.css';
import AdminSidebar from '../components/Sidebar';

export const metadata = {
  title: 'Super Admin Portal — Rupadiya Platform HQ',
  description: 'Control all 33 franchise companies, Hub-and-Spoke corridors, tour packages, master bookings, and compliance.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#030712] text-slate-100 flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto min-h-screen bg-[#030712] p-6 sm:p-10">
          {children}
        </main>
      </body>
    </html>
  );
}

