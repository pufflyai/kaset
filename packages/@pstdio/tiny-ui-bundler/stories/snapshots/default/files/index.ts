import { greeting } from "./message";
import "./styles.css";

export const storyGreeting = greeting;

export function describeBundle() {
  return `Greeting: ${greeting}`;
}

console.info("[Tiny UI Bundler] Compiled message:", greeting);
