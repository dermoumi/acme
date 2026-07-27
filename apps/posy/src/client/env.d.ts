declare global {
  interface ImportMetaEnv {
    // Injected in vite.config.ts from the package.json version.
    readonly VITE_APP_VERSION: string;
    // Deploy tier, mirrored from APP_ENV at build time.
    readonly VITE_APP_ENV: string | undefined;
    // Short commit sha, mirrored from APP_REVISION at build time.
    readonly VITE_APP_REVISION: string | undefined;
  }
}

export {};
