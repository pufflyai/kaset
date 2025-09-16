import { useBreakpointValue } from "@chakra-ui/react";

/**
 * Returns `true` when the viewport is below the `md` breakpoint.
 * Useful for toggling mobile-specific UI and behavior.
 */
export function useIsMobile(): boolean {
  return useBreakpointValue({ base: true, md: false }) ?? false;
}

export default useIsMobile;
