interface ImportMetaEnv {
  readonly VITE_APPLICATION_API_BASE?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type TurnstileWidgetId = string;

interface Window {
  turnstile?: {
    remove(widgetId: TurnstileWidgetId): void;
    render(container: HTMLElement, options: {
      action: string;
      callback(token: string): void;
      "error-callback"(): void;
      "expired-callback"(): void;
      sitekey: string;
      theme: "light" | "dark" | "auto";
    }): TurnstileWidgetId;
    reset(widgetId?: TurnstileWidgetId): void;
  };
}
