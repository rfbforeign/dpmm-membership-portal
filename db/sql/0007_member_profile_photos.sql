-- Keep member profile photos in the database so uploads persist across deployments.
CREATE TABLE member_profile_photos (
  member_id   uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  image_data   bytea NOT NULL CHECK (octet_length(image_data) <= 3145728),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
