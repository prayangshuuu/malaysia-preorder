import Link from "next/link";

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-12 text-center" role="status">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500 border-t-transparent mb-4"></div>
      <p className="text-sm font-medium text-zinc-400">Loading operations console...</p>
    </div>
  );
}
