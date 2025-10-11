import { Button, CloseButton, Dialog, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

interface DeleteConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: (e: any) => void;
  headline?: string;
  notificationText?: string;
  buttonText?: string;
  closeOnInteractOutside?: boolean;
}

export type { DeleteConfirmationModalProps };

export const DeleteConfirmationModal = (props: DeleteConfirmationModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { headline, buttonText, notificationText, onDelete, open, onClose, closeOnInteractOutside = true } = props;

  return (
    <Dialog.Root open={open} onOpenChange={onClose} closeOnInteractOutside={closeOnInteractOutside}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">{headline}</Text>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>{notificationText}</Dialog.Body>
          <Dialog.Footer>
            <Stack direction="row" gap="xs">
              <Button onClick={onClose}>Close</Button>
              <Button
                loading={isDeleting}
                variant="solid"
                onClick={async (e) => {
                  setIsDeleting(true);
                  try {
                    await onDelete(e);
                    onClose();
                  } catch (error) {
                    console.error("DeleteConfirmationModal: delete action failed", error);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                {buttonText}
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
