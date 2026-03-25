import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import SiriusSidebar from './SiriusSidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      <SiriusSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex-1 lg:ml-[252px] flex flex-col min-h-screen">
        <Topbar onMenuToggle={() => setMobileOpen(o => !o)} />
        <main className="flex-1 p-4 sm:p-7 max-w-[1200px] w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
