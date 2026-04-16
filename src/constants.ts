export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 600;

export const COIN_CAP = 15;
export const BASE_RESPAWN_TIME = 3000; // ms
export const BASE_MOVEMENT_SPEED = 1.5;

export const COLORS = [
  '#FF5F5F', // Red
  '#5FFF5F', // Green
  '#5F5FFF', // Blue
  '#FFFF5F', // Yellow
  '#FF5FFF', // Magenta
  '#5FFFFF', // Cyan
  '#FFAF5F', // Orange
  '#AF5FFF', // Purple
];

export const TRAITS: string[] = ['Fast', 'Strong', 'Lucky', 'Hardy', 'Shiny'];

export const UPGRADE_COSTS = {
  automation: 50,
  movementSpeed: (level: number) => Math.floor(10 * Math.pow(1.5, level)),
  respawnTime: (level: number) => Math.floor(15 * Math.pow(1.6, level)),
  coinValue: (level: number) => Math.floor(20 * Math.pow(2, level)),
};

export const EGG_COST = 100;

export const SLIME_UPGRADE_COST = (level: number) => Math.floor(50 * Math.pow(1.8, level));

export const SLIME_NAMES = [
  'Bloop', 'Gloop', 'Squish', 'Pudding', 'Jelly', 'Mochi', 'Bubbles', 'Dewy',
  'Gummy', 'Splosh', 'Blobby', 'Slimy', 'Goopy', 'Sticky', 'Bounce', 'Plop',
  'Wobble', 'Glaze', 'Syrup', 'Honey', 'Berry', 'Minty', 'Coco', 'Sunny',
  'Cloudy', 'Sparky', 'Zippy', 'Chonky', 'Tiny', 'Peanut', 'Bean', 'Sprout'
];
