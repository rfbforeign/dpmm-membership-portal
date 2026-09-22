import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/modules/auth/dal";
import { MEMBER_WRITE_ROLES } from "@/modules/members/permissions";
import { getMember, getMemberOptions } from "@/modules/members/queries";
import { STATUS_LABEL } from "@/modules/members/status-badge";
import { MEMBER_STATUSES } from "@/modules/members/validation";
import { EditForm } from "./edit-form";

export const metadata: Metadata = { title: "Edit member" };
export const dynamic = "force-dynamic";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(MEMBER_WRITE_ROLES, `/admin/members/${id}/edit`);

  const [result, options] = await Promise.all([getMember(id), getMemberOptions()]);
  if (!result) notFound();
  const m = result.member;
  const text = (value: string | number | null) => (value === null || value === undefined ? "" : String(value));

  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight text-primary">Edit member</h1>
      <p className="mt-2 text-lg">
        {m.fullName} <span className="tabular-nums text-primary-deep/70">({m.membershipNo})</span>
      </p>

      <EditForm
        memberId={m.id}
        cancelHref={`/admin/members/${m.id}`}
        initial={{
          fullName: text(m.fullName),
          companyName: text(m.companyName),
          email: text(m.email),
          phone: text(m.phone),
          officeTel: text(m.officeTel),
          icNo: text(m.icNo),
          ssmNo: text(m.ssmNo),
          mailingAddress: text(m.mailingAddress),
          registeredAddress: text(m.registeredAddress),
          joinedDate: text(m.joinedDate),
          status: text(m.status),
          membershipTypeId: text(m.membershipTypeId),
          businessSectorId: text(m.businessSectorId),
          businessTypeId: text(m.businessTypeId),
          introducerId: text(m.introducerId),
          adminNotes: text(m.adminNotes),
        }}
        options={{
          statuses: MEMBER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
          types: options.types.map((t) => ({ value: String(t.id), label: `${t.fasal}: ${t.category}` })),
          sectors: options.sectors.map((s) => ({ value: String(s.id), label: s.name })),
          businessTypes: options.businessTypes.map((b) => ({ value: String(b.id), label: b.name })),
          introducers: options.introducers.map((i) => ({ value: String(i.id), label: i.name })),
        }}
      />
    </>
  );
}
