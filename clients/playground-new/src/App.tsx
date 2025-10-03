import { useBreakpointValue } from "@chakra-ui/react";
import { useEffect } from "react";
import { Desktop } from "./components/ui/desktop";
import { GithubCorner } from "./components/ui/github-corner";
import { Toaster } from "./components/ui/toaster";

export function App() {
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  useEffect(() => {
    // setupPlayground();
  }, []);

  return (
    <>
      <Desktop />

      {!isMobile && <GithubCorner href="https://github.com/pufflyai/kaset" />}

      <Toaster />
    </>
  );
}
