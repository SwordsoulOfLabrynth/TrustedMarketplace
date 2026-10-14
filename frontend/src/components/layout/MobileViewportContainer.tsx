import React from "react";

interface MobileViewportContainerProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Responsive viewport container.
 * - Mobile: 100% full width with native touch padding and ergonomic touch targets.
 * - Desktop: Balanced max-width (max-w-7xl) responsive layout with natural margins.
 */
export function MobileViewportContainer({
  children,
  header,
  footer,
}: MobileViewportContainerProps) {
  return (
    <div className="min-h-screen bg-ivory-100 text-ink-900 flex flex-col antialiased overflow-x-hidden w-full">
      {/* Optional Header / Navigation Bar */}
      {header && (
        <div className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-ivory-300">
          <div className="w-full max-w-7xl mx-auto">
            {header}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 flex flex-col min-w-0">
        {children}
      </main>

      {/* Optional Footer / Bottom Navigation */}
      {footer && (
        <footer className="w-full bg-white/90 border-t border-ivory-300 py-3 sm:py-4 mt-auto">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
}
