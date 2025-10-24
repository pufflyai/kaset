import { Box, Button, Flex, useBreakpointValue } from "@chakra-ui/react";
import { Allotment } from "allotment";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KasUIProvider, type ChatSettings, type ConversationStoreSnapshot } from "./kas-ui";
import { ConversationHost } from "./components/ui/conversation-host";
import { Desktop } from "./components/ui/desktop";
import { GithubCorner } from "./components/ui/github-corner";
import { Toaster } from "./components/ui/toaster";
import { TopBar } from "./components/ui/top-bar";
import { getModelPricing } from "./models";
import { setupPlayground } from "./services/playground/setup";
import { updateReactScanState } from "./services/react-scan/init";
import { useWorkspaceStore } from "./state/WorkspaceProvider";
import { applyThemePreference } from "./theme/applyThemePreference";

export function App() {
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const [mobilePane, setMobilePane] = useState<"conversation" | "desktop">("conversation");
  const themePreference = useWorkspaceStore((state) => state.settings.theme);
  const reactScanEnabled = useWorkspaceStore((state) => state.settings.reactScanEnabled);
  const conversations = useWorkspaceStore((state) => state.conversations);
  const selectedConversationId = useWorkspaceStore((state) => state.selectedConversationId);
  const workspaceSettings = useWorkspaceStore((state) => state.settings);

  useEffect(() => {
    setupPlayground();
  }, []);

  useEffect(() => {
    applyThemePreference(themePreference);
  }, [themePreference]);

  useEffect(() => {
    updateReactScanState(reactScanEnabled);
  }, [reactScanEnabled]);

  const chatSettings = useMemo<ChatSettings>(() => {
    const { modelId, approvalGatedTools = [], apiKey, baseUrl } = workspaceSettings;

    return {
      modelId,
      approvalGatedTools: approvalGatedTools ?? [],
      apiKey: apiKey || undefined,
      baseUrl: baseUrl || undefined,
      credentialsReady: Boolean(apiKey || baseUrl),
      modelPricing: getModelPricing(modelId || undefined),
    };
  }, [workspaceSettings]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePane("conversation");
    }
  }, [isMobile]);

  const handleMobileToggle = () => {
    setMobilePane((current) => (current === "conversation" ? "desktop" : "conversation"));
  };

  const handleConversationsChange = useCallback((snapshot: ConversationStoreSnapshot) => {
    useWorkspaceStore.setState(
      (state) => {
        state.conversations = snapshot.conversations;
        if (snapshot.selectedConversationId) {
          state.selectedConversationId = snapshot.selectedConversationId;
        }
      },
      false,
      "kas-ui/conversations/sync",
    );
  }, []);

  const mobileToggleButton = !isMobile ? undefined : (
    <Button size="sm" variant="outline" onClick={handleMobileToggle} minWidth="140px">
      {mobilePane === "conversation" ? "Show Desktop" : "Show Chat"}
    </Button>
  );

  const conversationPane = (
    <Flex direction="column" height="100%" padding={["1", "3"]} gap="3" flex="1" width="100%">
      <TopBar mobileCenterContent={mobileToggleButton} />
      <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
        <ConversationHost />
      </Box>
    </Flex>
  );

  const desktopPane = isMobile ? (
    <Flex direction="column" height="100%" padding={["1", "3"]} gap="3" flex="1" width="100%">
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
    <KasUIProvider
      conversations={conversations}
      selectedConversationId={selectedConversationId}
      chatSettings={chatSettings}
      onConversationsChange={handleConversationsChange}
    >
      <Flex direction={isMobile ? "column" : "row"} height="100vh" width="100vw">
        {layout}

        {!isMobile && <GithubCorner href="https://github.com/pufflyai/kaset" />}

        <Toaster />
      </Flex>
    </KasUIProvider>
  );
}
