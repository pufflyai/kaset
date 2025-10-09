import { Box, Button, Flex, useBreakpointValue, useColorMode } from "@chakra-ui/react";
import { Allotment } from "allotment";
import { useEffect, useState } from "react";
import { ConversationHost } from "./components/ui/conversation-host";
import { Desktop } from "./components/ui/desktop";
import { GithubCorner } from "./components/ui/github-corner";
import { Toaster } from "./components/ui/toaster";
import { TopBar } from "./components/ui/top-bar";
import { setupPlayground } from "./services/playground/setup";
import { useWorkspaceStore } from "./state/WorkspaceProvider";

export function App() {
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const [mobilePane, setMobilePane] = useState<"conversation" | "desktop">("conversation");
  const { colorMode, setColorMode } = useColorMode();
  const themePreference = useWorkspaceStore((state) => state.settings.theme ?? "light");

  useEffect(() => {
    setupPlayground();
  }, []);

  useEffect(() => {
    if (colorMode !== themePreference) {
      setColorMode(themePreference);
    }
  }, [colorMode, setColorMode, themePreference]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePane("conversation");
    }
  }, [isMobile]);

  const handleMobileToggle = () => {
    setMobilePane((current) => (current === "conversation" ? "desktop" : "conversation"));
  };

  const mobileToggleButton = !isMobile ? undefined : (
    <Button size="sm" variant="outline" onClick={handleMobileToggle} minWidth="140px">
      {mobilePane === "conversation" ? "Show Desktop" : "Show Chat"}
    </Button>
  );

  const conversationPane = (
    <Flex direction="column" height="100%" padding="3" gap="3" flex="1" width="100%">
      <TopBar mobileCenterContent={mobileToggleButton} />
      <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
        <ConversationHost />
      </Box>
    </Flex>
  );

  const desktopPane = isMobile ? (
    <Flex direction="column" height="100%" padding="3" gap="3" flex="1" width="100%">
      <TopBar mobileCenterContent={mobileToggleButton} />
      <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md" height="100%">
        <Desktop />
      </Box>
    </Flex>
  ) : (
    <Desktop />
  );

  const layout = isMobile ? (
    mobilePane === "conversation" ? (
      conversationPane
    ) : (
      desktopPane
    )
  ) : (
    <Allotment>
      <Allotment.Pane minSize={260} preferredSize={420} maxSize={580}>
        {conversationPane}
      </Allotment.Pane>
      <Allotment.Pane minSize={360}>{desktopPane}</Allotment.Pane>
    </Allotment>
  );

  return (
    <Flex direction={isMobile ? "column" : "row"} height="100vh" width="100vw">
      {layout}

      {!isMobile && <GithubCorner href="https://github.com/pufflyai/kaset" />}

      <Toaster />
    </Flex>
  );
}
