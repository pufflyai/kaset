import { desktopAPI } from "@/services/desktop/desktop-api";
import { usePluginDependenciesReady } from "@/services/plugins/hooks/usePluginDependenciesReady";
import { usePluginFilesRefresh } from "@/services/plugins/hooks/usePluginFileRefresh";
import { Box, Button, Center, Text } from "@chakra-ui/react";
import { TinyUI, type TinyUIStatus } from "@pstdio/tiny-ui";
import { useCallback, useState } from "react";
import { LoadingState } from "./loading-state";

export interface PluginWindowProps {
  pluginId: string;
  surfaceId: string;
  instanceId: string;
  snapshotVersion: number;
}

const style: React.CSSProperties = {
  width: "100%",
  height: "100%",
};

const isLoadingOverlayActive = (status: TinyUIStatus) => {
  return (
    status === "initializing" || status === "service-worker-ready" || status === "compiling" || status === "handshaking"
  );
};

export const PluginWindow = (props: PluginWindowProps) => {
  const { pluginId, surfaceId, instanceId } = props;

  const { ready: dependenciesReady } = usePluginDependenciesReady();
  const [status, setStatus] = useState<TinyUIStatus>("initializing");
  const [error, setError] = useState<string | null>(null);

  const refreshToken = usePluginFilesRefresh(pluginId);

  // a plugin can have multiple surfaces (e.g. sidebar, modal, etc)
  // each has a unique sourceId
  const sourceId = `${pluginId}:${surfaceId}`;

  const shouldSkipCache = refreshToken > 0;

  const handleTinyStatusChange = useCallback((nextStatus: TinyUIStatus) => {
    if (nextStatus === "error") return;
    setStatus(nextStatus);
  }, []);

  const handleTinyError = useCallback((tinyError: Error) => {
    setError(tinyError.message);
    setStatus("error");
  }, []);

  const handleActionCall = useCallback((actionId: string, payload: any) => {
    console.log("Plugin action called:", actionId, payload);
    desktopAPI[actionId as keyof typeof desktopAPI]?.(payload);
  }, []);

  if (status === "idle" || !dependenciesReady) {
    return null;
  }

  if (status === "error") {
    return (
      <Center height="100%" width="100%" padding="md">
        <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
          <Text fontSize="sm">Failed to load plugin window:</Text>
          {error ? (
            <Box marginTop="3">
              <Text fontSize="xs">{error}</Text>
              <Button
                marginTop="3"
                size="xs"
                variant="solid"
                onClick={() => {
                  navigator.clipboard.writeText(error);
                }}
              >
                Copy error message
              </Button>
            </Box>
          ) : null}
        </Box>
      </Center>
    );
  }

  const showOverlay = isLoadingOverlayActive(status);

  return (
    <Box height="100%" width="100%" position="relative">
      <TinyUI
        instanceId={instanceId}
        sourceId={sourceId}
        skipCache={shouldSkipCache}
        autoCompile
        onStatusChange={handleTinyStatusChange}
        onError={handleTinyError}
        onActionCall={handleActionCall}
        style={style}
      />
      {showOverlay && (
        <Center background="background.primary" position="absolute" inset={0} zIndex={1} pointerEvents={"all"}>
          <LoadingState title={status} />
        </Center>
      )}
    </Box>
  );
};
