// Support Vite-style asset imports in Storybook stories.
declare module "*?url" {
  const assetUrl: string;
  export default assetUrl;
}

declare module "*?raw" {
  const rawSource: string;
  export default rawSource;
}
