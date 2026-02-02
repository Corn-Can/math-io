export interface GameConfigOption {
  type: 'number' | 'select' | 'boolean';
  label: string;
  default: any;
  min?: number; // For number type
  max?: number; // For number type
  step?: number; // For number type
  options?: { value: string | number; label: string }[]; // For select type
}

export interface GameHelpSection {
  titleKey?: string;
  image?: string;
  contentKey?: string;
}

export interface GameHelpSchema {
  overview: GameHelpSection;
  howToPlay: GameHelpSection[];
  controlsKey?: string;
}

// 定義一個標準的遊戲介面
export interface GameModule {
  id: string;          // 例如 'fruitbox'
  nameKey: string;        // 顯示名稱 '湊十對戰'
  descriptionKey: string; // 簡介
  thumbnail: string;   // 封面圖
  modes: {             // 支援的模式
    id: string;
    labelKey: string;
    descriptionKey: string;
  }[];
  configSchema?: Record<string, GameConfigOption>; // 通用設定欄位 (Data-Driven UI)
  help?: GameHelpSchema; // 遊戲說明
  maxPlayers?: number;

  // 動態引入元件 (Lazy Load)，讓首頁載入變快
  component: () => Promise<any>;
  settingsComponent?: () => Promise<any>;
  tutorialComponent?: () => Promise<any>;
  enableSinglePlayer?: boolean;
}

