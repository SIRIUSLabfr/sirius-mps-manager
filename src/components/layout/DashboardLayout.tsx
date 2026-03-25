import { Outlet } from 'react-router-dom';
import SiriusSidebar from './SiriusSidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen flex">
      <SiriusSidebar />
      <div className="flex-1 ml-[252px] flex flex-col min-h-screen">
        <Topbar />
        <main className="flex-1 p-7 max-w-[1200px] w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
