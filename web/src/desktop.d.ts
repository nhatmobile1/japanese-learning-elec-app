export {};

declare global {
  interface Window {
    desktop?: {
      onMenuAction: (cb: (id: string) => void) => void;
      retry: () => void;
    };
  }
}
