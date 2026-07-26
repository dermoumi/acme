// vite/client declares this, but src/server types against workers globals only
// and pulling vite/client in would drag DOM lib back with it.
declare module "*?raw" {
  const content: string;
  export default content;
}
