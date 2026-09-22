/**
 * Details printed on invoices and shown to applicants.
 * Empty fields are simply left out, so fill in what you have.
 * This is public information (it appears on every invoice), so do not put secrets here.
 */
export const ORG = {
  name: "DPMM Putrajaya",
  legalName: "Dewan Perniagaan Melayu Malaysia",
  address: [] as string[], // for example ["No 1, Jalan Contoh", "62000 Putrajaya"]
  email: "",
  phone: "",
  bank: {
    bankName: "RHB Bank",
    accountName: "DEWAN PERNIAGAAN MELAYU MALAYSIA",
    accountNumber: "21601100010342",
  },
  paymentNote: "Please quote the invoice number as the payment reference.",
};

export function hasBankDetails(): boolean {
  return Boolean(ORG.bank.bankName && ORG.bank.accountNumber);
}
