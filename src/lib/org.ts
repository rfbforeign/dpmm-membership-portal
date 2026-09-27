/**
 * Details printed on invoices and shown to applicants.
 * Empty fields are simply left out, so fill in what you have.
 * This is public information (it appears on every invoice), so do not put secrets here.
 */
export const ORG = {
  name: "DPMM Putrajaya",
  legalName: "Dewan Perniagaan Melayu Malaysia",
  address: [ Unit A-G-R09, Block A, Suasana PjH, Jalan Tun Abdul Razak, Presint 2, 62100 Putrajaya, Wilayah Persekutuan Putrajaya] as string[], // for example ["No 1, Jalan Contoh", "62000 Putrajaya"]
  email: "dpmm.putarajaya@gmail.com",
  phone: "019 4430 400",
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
