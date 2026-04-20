import { registerPlugin } from '@capacitor/core';

export interface SystemUiPlugin {
  /** Hide status + navigation bars (swipe from edge to reveal transiently). */
  setImmersive(options: { hide: boolean }): Promise<void>;
}

export const SystemUi = registerPlugin<SystemUiPlugin>('SystemUi', {
  web: () => ({
    setImmersive: async () => {},
  }),
});
