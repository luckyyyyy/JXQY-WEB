interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEMO_RESOURCES_DOMAIN?: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
