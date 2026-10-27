import './globals.css';
import AgentLayoutShell from '../components/AgentLayoutShell';

export const metadata = {
  title: 'Rupadiya Agent Portal — Official Bus Terminal',
  description: 'Official Rupadiya Agent Booking Terminal, Wallet Ledger, and Ticket Management System.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen antialiased selection:bg-emerald-500 selection:text-white">
        <AgentLayoutShell>{children}</AgentLayoutShell>
      </body>
    </html>
  );
}
