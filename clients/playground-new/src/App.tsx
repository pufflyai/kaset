import { Box, Flex, useBreakpointValue } from "@chakra-ui/react";
import { Allotment } from "allotment";
import { useEffect } from "react";
import { ConversationHost } from "./components/ui/conversation-host";
import { Desktop } from "./components/ui/desktop";
import { GithubCorner } from "./components/ui/github-corner";
import { Toaster } from "./components/ui/toaster";
import { setupPlayground } from "./services/playground/setup";
import { TopBar } from "./components/ui/top-bar";

export function App() {
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  useEffect(() => {
    setupPlayground();
  }, []);

  return (
    <Flex direction="row" height="100vh" width="100vw">
      <Allotment>
        <Allotment.Pane minSize={260} preferredSize={420} maxSize={580}>
          <Flex direction="column" height="100%" padding="3" gap="3" flex="1" width="100%">
            <TopBar />
            <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
              <ConversationHost />
            </Box>
          </Flex>
        </Allotment.Pane>
        <Allotment.Pane minSize={360}>
          <Desktop />
        </Allotment.Pane>
      </Allotment>

      {!isMobile && <GithubCorner href="https://github.com/pufflyai/kaset" />}

      <Toaster />
    </Flex>
  );
}
