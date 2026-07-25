import { useCallback, useEffect } from "react";
import { useBrowserLocation } from "wouter/use-browser-location";

export type NavigationGuard = (to: string) => boolean;

const guards = new Set<NavigationGuard>();

// Registers a before-leave check; return false from the guard to cancel navigation.
export function useNavigationGuard(guard: NavigationGuard): void {
  useEffect(() => {
    guards.add(guard);
    return () => {
      guards.delete(guard);
    };
  }, [guard]);
}

// Drop-in replacement for wouter's location hook that consults registered guards.
export const useGuardedLocation: typeof useBrowserLocation = (options) => {
  const [location, navigate] = useBrowserLocation(options);
  const guardedNavigate: typeof navigate = useCallback(
    (to, navOptions) => {
      const target = String(to);
      for (const guard of guards) {
        if (!guard(target)) return;
      }
      navigate(to, navOptions);
    },
    [navigate],
  );
  return [location, guardedNavigate];
};
