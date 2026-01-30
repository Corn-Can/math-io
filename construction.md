src/
├── assets/             # 靜態資源 (圖片、音效)
├── components/         # --- 共用 UI 元件 ---
│   ├── layout/         # 佈局 (Sidebar, AdContainer)
│   ├── ui/             # 基礎元件 (Button, Modal, Input)
│   ├── lobby/          # 房間設定面板 (參考你的截圖)
│   │   ├── RoomSettings.vue
│   │   ├── ChatBox.vue
│   │   └── PlayerList.vue
│   └── game/           # 遊戲外框 (計分板、倒數計時)
├── games/              # --- 遊戲模組核心 (擴充重點) ---
│   ├── registry.ts     # [核心] 遊戲註冊表 (管理所有遊戲)
│   ├── fruitbox/       # 遊戲 1: 湊十
│   │   ├── Config.vue  # 該遊戲特有的設定 (如: 石化機率)
│   │   ├── Game.vue    # 遊戲主畫面
│   │   └── Tutorial.vue# 教學說明
│   ├── sudoku/         # 遊戲 2: 數獨 (未來擴充)
│   └── logic/          # 共用的數學邏輯庫
├── store/              # 狀態管理 (Pinia) - 管理 User, Room 狀態
├── views/              # 頁面
│   ├── HomeView.vue    # 遊戲大廳 (選遊戲)
│   └── RoomView.vue    # 遊戲房間 (設定 -> 遊玩)
└── App.vue             # 主入口