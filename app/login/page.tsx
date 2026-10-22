import { Suspense } from "react";
import CustomerLoginForm from "./login-form";

export const metadata = {
  title: "Sign In | Malaysia Pre-Order",
  description: "Sign in to track inquiries, quotations, and shipments.",
};

export default function CustomerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[75vh] flex items-center justify-center text-sm text-zinc-500">
          Loading sign-in...
        </div>
      }
    >
      <CustomerLoginForm />
    </Suspense>
  );
}
