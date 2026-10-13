import { NextResponse } from "next/server";
import { getSql } from "@/db";
import { getSession } from "@/modules/auth/session";

export async function GET() {
  try {
    // Get the current session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;

    // Get member data from database
    const sql = getSql();
    const [member] = await sql(
      `SELECT 
        id, full_name, email, phone, membership_no, status, category, 
        member_since, expiry_date, mailing_address, registered_address,
        business_sector, business_type, company_name, designation, photo_url
       FROM members 
       WHERE email = $1 AND deleted_at IS NULL`,
      [userEmail]
    );

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get invoices for this member
    const invoices = await sql(
      `SELECT 
        id, invoice_no, invoice_type, amount, balance, status, 
        issued_date, due_date, paid_date
       FROM invoice_summary
       WHERE member_id = $1
       ORDER BY issued_date DESC
       LIMIT 10`,
      [member.id]
    );

    // Calculate totals
    const totalOpenInvoices = invoices
      .filter((inv: any) => inv.status === "unpaid")
      .length;
    
    const totalBalance = invoices
      .filter((inv: any) => inv.status === "unpaid")
      .reduce((sum: number, inv: any) => sum + parseFloat(inv.balance || 0), 0);

    return NextResponse.json({
      member: {
        id: String(member.id),
        fullName: String(member.full_name),
        email: String(member.email),
        phone: member.phone ? String(member.phone) : null,
        membershipNo: String(member.membership_no),
        status: String(member.status),
        category: String(member.category),
        memberSince: member.member_since ? String(member.member_since) : null,
        expiryDate: member.expiry_date ? String(member.expiry_date) : null,
        mailingAddress: member.mailing_address ? String(member.mailing_address) : null,
        registeredAddress: member.registered_address ? String(member.registered_address) : null,
        businessSector: member.business_sector ? String(member.business_sector) : null,
        businessType: member.business_type ? String(member.business_type) : null,
        companyName: member.company_name ? String(member.company_name) : null,
        designation: member.designation ? String(member.designation) : null,
        photoUrl: member.photo_url ? String(member.photo_url) : null,
      },
      invoices: invoices.map((inv: any) => ({
        id: String(inv.id),
        invoiceNo: String(inv.invoice_no),
        type: String(inv.invoice_type),
        amount: parseFloat(inv.amount),
        balance: parseFloat(inv.balance),
        status: String(inv.status),
        issuedDate: String(inv.issued_date),
        dueDate: String(inv.due_date),
        paidDate: inv.paid_date ? String(inv.paid_date) : null,
      })),
      summary: {
        openInvoices: totalOpenInvoices,
        outstandingBalance: totalBalance,
      },
    });
  } catch (error) {
    console.error("Portal member API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch member data" },
      { status: 500 }
    );
  }
}