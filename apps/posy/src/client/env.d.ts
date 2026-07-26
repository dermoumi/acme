declare global {
  interface ImportMetaEnv {
    // Injected in vite.config.ts from the package.json version.
    readonly VITE_APP_VERSION: string;
  }
}

export {};
