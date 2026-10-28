import './globals.css';
import CompanyLayoutShell from '../components/CompanyLayoutShell';

export const metadata = {
  title: 'Company Portal — Rupadiya Fleet & Operations',
  description: 'Manage franchise fleet, assign drivers, schedule intercity trips, and track passenger targets.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <CompanyLayoutShell>
          {children}
        </CompanyLayoutShell>
      </body>
    </html>
  );
}
