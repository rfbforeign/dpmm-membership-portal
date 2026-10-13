"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_PROFILE_PHOTO_BYTES } from "@/modules/portal/photo";

export function ProfilePhotoForm({ initialPhotoUrl, fullName }: { initialPhotoUrl: string | null; fullName: string }) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    setMessage("");
    setError("");
    const selected = event.currentTarget.files?.[0] ?? null;
    if (selected && selected.size > MAX_PROFILE_PHOTO_BYTES) {
      setFile(null);
      event.currentTarget.value = "";
      setError("Choose an image no larger than 3 MB.");
      return;
    }
    setFile(selected);
  }

  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setError("");
    if (!file) {
      setError("Choose a photo before saving.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("photo", file);
      const response = await fetch("/api/portal/member/photo", { method: "POST", body: formData });
      const result = (await response.json()) as { photoUrl?: string; error?: string };
      if (!response.ok || !result.photoUrl) {
        setError(result.error ?? "Failed to save profile photo. Please try again.");
        return;
      }
      setPhotoUrl(result.photoUrl);
      setFile(null);
      form.reset();
      setMessage("Profile photo updated.");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-start gap-5">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`${fullName} profile`}
          width={80}
          height={80}
          className="h-20 w-20 rounded-full border border-line object-cover"
        />
      ) : (
        <div
          aria-label="No profile photo"
          className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-paper text-2xl font-semibold text-primary"
        >
          {fullName.trim().charAt(0).toUpperCase()}
        </div>
      )}
      <form onSubmit={savePhoto} className="min-w-60 flex-1">
        <label htmlFor="profile-photo" className="block text-sm font-semibold text-primary">
          Update profile photo <span className="font-normal text-primary-deep/70">(optional)</span>
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id="profile-photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectPhoto}
            disabled={saving}
            className="max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:py-2 file:text-sm"
          />
          <button
            type="submit"
            disabled={saving || !file}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-cream hover:bg-primary-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save photo"}
          </button>
        </div>
        <p className="mt-1 text-xs text-primary-deep/70">JPEG, PNG or WebP, up to 3 MB.</p>
        {error && <p role="alert" className="mt-2 text-sm text-accent">{error}</p>}
        {message && <p role="status" className="mt-2 text-sm font-semibold text-primary">{message}</p>}
      </form>
    </div>
  );
}
