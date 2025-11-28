import React from "react";

export default function Sidebar() {
  return (
    <aside className="w-60 bg-white h-screen border-r border-gray-200 flex flex-col p-6">
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-[#2F80ED]">Kaelion AI</h2>
      </div>
      <nav className="flex-1 space-y-4">
        <a href="#" className="block text-gray-700 hover:text-[#2F80ED]">Dashboard</a>
        <a href="#" className="block text-gray-700 hover:text-[#2F80ED]">History</a>
        <a href="#" className="block text-gray-700 hover:text-[#2F80ED]">Settings</a>
      </nav>
      <div className="mt-auto">
        <button className="w-full py-2 border border-gray-300 rounded hover:bg-gray-100">Logout</button>
      </div>
    </aside>
  );
}
