"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-primary px-5 py-2.5 font-semibold text-cream hover:bg-primary-deep print:hidden"
    >
      {label}
    </button>
  );
}
