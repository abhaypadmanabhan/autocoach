"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

const AVATAR_BUCKET = "avatars";

export function useAvatar(userId: string | null) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const getAvatarPath = useCallback(
    (uid: string) => `${uid}/avatar.png`,
    []
  );

  const fetchAvatarUrl = useCallback(async () => {
    if (!userId) {
      setAvatarUrl(null);
      return;
    }

    const path = getAvatarPath(userId);
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

    // Check if the file actually exists by trying to fetch metadata
    const { error: headError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .list(userId);

    if (headError || !data?.publicUrl) {
      setAvatarUrl(null);
      return;
    }

    // Check if there's actually an avatar file
    const { data: files } = await supabase.storage
      .from(AVATAR_BUCKET)
      .list(userId);

    const hasAvatar = files?.some((f) => f.name === "avatar.png");
    if (hasAvatar) {
      // Cache bust with timestamp
      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
    } else {
      setAvatarUrl(null);
    }
  }, [userId, supabase.storage, getAvatarPath]);

  useEffect(() => {
    fetchAvatarUrl();
  }, [fetchAvatarUrl]);

  const uploadAvatar = useCallback(
    async (file: File): Promise<string> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      setUploading(true);
      setError(null);

      try {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          throw new Error("Please select an image file");
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
          throw new Error("Image must be less than 2MB");
        }

        const path = getAvatarPath(userId);

        // Upload with upsert to overwrite existing
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, file, {
            upsert: true,
            contentType: file.type,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get the public URL
        const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

        if (!data?.publicUrl) {
          throw new Error("Failed to get avatar URL");
        }

        // Cache bust with timestamp
        const newUrl = `${data.publicUrl}?t=${Date.now()}`;
        setAvatarUrl(newUrl);
        return newUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to upload avatar";
        setError(message);
        throw new Error(message);
      } finally {
        setUploading(false);
      }
    },
    [userId, supabase.storage, getAvatarPath]
  );

  const deleteAvatar = useCallback(async (): Promise<void> => {
    if (!userId) {
      throw new Error("User not authenticated");
    }

    setError(null);

    try {
      const path = getAvatarPath(userId);

      const { error: deleteError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([path]);

      if (deleteError) {
        throw deleteError;
      }

      setAvatarUrl(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete avatar";
      setError(message);
      throw new Error(message);
    }
  }, [userId, supabase.storage, getAvatarPath]);

  return {
    avatarUrl,
    uploading,
    error,
    uploadAvatar,
    deleteAvatar,
    refreshAvatar: fetchAvatarUrl,
  };
}
