export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar placeholder */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:block">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900">AutoCoach</h2>
        </div>
        <nav className="px-4 space-y-1">
          <a
            href="/dashboard"
            className="block px-4 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100"
          >
            Dashboard
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
