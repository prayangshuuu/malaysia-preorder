import Link from "next/link";

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center" role="status">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent mb-4"></div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Loading your account details...</p>
    </div>
  );
}
