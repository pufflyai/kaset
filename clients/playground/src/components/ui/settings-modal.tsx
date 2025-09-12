import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import {
  Alert,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Field,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { DEFAULT_APPROVAL_GATED_TOOLS } from "@pstdio/kas";
import { useEffect, useState } from "react";

const TOOL_LABELS: Record<string, string> = {
  opfs_write_file: "Write file",
  opfs_delete_file: "Delete file",
  opfs_patch: "Apply patch",
  opfs_upload_files: "Upload files",
  opfs_move_file: "Move file",
};

export function SettingsModal(props: { isOpen: boolean; onClose: () => void }) {
  const { isOpen, onClose } = props;

  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [model, setModel] = useState<string>("gpt-4.1-mini");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [approvalTools, setApprovalTools] = useState<string[]>([...DEFAULT_APPROVAL_GATED_TOOLS]);

  useEffect(() => {
    if (!isOpen) return;
    const s = useWorkspaceStore.getState();
    setApiKey(s.apiKey || "");
    setBaseUrl(s.baseUrl || "");
    setModel(s.modelId || "gpt-5-mini");
    setApprovalTools(s.approvalGatedTools || [...DEFAULT_APPROVAL_GATED_TOOLS]);
  }, [isOpen]);

  const save = () => {
    useWorkspaceStore.setState(
      (state) => {
        state.apiKey = apiKey || undefined;
        state.baseUrl = baseUrl || undefined;
        state.modelId = model || "gpt-4.1-mini";
        state.approvalGatedTools = [...approvalTools];
      },
      false,
      "settings/save-llm-config",
    );

    onClose();
  };

  const clear = () => {
    useWorkspaceStore.setState(
      (state) => {
        state.apiKey = undefined;
        state.baseUrl = undefined;
        state.modelId = "gpt-5-mini";
        state.approvalGatedTools = [...DEFAULT_APPROVAL_GATED_TOOLS];
      },
      false,
      "settings/clear-llm-config",
    );
    setApiKey("");
    setBaseUrl("");
    setModel("gpt-5-mini");
    setApprovalTools([...DEFAULT_APPROVAL_GATED_TOOLS]);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} closeOnInteractOutside={false}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">Settings</Text>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <VStack gap="md">
              <Alert.Root status="info">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title fontWeight="bold">Local Playground</Alert.Title>
                  <Alert.Description>
                    Everything you create and configure here stays on your device. No data is uploaded or stored in the
                    cloud.
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
              <Field.Root>
                <Field.Label>Model</Field.Label>
                <Input placeholder="gpt-5-mini" value={model} onChange={(e) => setModel(e.target.value)} />
              </Field.Root>
              <Field.Root>
                <Field.Label>OpenAI API Key</Field.Label>
                <HStack>
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <Button onClick={() => setShowKey((v) => !v)}>{showKey ? "Hide" : "Show"}</Button>
                </HStack>
              </Field.Root>
              <Field.Root>
                <Field.Label>OpenAI Base URL (optional)</Field.Label>
                <Input
                  placeholder="https://api.openai.com/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </Field.Root>
              <Flex gap="xs" direction="column" width="100%">
                <Text>Approval-gated tools</Text>
                <VStack align="stretch">
                  {DEFAULT_APPROVAL_GATED_TOOLS.map((tool) => (
                    <Checkbox.Root
                      key={tool}
                      checked={approvalTools.includes(tool)}
                      onCheckedChange={(e) => {
                        console.log(e.checked, tool, DEFAULT_APPROVAL_GATED_TOOLS);
                        setApprovalTools((prev) => (e.checked ? [...prev, tool] : prev.filter((t) => t !== tool)));
                      }}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>{TOOL_LABELS[tool]}</Checkbox.Label>
                    </Checkbox.Root>
                  ))}
                </VStack>
              </Flex>
            </VStack>
          </Dialog.Body>
          <Dialog.Footer gap="sm">
            <Button variant="outline" onClick={clear}>
              Clear
            </Button>
            <Button onClick={save} variant="solid">
              Save
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
