import { ref } from 'vue';
// src/utils/audio.ts

// --- 1. 音效 (SFX) 設定 ---
const SOUND_LIBRARY = {
  common: {
    click: '/sounds/common/click.ogg',
    win: '/sounds/common/win.ogg',
    lose: '/sounds/common/lose.ogg',
    select: '/sounds/common/select.ogg',
  },
  fruitbox: {
    match: '/sounds/games/fruitbox/match.ogg',
    error: '/sounds/games/fruitbox/error.ogg',
    select: '/sounds/games/fruitbox/select.ogg',
  },
  sudoku: {
    match: '/sounds/games/sudoku/match.ogg',
    error: '/sounds/games/sudoku/error.ogg',
    select: '/sounds/games/sudoku/select.ogg',
  },
  seige: {
    move: '/sounds/games/seige/move.ogg',
    attack: '/sounds/games/seige/attack.ogg',
    win: '/sounds/games/seige/win.ogg',
  }
};

type SoundCategory = keyof typeof SOUND_LIBRARY;
type SoundName<T extends SoundCategory> = keyof typeof SOUND_LIBRARY[T];
const audioCache: Map<string, HTMLAudioElement> = new Map();

let sfxVolume = 0.5;

// --- 2. 背景音樂 (BGM) 設定 ---
// 使用 eager: true 確保路徑字串直接可用
const lobbyMusicFiles = import.meta.glob('@/assets/music/lobby/*.mp3', { eager: true, as: 'url' });
const gameMusicFiles = import.meta.glob('@/assets/music/game/*.mp3', { eager: true, as: 'url' });

const BGM_LIBRARY = {
  lobby: Object.values(lobbyMusicFiles),
  game: Object.values(gameMusicFiles),
};

export type BgmCategory = keyof typeof BGM_LIBRARY;

// 使用全域變數 (window) 來存儲 BGM 實例，防止 HMR 熱更新時丟失參考
// 這樣即使你存檔重整，我們也能找到上一個正在播的音樂並把它關掉
const GLOBAL_BGM_KEY = '__MATH_IO_BGM__';
const getGlobalBgm = () => (window as any)[GLOBAL_BGM_KEY] as HTMLAudioElement | null;
const setGlobalBgm = (audio: HTMLAudioElement | null) => { (window as any)[GLOBAL_BGM_KEY] = audio; };

let currentCategory: BgmCategory | null = null;
export const isBgmPlaying = ref(true);
let bgmVolume = 0.2;

// --- SFX 播放功能 ---
export const playSound = <T extends SoundCategory>(
  category: T,
  name: SoundName<T>,
  volume = 1.0
) => {
  try {
    const path = SOUND_LIBRARY[category][name] as string;
    if (!path) return;

    const cacheKey = `${category}/${String(name)}`;
    let audio = audioCache.get(cacheKey);

    if (!audio) {
      audio = new Audio(path);
      audioCache.set(cacheKey, audio);
    }

    audio.currentTime = 0;
    audio.volume = volume * sfxVolume;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => { });
    }
  } catch (err) {
    console.warn(`播放音效失敗:`, err);
  }
};

export const setSfxVolume = (vol: number) => {
  sfxVolume = vol;
};


// --- BGM 播放功能 ---

export const playBgm = (category: BgmCategory) => {
  // 優化：如果「現在正在播」且「分類相同」，就不要重播 (無縫體驗)
  // 這樣當你從 Lobby 進到某個子頁面又回 Lobby 時，音樂不會中斷
  const currentBgm = getGlobalBgm();
  if (currentCategory === category && isBgmPlaying.value && currentBgm && !currentBgm.paused) {
    return;
  }

  currentCategory = category;

  if (isBgmPlaying.value) {
    playRandomTrackInCategory(category);
  } else {
    stopBgm(false);
  }
};

const playRandomTrackInCategory = (category: BgmCategory) => {
  const playlist = BGM_LIBRARY[category];

  if (!playlist || playlist.length === 0) return;

  // 1. 強制停止當前音樂
  stopBgm(false);

  // 2. 選歌
  const randomIndex = Math.floor(Math.random() * playlist.length);
  const path = playlist[randomIndex];

  // 3. 建立新音樂並存到全域
  const newBgm = new Audio(path);
  newBgm.volume = bgmVolume;
  setGlobalBgm(newBgm);

  newBgm.addEventListener('ended', () => {
    if (isBgmPlaying.value && currentCategory === category) {
      playRandomTrackInCategory(category);
    }
  });

  const playPromise = newBgm.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        isBgmPlaying.value = true;
      })
      .catch((err) => {
        console.warn('BGM 自動播放被阻擋:', err);
        isBgmPlaying.value = false;
      });
  }
};

export const stopBgm = (resetCategory = true) => {
  const currentBgm = getGlobalBgm();
  if (currentBgm) {
    currentBgm.pause();
    currentBgm.currentTime = 0;
    setGlobalBgm(null); // 清除參照
  }
  if (resetCategory) {
    currentCategory = null;
  }
};

export const toggleBgm = () => {
  const currentBgm = getGlobalBgm();

  if (isBgmPlaying.value) {
    // 關閉
    if (currentBgm) currentBgm.pause();
    isBgmPlaying.value = false;
  } else {
    // 開啟
    isBgmPlaying.value = true;
    if (currentBgm) {
      currentBgm.play();
    } else {
      playBgm(currentCategory || 'lobby');
    }
  }
  return isBgmPlaying.value;
};

export const setBgmVolume = (vol: number) => {
  bgmVolume = vol;
  const currentBgm = getGlobalBgm();
  if (currentBgm) currentBgm.volume = vol;
};

// 🔥 HMR 熱更新清理機制
// 這是專門為了解決「開發時存檔會重疊音樂」的問題
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopBgm(false);
  });
}