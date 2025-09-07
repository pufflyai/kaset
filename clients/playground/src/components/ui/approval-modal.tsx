import { Box, Button, CloseButton, Dialog, Field, Input, Text } from "@chakra-ui/react";
import { type ApprovalRequest } from "../../services/ai/KAS/approval";

export function ApprovalModal(props: { request: ApprovalRequest | null; onApprove: () => void; onDeny: () => void }) {
  const { request, onApprove, onDeny } = props;
  const isOpen = !!request;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onDeny()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            Approval Required
            <Dialog.CloseTrigger>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Text fontSize="sm" color="foreground.secondary" mb="sm">
              A tool requested permission to modify files in your workspace.
            </Text>
            <Field.Root mb="sm">
              <Field.Label>Tool</Field.Label>
              <Input value={request?.tool || ""} readOnly />
            </Field.Root>
            <Field.Root mb="sm">
              <Field.Label>Workspace</Field.Label>
              <Input value={request?.workspaceDir || ""} readOnly />
            </Field.Root>
            {request?.detail ? (
              <Field.Root>
                <Field.Label>Detail</Field.Label>
                <Box maxWidth="100%" as="pre" p={3} borderWidth="1px" borderRadius="md" overflowX="auto">
                  {typeof request.detail === "string" ? request.detail : JSON.stringify(request.detail, null, 2)}
                </Box>
              </Field.Root>
            ) : null}
          </Dialog.Body>
          <Dialog.Footer gap="sm">
            <Button onClick={onDeny} variant="outline">
              Deny
            </Button>
            <Button onClick={onApprove} variant="solid">
              Approve
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
