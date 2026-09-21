"use server";

import { redirect } from "next/navigation";
import { getSql } from "@/db";
import { clean, todayInMalaysia } from "@/lib/normalize";
import { addDays } from "@/lib/dates";
import { writeAudit } from "@/modules/audit/log";
import { enqueueNotification, sendQueued } from "@/modules/notifications/outbox";
import { registrationKey } from "@/modules/notifications/reminders";
import { renderEmail } from "@/modules/notifications/templates";
import type { MemberFormState } from "@/modules/members/types";
import {
  buildApplicationNote,
  compactRegistrationNo,
  validateRegistration,
  type EntityKind,
} from "./validation";

const MAX_APPLICATIONS_PER_HOUR = 20;

const FIELDS = [
  "membershipTypeId",
  "fullName",
  "companyName",
  "email",
  "phone",
  "icNo",
  "ssmNo",
  "registeredAddress",
  "mailingAddress",
  "businessSectorId",
  "businessTypeId",
  "introducedBy",
  "consent",
] as const;

export async function registerMember(_previous: MemberFormState, formData: FormData): Promise<MemberFormState> {
  // Hidden "website" field: people never see it, so anything typed there is a bot.
  // Pretend it worked so the bot learns nothing.
  if (clean(formData.get("website"))) redirect("/register/thanks");

  const raw: Record<string, string> = {};
  for (const field of FIELDS) raw[field] = String(formData.get(field) ?? "");

  const sql = getSql();
  const [types, sectors, businessTypeRows] = await Promise.all([
    sql`SELECT id, entity_type FROM membership_types WHERE is_active`,
    sql`SELECT id FROM business_sectors`,
    sql`SELECT id FROM business_types`,
  ]);

  const result = validateRegistration(raw, {
    types: types.map((t) => ({ id: Number(t.id), entityType: t.entity_type as EntityKind })),
    validSectorIds: sectors.map((r) => Number(r.id)),
    validBusinessTypeIds: businessTypeRows.map((r) => Number(r.id)),
  });
  if (!result.ok) {
    return { error: "Please check the highlighted fields.", fieldErrors: result.fieldErrors, values: raw };
  }
  const d = result.data;

  // Everything that can fail runs inside the try; the redirect happens after it,
  // because redirect() works by throwing and must not be caught.
  let membershipNo: string;
  let invoiceNo: string | null = null;
  let invoiceAmount: string | null = null;
  try {
    // Pressing Submit twice, or refreshing, must not create two applications
    const repeat = await sql`
      SELECT membership_no FROM members
      WHERE deleted_at IS NULL AND status = 'pending' AND email = ${d.email}
        AND lower(full_name) = lower(${d.fullName}) AND created_at > now() - interval '24 hours'
      LIMIT 1`;

    if (repeat.length > 0) {
      membershipNo = String(repeat[0].membership_no);
      const [existingInvoice] = await sql`
        SELECT s.invoice_no, s.amount::text AS amount FROM invoice_summary s
        JOIN members m ON m.id = s.member_id
        WHERE m.membership_no = ${membershipNo} ORDER BY s.created_at LIMIT 1`;
      invoiceNo = existingInvoice ? String(existingInvoice.invoice_no) : null;
      invoiceAmount = existingInvoice ? String(existingInvoice.amount) : null;
    } else {
      // Guard against a flood of automated applications
      const [{ recent }] = await sql`
        SELECT count(*)::int AS recent FROM members
        WHERE created_at > now() - interval '1 hour' AND legacy_data->>'source' = 'web_registration'`;
      if (Number(recent) >= MAX_APPLICATIONS_PER_HOUR) {
        return {
          error: "We are receiving a lot of applications right now. Please try again in an hour, or contact the secretariat.",
          values: raw,
        };
      }

      // A company that is already a member should not apply twice
      if (d.ssmNo) {
        const compact = compactRegistrationNo(d.ssmNo);
        if (compact.length >= 6) {
          const existing = await sql`
            SELECT 1 FROM members
            WHERE deleted_at IS NULL
              AND position(${compact} in regexp_replace(lower(coalesce(ssm_no, '')), '[^a-z0-9]', '', 'g')) > 0
            LIMIT 1`;
          if (existing.length > 0) {
            return {
              error: "We already have a membership record for that registration number. Please contact the secretariat instead of applying again.",
              fieldErrors: { ssmNo: "Already registered with DPMM." },
              values: raw,
            };
          }
        }
      }

      // The same person can legitimately hold two memberships (two companies),
      // so a matching IC is a note for staff, not a block
      const sameIc = await sql`
        SELECT membership_no FROM members WHERE deleted_at IS NULL AND ic_no = ${d.icNo} ORDER BY membership_no LIMIT 5`;
      const note = buildApplicationNote({
        introducedBy: d.introducedBy,
        sameIcMembers: sameIc.map((r) => String(r.membership_no)),
      });

      const today = todayInMalaysia();
      const year = today.slice(0, 4);
      const [{ no }] = await sql`
        SELECT 'PJ-' || ${year}::text || '-' || lpad(nextval('membership_no_seq')::text, 4, '0') AS no`;
      membershipNo = String(no);

      // The application and its invoice are saved together: both, or neither
      const [memberRows, invoiceRows] = await sql.transaction([
        sql`
          INSERT INTO members (
            membership_no, membership_type_id, status, full_name, company_name, email, phone, ic_no, ssm_no,
            business_sector_id, business_type_id, mailing_address, registered_address,
            joined_date, pdpa_consent_at, admin_notes, legacy_data
          ) VALUES (
            ${membershipNo}, ${d.membershipTypeId}, 'pending', ${d.fullName}, ${d.companyName}, ${d.email}, ${d.phone},
            ${d.icNo}, ${d.ssmNo}, ${d.businessSectorId}, ${d.businessTypeId}, ${d.mailingAddress}, ${d.registeredAddress},
            ${today}::date, now(), ${note}, ${JSON.stringify({ source: "web_registration" })}::jsonb
          )
          RETURNING id`,
        sql`
          SELECT out_invoice_no, out_amount::text AS amount
          FROM create_registration_invoice((SELECT id FROM members WHERE membership_no = ${membershipNo}))`,
      ]);
      invoiceNo = String(invoiceRows[0].out_invoice_no);
      invoiceAmount = String(invoiceRows[0].amount);

      await writeAudit({
        actorId: null,
        action: "member.register",
        entityType: "member",
        entityId: String(memberRows[0].id),
        changes: { source: "web_registration", membershipNo, invoiceNo },
      });

      // Confirmation email. Queued first, then sent if email is set up. A problem here must never lose the application.
      try {
        const mail = renderEmail("registration_received", {
          memberName: d.fullName,
          membershipNo,
          invoiceNo: invoiceNo ?? undefined,
          amount: invoiceAmount ?? undefined,
          dueDate: addDays(today, 14),
        });
        await enqueueNotification({
          memberId: String(memberRows[0].id),
          type: "registration",
          recipient: d.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          dedupeKey: registrationKey(membershipNo),
        });
        await sendQueued(3);
      } catch (mailError) {
        console.error("Confirmation email could not be queued", mailError);
      }
    }
  } catch (error) {
    console.error("Registration failed", error);
    return { error: "Sorry, we could not save your application. Please try again in a moment.", values: raw };
  }

  const invoiceQuery = invoiceNo && invoiceAmount
    ? `&inv=${encodeURIComponent(invoiceNo)}&amt=${encodeURIComponent(invoiceAmount)}`
    : "";
  redirect(`/register/thanks?no=${encodeURIComponent(membershipNo)}${invoiceQuery}`);
}
