import { Box } from "@chakra-ui/react";

type DragOverlayProps = {
  visible: boolean;
  message?: string;
};

export function DragOverlay({ visible, message }: DragOverlayProps) {
  if (!visible) return null;

  return (
    <Box
      position="absolute"
      inset={0}
      bg="rgba(0,0,0,0.4)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
      zIndex={1000}
    >
      <Box
        bg="white"
        color="black"
        borderRadius="md"
        borderWidth="1px"
        padding="6"
        boxShadow="lg"
        fontWeight="semibold"
      >
        {message ?? "Drop files to upload to OPFS playground"}
      </Box>
    </Box>
  );
}

export default DragOverlay;
