import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 shadow-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
          Password Reset Notice
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
          Automated email self-service password reset requires a verified SMTP /
          Transactional Email provider integration (e.g. AWS SES, Resend, or SendGrid).
          <br /><br />
          To reset your credentials now, please reach out directly to customer operations
          at <strong>support@malaysia-preorder.com</strong> or your account manager.
        </p>
        <Link
          href="/login"
          className="inline-flex justify-center items-center px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
