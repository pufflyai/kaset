export const ROOT = "playground";
export const PLUGIN_ROOT = `${ROOT}/plugins`;

export const WALLPAPER_ROOT = `${ROOT}/wallpaper`;
export const DESKTOP_WALLPAPER_FILE = `${WALLPAPER_ROOT}/desktop.txt`;

const envDesktopBackgroundImage = import.meta.env.VITE_DESKTOP_BACKGROUND_IMAGE?.trim();

export const DESKTOP_BACKGROUND_IMAGE_OVERRIDE =
  envDesktopBackgroundImage && envDesktopBackgroundImage.length > 0
    ? envDesktopBackgroundImage
    : null;

export const examplePrompts = [
  "What can you do?",
  "Add a button to the hello world plugin that makes confetti",
  "Make a todo list for surviving Monday",
  "If my life were a 90s rom-com, what should I do today?",
  "Plan my Saturday like I'm living in a video game quest",
  "Make a heroic quest todo-list for surviving a trip to IKEA",
  "Give me three random quests from an alternate universe",
  "Gamify my todos: assign XP points to each one",
];
