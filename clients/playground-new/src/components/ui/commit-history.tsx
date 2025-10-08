import { ROOT } from "@/constant";
import { useCommitHistory } from "@/services/git/hooks";
import { Box, Button, CloseButton, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";

export function CommitHistory() {
  const {
    commits,
    error,
    checkingOut,
    currentOid,
    savePromptOpen,
    saving,
    setSavePromptOpen,
    onCheckoutCommit,
    confirmSaveThenCheckout,
    skipSaveAndCheckout,
  } = useCommitHistory(ROOT);

  const items = useMemo(() => commits || [], [commits]);

  const isEmpty = (commits && commits.length === 0) || (!commits && !error);

  return (
    <Stack gap="sm" height="100%">
      <Box flex="1" overflowY="auto">
        {error ? (
          <Box padding="sm">
            <Text color="fg.secondary">{error}</Text>
          </Box>
        ) : commits == null ? (
          <Box padding="sm">
            <Text color="fg.secondary">Loading commit history…</Text>
          </Box>
        ) : isEmpty ? (
          <Box padding="sm">
            <Text color="fg.secondary">No commits on main yet. Make a commit to see history.</Text>
          </Box>
        ) : (
          <Stack>
            {items.map((c) => {
              const when = c.isoDate ? new Date(c.isoDate).toLocaleString() : "";
              const title = (c.message || "").split(/\r?\n/)[0] ?? "";
              const meta: string[] = [];

              if (c.author) meta.push(c.author);
              if (when) meta.push(when);

              const isCurrent = currentOid === c.oid;

              return (
                <Box
                  key={c.oid}
                  role="button"
                  tabIndex={0}
                  cursor={checkingOut ? "progress" : "pointer"}
                  borderWidth="1px"
                  borderColor={isCurrent ? "border.secondary" : "transparent"}
                  rounded="md"
                  padding="sm"
                  _hover={{ background: "background.secondary" }}
                  onClick={() => (checkingOut ? null : onCheckoutCommit(c.oid))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onCheckoutCommit(c.oid);
                  }}
                >
                  <Text fontWeight="medium">{title}</Text>
                  <HStack gap="xs" align="center" mt="1">
                    <Text color="fg.secondary">{meta.length ? `— ${meta.join(" • ")}` : ""}</Text>
                    {isCurrent ? <Text color="foreground.primary">• Current</Text> : null}
                  </HStack>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Save changes modal */}
      <Dialog.Root open={savePromptOpen} onOpenChange={(e) => setSavePromptOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Text textStyle="heading/M">Save changes</Text>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Text color="fg.secondary">You have unsaved changes. Create a new version before switching?</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap="xs">
                <Button onClick={() => void skipSaveAndCheckout()} disabled={saving}>
                  Don't save
                </Button>
                <Button onClick={confirmSaveThenCheckout} loading={saving} variant="solid">
                  Save changes
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
}
