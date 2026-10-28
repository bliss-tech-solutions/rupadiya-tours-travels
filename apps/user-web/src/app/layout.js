import './globals.css';
import Navbar from '../components/navigation/Navbar';
import Footer from '../components/navigation/Footer';
import MobileBottomNav from '../components/navigation/MobileBottomNav';
import SplashScreen from '../components/ui/SplashScreen';
import { ToastProvider } from '../components/ui/Toast';
import { LanguageProvider } from '../context/LanguageContext';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: 'Rupadiya Travel — Rupadiya Intercity Bus & Tour Booking',
  description: 'Book comfortable intercity bus tickets and handpicked tours between Rupadiya and Ahmedabad, Vadodara, Surat, Bengaluru, Hyderabad, and Mumbai.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#F8FAFC] pb-16 md:pb-0">
        <LanguageProvider>
          <ToastProvider>
            <SplashScreen />
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
            <MobileBottomNav />
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
