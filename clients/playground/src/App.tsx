import { Box, Button, Flex, useBreakpointValue } from "@chakra-ui/react";
import { Allotment } from "allotment";
import { useEffect, useMemo, useRef, useState } from "react";
import { KasUIProvider, createConversationStore } from "./kas-ui";
import { ConversationHost } from "./components/ui/conversation-host";
import { Desktop } from "./components/ui/desktop";
import { GithubCorner } from "./components/ui/github-corner";
import { Toaster } from "./components/ui/toaster";
import { TopBar } from "./components/ui/top-bar";
import { setupPlayground } from "./services/playground/setup";
import { updateReactScanState } from "./services/react-scan/init";
import { useWorkspaceStore } from "./state/WorkspaceProvider";
import { applyThemePreference } from "./theme/applyThemePreference";
import { getModelPricing } from "./models";

export function App() {
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const [mobilePane, setMobilePane] = useState<"conversation" | "desktop">("conversation");
  const themePreference = useWorkspaceStore((state) => state.settings.theme);
  const reactScanEnabled = useWorkspaceStore((state) => state.settings.reactScanEnabled);
  const workspaceModelId = useWorkspaceStore((state) => state.settings.modelId);
  const workspaceApiKey = useWorkspaceStore((state) => state.settings.apiKey);
  const workspaceBaseUrl = useWorkspaceStore((state) => state.settings.baseUrl);
  const workspaceApprovalGatedTools = useWorkspaceStore((state) => state.settings.approvalGatedTools);
  const initialChatSettings = useMemo(
    () => ({
      modelId: workspaceModelId ?? null,
      apiKey: workspaceApiKey || undefined,
      baseUrl: workspaceBaseUrl || undefined,
      approvalGatedTools: workspaceApprovalGatedTools ? [...workspaceApprovalGatedTools] : [],
      credentialsReady: Boolean(workspaceApiKey || workspaceBaseUrl),
      modelPricing: getModelPricing(workspaceModelId || undefined),
    }),
    [workspaceModelId, workspaceApiKey, workspaceBaseUrl, workspaceApprovalGatedTools],
  );
  const conversationStoreRef = useRef<ReturnType<typeof createConversationStore> | null>(null);
  if (!conversationStoreRef.current) {
    conversationStoreRef.current = createConversationStore({
      chatSettings: initialChatSettings,
    });
  }
  const conversationStore = conversationStoreRef.current;
  if (!conversationStore) {
    throw new Error("Conversation store failed to initialize");
  }

  useEffect(() => {
    setupPlayground();
  }, []);

  useEffect(() => {
    conversationStore.setState((state) => {
      state.chatSettings.modelId = workspaceModelId ?? null;
      state.chatSettings.apiKey = workspaceApiKey || undefined;
      state.chatSettings.baseUrl = workspaceBaseUrl || undefined;
      state.chatSettings.approvalGatedTools = workspaceApprovalGatedTools ? [...workspaceApprovalGatedTools] : [];
      state.chatSettings.credentialsReady = Boolean(workspaceApiKey || workspaceBaseUrl);
      state.chatSettings.modelPricing = getModelPricing(workspaceModelId || undefined);
      return state;
    });
  }, [conversationStore, workspaceModelId, workspaceApiKey, workspaceBaseUrl, workspaceApprovalGatedTools]);

  useEffect(() => {
    applyThemePreference(themePreference);
  }, [themePreference]);

  useEffect(() => {
    updateReactScanState(reactScanEnabled);
  }, [reactScanEnabled]);

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
    <KasUIProvider store={conversationStore}>
      <Flex direction="column" height="100%" padding={["1", "3"]} gap="3" flex="1" width="100%">
        <TopBar mobileCenterContent={mobileToggleButton} />
        <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
          <ConversationHost />
        </Box>
      </Flex>
    </KasUIProvider>
  );

  const desktopPane = isMobile ? (
    <KasUIProvider store={conversationStore}>
      <Flex direction="column" height="100%" padding={["1", "3"]} gap="3" flex="1" width="100%">
        <TopBar mobileCenterContent={mobileToggleButton} />
        <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md" height="100%">
          <Desktop />
        </Box>
      </Flex>
    </KasUIProvider>
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
