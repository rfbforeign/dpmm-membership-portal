import { NextResponse } from "next/server";
import { getSql } from "@/db";
import { getSession } from "@/modules/auth/session";
import { findPortalMemberId } from "@/modules/portal/queries";
import {
  hasValidImageSignature,
  isProfilePhotoType,
  MAX_PROFILE_PHOTO_BYTES,
} from "@/modules/portal/photo";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberId = await findPortalMemberId(session.user.id, session.user.email);
    if (!memberId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const [photo] = await getSql()(
      `SELECT content_type, encode(image_data, 'base64') AS image_data
       FROM member_profile_photos WHERE member_id = $1`,
      [memberId]
    );
    if (!photo) {
      return NextResponse.json({ error: "Profile photo not found" }, { status: 404 });
    }

    const image = Buffer.from(String(photo.image_data).replace(/\s/g, ""), "base64");
    return new Response(image, {
      headers: {
        "Content-Type": String(photo.content_type),
        "Content-Length": String(image.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Portal profile photo read failed:", error);
    return NextResponse.json({ error: "Failed to load profile photo" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberId = await findPortalMemberId(session.user.id, session.user.email);
    if (!memberId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a profile photo to upload." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_PROFILE_PHOTO_BYTES) {
      return NextResponse.json({ error: "Choose an image no larger than 3 MB." }, { status: 400 });
    }
    if (!isProfilePhotoType(file.type)) {
      return NextResponse.json({ error: "Use a JPEG, PNG or WebP image." }, { status: 400 });
    }

    const image = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageSignature(file.type, image)) {
      return NextResponse.json({ error: "The selected file is not a valid JPEG, PNG or WebP image." }, { status: 400 });
    }

    await getSql()(
      `INSERT INTO member_profile_photos (member_id, content_type, image_data, updated_at)
       VALUES ($1, $2, decode($3, 'base64'), now())
       ON CONFLICT (member_id) DO UPDATE
       SET content_type = EXCLUDED.content_type,
           image_data = EXCLUDED.image_data,
           updated_at = now()`,
      [memberId, file.type, image.toString("base64")]
    );

    return NextResponse.json({ photoUrl: `/api/portal/member/photo?v=${Date.now()}` });
  } catch (error) {
    console.error("Portal profile photo upload failed:", error);
    return NextResponse.json({ error: "Failed to save profile photo. Please try again." }, { status: 500 });
  }
}
