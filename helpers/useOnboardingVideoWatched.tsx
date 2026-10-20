import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

type WatchedState = {
  key: string | null;
  watched: boolean;
};

/** Shares per-user academy progress without mixing merchant and rider videos. */
export const useOnboardingVideoWatched = (suffix?: string) => {
  const { authState } = useAuth();
  const key =
    authState.type === "authenticated"
      ? `zipto_onboarding_video_watched_${authState.user.id}${suffix ? `_${suffix}` : ""}`
      : null;

  const [state, setState] = useState<WatchedState>({
    key: null,
    watched: false,
  });

  useEffect(() => {
    if (!key) {
      setState({ key: null, watched: false });
      return;
    }

    try {
      setState({ key, watched: window.localStorage.getItem(key) === "true" });
    } catch (error) {
      console.error("Could not read onboarding video progress:", error);
      setState({ key, watched: false });
    }
  }, [key]);

  const markCompleted = () => {
    if (!key) return;

    try {
      window.localStorage.setItem(key, "true");
    } catch (error) {
      console.error("Could not save onboarding video progress:", error);
    }

    setState({ key, watched: true });
  };

  return {
    watched: key !== null && state.key === key && state.watched,
    markCompleted,
  };
};