import './globals.css';
import CompanySidebar from '../components/Sidebar';

export const metadata = {
  title: 'Company Portal — Rupadiya Fleet & Operations',
  description: 'Manage franchise fleet, assign drivers, schedule intercity trips, and track passenger targets.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#090D16] text-slate-100 flex min-h-screen">
        <CompanySidebar />
        <main className="flex-1 overflow-y-auto min-h-screen bg-[#090D16] p-6 sm:p-10">
          {children}
        </main>
      </body>
    </html>
  );
}

