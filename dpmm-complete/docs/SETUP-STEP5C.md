# Step 5c: Bank details on invoices

Your RHB account is now on every unpaid invoice ("How to pay") and on the confirmation page shown to new applicants.

- Bank: RHB Bank
- Account name: DEWAN PERNIAGAAN MELAYU MALAYSIA
- Account number: 21601100010342
- Applicants and members are asked to use the invoice number as the payment reference.

## Copy the files

Unzip this bundle **on top of** your project folder (after Step 5) and allow it to overwrite:
`src/lib/org.ts` and `src/app/admin/invoices/[id]/print/page.tsx`.

## Still empty in `src/lib/org.ts`

Your office address, email and phone are not filled in yet, so they are left off the invoice.
Add them in the same file whenever you like.

## Online payment later

When the payment gateway is added, the bank details stay as the manual option.
