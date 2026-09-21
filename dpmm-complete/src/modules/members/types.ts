/** What the edit form's action hands back. `values` lets the form keep what the person typed. */
export type MemberFormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    }
  | undefined;
