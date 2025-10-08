// Provide typings for Vite ?raw imports used throughout the stories.
declare module "*?raw" {
  const rawContent: string;
  export default rawContent;
}
