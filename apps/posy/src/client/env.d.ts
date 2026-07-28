declare global {
  interface ImportMetaEnv {
    // Injected in vite.config.ts from the package.json name, scope stripped.
    readonly VITE_APP_NAME: string;
    // Injected in vite.config.ts from the package.json version.
    readonly VITE_APP_VERSION: string;
    // Deploy tier, mirrored from APP_ENV at build time.
    readonly VITE_APP_ENV: string;
    // Short commit sha, mirrored from APP_REVISION at build time.
    readonly VITE_APP_REVISION: string;
  }
}

export {};
