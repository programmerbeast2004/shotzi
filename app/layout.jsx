"use client";

import AdminNotifier from "../components/AdminNotifier";
import Navbar from "../components/Navbar";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap"
          rel="stylesheet"
        />
        <title>Shotzi – A soft place for loud feelings</title>
      </head>
      <body>
        <div className="relative min-h-screen">
          <div className="absolute -left-10 top-24 w-40 decor-spot">
            <img src="/decor/flower-soft.svg" alt="" />
          </div>
          <div className="absolute -right-8 bottom-10 w-36 decor-spot">
            <img src="/decor/stars-soft.svg" alt="" />
          </div>
          <div className="relative z-10 min-h-screen bg-gradient-to-b from-shotzi-ink/95 via-shotzi-ink/98 to-shotzi-ink">
            <Navbar />
            {/* Admin notifier (popups) */}
            <AdminNotifier />
            <main className="max-w-6xl mx-auto px-4 pb-16 pt-4">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
