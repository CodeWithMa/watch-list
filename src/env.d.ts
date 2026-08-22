interface ImportMetaEnv {
  APP_COMMIT_HASH: string;
  APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
