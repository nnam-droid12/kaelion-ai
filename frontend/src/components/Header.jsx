import React from "react";

export default function Header() {
  return (
    <header className="w-full bg-white border-b border-gray-200 p-4 flex justify-between items-center">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {/* Right-side placeholder: user avatar / notifications */}
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-gray-300"></div>
      </div>
    </header>
  );
}
