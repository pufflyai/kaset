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
    try {
      setApiKey(localStorage.getItem("tiny-ai-api-key") || "");
      setBaseUrl(localStorage.getItem("tiny-ai-base-url") || "");
      setModel(localStorage.getItem("tiny-ai-model") || "gpt-4.1-mini");
    } catch {
      // ignore
    }
  }, [isOpen]);

  const save = () => {
    try {
      if (apiKey) localStorage.setItem("tiny-ai-api-key", apiKey);
      else localStorage.removeItem("tiny-ai-api-key");

      if (baseUrl) localStorage.setItem("tiny-ai-base-url", baseUrl);
      else localStorage.removeItem("tiny-ai-base-url");

      if (model) localStorage.setItem("tiny-ai-model", model);
      else localStorage.removeItem("tiny-ai-model");
    } catch {
      // ignore storage errors (private mode, etc.)
    }
    onClose();
  };

  const clear = () => {
    try {
      localStorage.removeItem("tiny-ai-api-key");
      localStorage.removeItem("tiny-ai-base-url");
      localStorage.removeItem("tiny-ai-model");
    } catch {
      // ignore
    }
    setApiKey("");
    setBaseUrl("");
    setModel("gpt-4.1-mini");
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
              <Input placeholder="gpt-4.1-mini" value={model} onChange={(e) => setModel(e.target.value)} />
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
