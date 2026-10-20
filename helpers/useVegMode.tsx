import { useCallback, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postCustomerPreferences } from "../endpoints/customer/preferences_POST.schema";
import { AUTH_QUERY_KEY, useAuth } from "./useAuth";
import type { User } from "./User";

const storageKey = "zipto:vegMode";
const changeEvent = "zipto-vegmode";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(storageKey) === "true";
}

function getServerSnapshot(): boolean {
  return false;
}

export function useVegMode(): {
  vegMode: boolean;
  setVegMode: (next: boolean) => Promise<void>;
  isSaving: boolean;
} {
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const localVegMode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      postCustomerPreferences({ vegMode: next }),
  });

  const setVegMode = useCallback(
    async (next: boolean) => {
      if (authState.type === "loading") {
        throw new Error("Please wait while your session loads.");
      }

      if (authState.type !== "authenticated") {
        window.localStorage.setItem(storageKey, String(next));
        window.dispatchEvent(new Event(changeEvent));
        return;
      }

      const userId = authState.user.id;

      try {
        const preferences = await mutation.mutateAsync(next);
        queryClient.setQueryData<User | null>(
          AUTH_QUERY_KEY,
          (current) =>
            current?.id === userId
              ? { ...current, ...preferences }
              : current ?? null,
        );
        await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not save veg mode. Please try again.",
        );
        throw error;
      }
    },
    [authState, mutation, queryClient],
  );

  return {
    vegMode:
      authState.type === "authenticated"
        ? authState.user.vegMode
        : localVegMode,
    setVegMode,
    isSaving: mutation.isPending,
  };
}