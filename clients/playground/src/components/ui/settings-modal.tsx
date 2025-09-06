import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { Button, Dialog, Field, HStack, Input } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export function SettingsModal(props: { isOpen: boolean; onClose: () => void }) {
  const { isOpen, onClose } = props;

  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [model, setModel] = useState<string>("gpt-4.1-mini");
  const [showKey, setShowKey] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const s = useWorkspaceStore.getState();
    setApiKey(s.local.apiKey || "");
    setBaseUrl(s.local.baseUrl || "");
    setModel(s.local.modelId || "gpt-5-mini");
  }, [isOpen]);

  const save = () => {
    useWorkspaceStore.setState(
      (state) => {
        state.local.apiKey = apiKey || undefined;
        state.local.baseUrl = baseUrl || undefined;
        state.local.modelId = model || "gpt-4.1-mini";
      },
      false,
      "settings/save-llm-config",
    );
    onClose();
  };

  const clear = () => {
    useWorkspaceStore.setState(
      (state) => {
        state.local.apiKey = undefined;
        state.local.baseUrl = undefined;
        state.local.modelId = "gpt-5-mini";
      },
      false,
      "settings/clear-llm-config",
    );
    setApiKey("");
    setBaseUrl("");
    setModel("gpt-5-mini");
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>Settings</Dialog.Header>
          <Dialog.Body>
            <Field.Root mb={3}>
              <Field.Label>Model</Field.Label>
              <Input placeholder="gpt-5-mini" value={model} onChange={(e) => setModel(e.target.value)} />
            </Field.Root>
            <Field.Root mb={3}>
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
          </Dialog.Body>
          <Dialog.Footer gap={2}>
            <Button variant="outline" onClick={clear}>
              Clear
            </Button>
            <Button onClick={save} colorPalette="blue">
              Save
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
