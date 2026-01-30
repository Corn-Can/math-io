# Math IO 開發者指南 (Developer Guide)

本指南將協助你了解專案架構，並教你如何擴充新的遊戲或模式。本專案採用 **模組化架構 (Modular Architecture)**，讓擴充變得簡單且低耦合。

## 1. 專案架構 (Project Structure)

```
d:/web_projects/math_io/math-io/
├── server/
│   ├── index.js           # 伺服器入口 (負責 Socket 連線與房間管理)
│   ├── Room.js            # 房間類別 (管理玩家、遊戲狀態)
│   └── games/             # [後端] 遊戲邏輯模組
│       ├── BaseGame.js    # 遊戲邏輯基底類別
│       └── FruitBox.js    # FruitBox 專屬邏輯 (繼承 BaseGame)
├── src/
│   ├── games/
│   │   ├── registry.ts    # [核心] 遊戲註冊表 (所有遊戲設定都在這與後端無關)
│   │   └── fruitbox/      # [前端] FruitBox 遊戲元件
│   │       ├── Game.vue   # 遊戲主畫面
│   │       └── logic.ts   # 純前端遊戲邏輯 (Engine)
│   ├── components/
│   │   ├── lobby/         # 大廳元件 (Settings, Players)
│   │   └── ui/            # 通用 UI (HelpModal, Button)
│   ├── store/             # Pinia 狀態管理 (Settings)
│   └── views/
│       └── RoomView.vue   # 房間主頁面 (負責協調大廳與遊戲元件)
```

---

## 2. 如何新增一款新遊戲？ (How to Add a Game)

假設你要新增一個遊戲叫 **Sudoku (數獨)**。

### 步驟 1：前端註冊
編輯 `src/games/registry.ts`，在 `GAME_REGISTRY` 中新增一筆資料：

```typescript
sudoku: {
  id: 'sudoku',
  name: 'Sudoku Battle',
  description: '多人數獨競速',
  thumbnail: '/images/sudoku.jpg',
  maxPlayers: 4,
  // 定義遊戲模式
  modes: [
    { id: 'classic', label: '經典', description: '標準 9x9' },
    { id: 'blitz', label: '極速', description: '3分鐘限時賽' }
  ],
  // 定義設定欄位 (大廳會自動生成 UI)
  configSchema: {
    difficulty: {
      type: 'select',
      label: '難度',
      default: 'medium',
      options: [
        { value: 'easy', label: '簡單' },
        { value: 'medium', label: '中等' },
        { value: 'hard', label: '困難' }
      ]
    }
  },
  // 遊戲說明 (顯示在幫助視窗)
  help: {
    overview: { content: "填滿 9x9 格子..." },
    howToPlay: [{ title: "規則", content: "..." }]
  },
  // 動態引入元件
  component: () => import('./sudoku/Game.vue'),
},
```

### 步驟 2：建立前端元件
在 `src/games/` 下建立 `sudoku/` 資料夾，並建立 `Game.vue`。
`Game.vue` 會接收以下 Props，請確保你的元件能處理它們：
```typescript
defineProps<{
  mode: string;           // 當前模式 (e.g., 'classic')
  options: any;           // 設定值 (e.g., { difficulty: 'easy' })
  seed?: number;          // 隨機種子 (用於同步題目)
  socket: Socket | null;  // Socket 連線物件
}>();
```

### 步驟 3：建立後端邏輯
在 `server/games/` 下建立 `Sudoku.js`，繼承 `BaseGame`：

```javascript
import BaseGame from './BaseGame.js';

export default class Sudoku extends BaseGame {
  constructor(room, io) {
    super(room, io);
  }

  // 處理前端送來的事件
  handleEvent(eventName, payload, socket) {
    if (eventName === 'sudoku-submit') {
       // 驗證答案...
       this.broadcast('player-progress', { id: socket.id, progress: 100 });
    }
  }
}
```

### 步驟 4：註冊後端類別
編輯 `server/Room.js`，引入並對應你的新遊戲類別：

```javascript
import Sudoku from './games/Sudoku.js';

const GAMES = {
  'fruitbox': FruitBox,
  'sudoku': Sudoku // 新增這一行
};
```

**完成！** 你的新遊戲現在已經出現在列表上，並且擁有自動生成的設定介面、幫助視窗和多人連線能力。

---

## 3. 如何新增遊戲模式？ (How to Add a Mode)

如果你只是想在現有遊戲 (例如 FruitBox) 增加新模式：

1.  **修改 Registry**：在 `registry.ts` 的 `modes` 陣列中加入新模式 (例如 `id: 'zen'`)。
2.  **前端實作**：在 `Game.vue` (或 `logic.ts`) 中，根據 `props.mode === 'zen'` 撰寫對應的渲染或邏輯判斷。
3.  **後端實作 (如需要)**：如果新模式有特殊規則 (例如不計時)，在 `server/games/FruitBox.js` 中根據 `this.room.mode` 做判斷。

## 4. UI 風格指南

本專案採用 **Warm White Minimalist (暖白極簡風)**。
- **背景**：`bg-stone-50`
- **卡片**：`bg-white rounded-2xl shadow-sm border border-stone-200`
- **文字**：主要 `text-stone-800`，次要 `text-stone-400`
- **互動**：按鈕通常有 `shadow-xl` 和 `active:scale-95` 效果。

請盡量重用 `src/components/ui` 下的元件以保持一致性。

## 5. 資源與多語系 (Assets & i18n)

### 5.1 如何新增圖片？
專案的靜態圖片存放於 `public/images/` 資料夾中。
1.  將你的圖片 (例如 `my-game-cover.jpg`) 放入 `public/images/`。
2.  在程式碼中直接引用：
    ```typescript
    thumbnail: '/images/my-game-cover.jpg'
    ```

### 5.2 如何使用翻譯文檔 (Localization)
專案內建 **Runtime Translation Tracker**，這是一個可以自動收集翻譯鍵值的開發工具，防止翻譯遺漏。

#### 開發流程 (Developer Workflow):

1.  **在程式碼中使用 `useT`**:
    引入我們特製的 Hook 來替代標準的 `t` 函式。這會自動追蹤你使用過的每一個 Key。
    ```typescript
    import { useT } from '@/utils/i18n-tracker';
    
    setup() {
      const { t } = useT(); // 使用這個取代 useI18n()
      
      return {
        title: t('game.title') // 這個 key 會被自動記錄
      };
    }
    ```

2.  **運行與測試**:
    在開發模式下運行網頁，點擊與瀏覽各個頁面，讓 Tracker 收集這些 Key。

3.  **生成翻譯模板**:
    前往首頁左上角的 **Settings (設定)** -> **Developer Tools** -> 點擊 **"Generate Translation Template"**。
    系統會下載一個 JSON 檔案，裡面包含所有 **"已使用但尚未翻譯"** 的 Key (值為空字串)，以及目前已有的翻譯。

4.  **填寫與更新**:
    打開下載的 JSON，填入缺失的翻譯文字，然後更新到 `src/i18n.ts` 或你的語系檔中。

**目前階段：**
專案初始設定為 `zh-TW`，你可以參考 `src/i18n.ts` 來擴充更多語言。
