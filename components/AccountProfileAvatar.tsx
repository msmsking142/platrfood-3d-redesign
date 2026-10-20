import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { postCustomerAvatar } from "../endpoints/customer/avatar_POST.schema";
import type { User } from "../helpers/User";
import { AUTH_QUERY_KEY } from "../helpers/useAuth";
import { uploadProfilePhoto } from "../helpers/uploadProfilePhoto";
import { Spinner } from "./Spinner";
import styles from "./AccountProfileAvatar.module.css";

type AccountProfileAvatarProps = {
  className?: string;
  user: Pick<User, "displayName" | "avatarUrl">;
};

export function AccountProfileAvatar({
  className,
  user,
}: AccountProfileAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function updateAvatar(avatarUrl: string | null) {
    queryClient.setQueryData<User | null>(AUTH_QUERY_KEY, (current) =>
      current ? { ...current, avatarUrl } : null,
    );
    await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
  }

  const uploadMutation = useMutation({
    mutationFn: uploadProfilePhoto,
    onSuccess: async (avatarUrl) => {
      await updateAvatar(avatarUrl);
      toast.success("Profile photo updated");
    },
    onError: (error) => {
      console.error("Profile photo update failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not update profile photo",
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => postCustomerAvatar({ action: "remove" }),
    onSuccess: async ({ avatarUrl }) => {
      await updateAvatar(avatarUrl);
      toast.success("Profile photo removed");
    },
    onError: (error) => {
      console.error("Profile photo removal failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not remove profile photo",
      );
    },
  });

  const busy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <div className={styles.avatar}>
        {user.avatarUrl ? (
          <img
            className={styles.photo}
            src={user.avatarUrl}
            alt="Your profile"
          />
        ) : (
          <span aria-hidden="true">
            {user.displayName.trim().charAt(0).toUpperCase()}
          </span>
        )}
        {busy && (
          <span className={styles.loading} role="status" aria-label="Updating profile photo">
            <Spinner size="sm" />
          </span>
        )}
        <button
          type="button"
          className={styles.camera}
          aria-label={user.avatarUrl ? "Change profile photo" : "Add profile photo"}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Camera size={14} aria-hidden="true" />
        </button>
      </div>
      <input
        ref={inputRef}
        className={styles.fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose profile photo"
        disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) uploadMutation.mutate(file);
        }}
      />
      {user.avatarUrl && (
        <button
          type="button"
          className={styles.remove}
          disabled={busy}
          onClick={() => removeMutation.mutate()}
        >
          Remove photo
        </button>
      )}
    </div>
  );
}