// 這裡是你未來新增遊戲唯一需要修改的地方
export const GAME_REGISTRY: Record<string, GameModule> = {
  fruitbox: {
    id: 'fruitbox',
    nameKey: 'game.fruitbox.nameKey',
    descriptionKey: 'game.fruitbox.descriptionKey',
    thumbnail: '/images/fruitbox/fruitbox-cover.jpg',
    maxPlayers: 8,
    modes: [
      {
        id: 'classic',
        labelKey: 'game.fruitbox.mode.classic.label',
        descriptionKey: 'game.fruitbox.mode.classic.desc'
      },
      {
        id: 'territory',
        labelKey: 'game.fruitbox.mode.territory.label',
        descriptionKey: 'game.fruitbox.mode.territory.desc'
      },
      {
        id: 'attack',
        labelKey: 'game.fruitbox.mode.attack.label',
        descriptionKey: 'game.fruitbox.mode.attack.desc'
      },
      {
        id: 'occupy',
        labelKey: 'game.fruitbox.mode.occupy.label',
        descriptionKey: 'game.fruitbox.mode.occupy.desc'
      }
    ],
    configSchema: {
      duration: {
        type: 'number',
        label: 'game.settings.duration',
        default: 120,
        min: 30,
        max: 300,
        step: 10
      }
    },
    help: {
      overview: {
        contentKey: "game.fruitbox.help.overview.content"
      },
      howToPlay: [
        {
          titleKey: "game.fruitbox.help.rules.0.title",
          image: '/images/fruitbox/help0.jpg',
          contentKey: "game.fruitbox.help.rules.0.content"
        },
        {
          titleKey: "game.fruitbox.help.rules.1.title",
          image: '/images/fruitbox/help1.jpg',
          contentKey: "game.fruitbox.help.rules.1.content"
        }
      ],
      controlsKey: "game.fruitbox.help.controls"
    },
    enableSinglePlayer: true,
    component: () => import('./fruitbox/Game.vue')
  },
  sudoku: {
    id: 'sudoku',
    nameKey: 'game.sudoku.nameKey',
    descriptionKey: 'game.sudoku.descriptionKey',
    thumbnail: '/images/sudoku/cover.jpg', // Placeholder
    maxPlayers: 8,
    enableSinglePlayer: true,
    modes: [
      {
        id: 'classic',
        labelKey: 'game.sudoku.mode.classic.label',
        descriptionKey: 'game.sudoku.mode.classic.desc'
      },
      {
        id: 'rush',
        labelKey: 'game.sudoku.mode.rush.label',
        descriptionKey: 'game.sudoku.mode.rush.desc'
      }
    ],
    configSchema: {
      size: {
        type: 'select',
        label: 'Grid Size',
        options: [
          { label: '4x4', value: 4 },
          { label: '6x6', value: 6 },
          { label: '9x9', value: 9 },
          { label: '16x16', value: 16 }
        ],
        default: 9
      },
      difficulty: {
        type: 'select',
        label: 'Difficulty',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Medium', value: 'medium' },
          { label: 'Hard', value: 'hard' }
        ],
        default: 'medium'
      },
      duration: {
        type: 'number',
        label: 'game.settings.duration',
        default: 300,
        min: 0,
        max: 3600,
        step: 60
      },
      mistakeLimit: {
        type: 'number',
        label: 'game.settings.mistakeLimit',
        default: 3,
        min: 0,
        max: 10,
        step: 1
      }
    },
    help: {
      overview: { contentKey: 'game.sudoku.help.overview' },
      howToPlay: [
        {
          titleKey: 'game.sudoku.help.rules.0.title',
          image: '/images/sudoku/help0.jpg',
          contentKey: 'game.sudoku.help.rules.0.content'
        },
        {
          titleKey: 'game.sudoku.help.rules.1.title',
          image: '/images/sudoku/help1.jpg',
          contentKey: 'game.sudoku.help.rules.1.content'
        },
        {
          titleKey: 'game.sudoku.help.rules.2.title',
          image: '/images/sudoku/help2.jpg',
          contentKey: 'game.sudoku.help.rules.2.content'
        }
      ],
      controlsKey: 'game.sudoku.help.controls'
    },
    component: () => import('./sudoku/Game.vue')
  },
  // seige: {
  //   id: 'seige',
  //   nameKey: 'game.seige.nameKey',
  //   descriptionKey: 'game.seige.descriptionKey',
  //   thumbnail: '/images/seige/cover.jpg', // Placeholder
  //   maxPlayers: 4,
  //   modes: [
  //     {
  //       id: 'classic',
  //       labelKey: 'game.seige.mode.classic.label',
  //       descriptionKey: 'game.seige.mode.classic.desc'
  //     },
  //     {
  //       id: 'item_war',
  //       labelKey: 'game.seige.mode.item_war.label',
  //       descriptionKey: 'game.seige.mode.item_war.desc'
  //     }
  //   ],
  //   configSchema: {
  //     size: {
  //       type: 'select',
  //       label: 'game.seige.config.size',
  //       options: [
  //         { label: '20x20', value: 20 },
  //         { label: '30x30', value: 30 },
  //         { label: '40x40', value: 40 }
  //       ],
  //       default: 20
  //     },
  //     roundLimit: {
  //       type: 'number',
  //       label: 'game.settings.roundLimit',
  //       default: 20,
  //       min: 10,
  //       max: 50,
  //       step: 5
  //     },
  //     roundDuration: {
  //       type: 'number',
  //       label: 'game.settings.roundDuration',
  //       default: 30,
  //       min: 0,
  //       max: 60,
  //       step: 3
  //     }
  //   },
  //   help: {
  //     overview: { contentKey: 'game.seige.help.overview' },
  //     howToPlay: [
  //       {
  //         titleKey: 'game.seige.help.rules.0.title',
  //         image: '/images/seige/help0.jpg',
  //         contentKey: 'game.seige.help.rules.0.content'
  //       },
  //       {
  //         titleKey: 'game.seige.help.rules.1.title',
  //         image: '/images/seige/help1.jpg',
  //         contentKey: 'game.seige.help.rules.1.content'
  //       },
  //       {
  //         titleKey: 'game.seige.help.rules.2.title',
  //         image: '/images/seige/help2.jpg',
  //         contentKey: 'game.seige.help.rules.2.content'
  //       }
  //     ],
  //     controlsKey: 'game.seige.help.controls'
  //   },
  //   component: () => import('./seige/Game.vue')
  // }
};