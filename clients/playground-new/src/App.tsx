import { Flex, useBreakpointValue } from "@chakra-ui/react";
import { useEffect } from "react";
import { Desktop } from "./components/ui/desktop";
import { GithubCorner } from "./components/ui/github-corner";
import { Toaster } from "./components/ui/toaster";
import { setupPlayground } from "./services/playground/setup";

export function App() {
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  useEffect(() => {
    setupPlayground();
  }, []);

  return (
    <Flex direction="column" height="100vh" width="100vw">
      <Desktop />

      {!isMobile && <GithubCorner href="https://github.com/pufflyai/kaset" />}

      <Toaster />
    </Flex>
  );
}
