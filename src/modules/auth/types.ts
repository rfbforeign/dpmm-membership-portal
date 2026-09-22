/** What a form action hands back to its form. `email` lets the sign-in form keep what was typed. */
export type FormState = { error?: string; success?: string; email?: string } | undefined;
