import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeModeProvider } from "../helpers/themeMode";
import { TooltipProvider } from "./Tooltip";
import { SonnerToaster } from "./SonnerToaster";
import { ScrollToHashElement } from "./ScrollToHashElement";
import { AuthProvider } from "../helpers/useAuth";
import { FlootRealtimeProvider } from "./FlootRealtimeProvider";
import { CallProvider } from "./CallProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute “fresh” window
    },
  },
});

export const GlobalContextProviders = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FlootRealtimeProvider>
        <ThemeModeProvider>
          <ScrollToHashElement />
          <TooltipProvider>
            <CallProvider>
              {children}
            </CallProvider>
            <SonnerToaster />
          </TooltipProvider>
        </ThemeModeProvider>
        </FlootRealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
