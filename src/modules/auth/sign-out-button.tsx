import { logout } from "./actions";

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={`rounded-md border border-current px-3 py-1.5 text-sm font-semibold hover:bg-white/10 ${className}`}
      >
        Sign out
      </button>
    </form>
  );
}
