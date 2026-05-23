import React, { Suspense } from "react";
import AdminNav from "@/components/AdminNav";
import { isRTL, type Locale } from "@/lib/i18n";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<div className="min-h-screen" />}> 
        <AdminNav />
      </Suspense>
      <main>
        {children}
      </main>
    </div>
  );
}
