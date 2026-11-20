import { storage } from "./tsimports"

interface SettingsInterface {
  fresh_type: number; //视频推荐相关度，范围1-3，根据大数据推送
  home_vid_count: number;
  // 专栏articleshow的每页dom节点裁切数量（单页最大dom数）
  article_split_dom_count: number;
  enableFullAnimation: boolean;
  startupPage: string;

  // 下面的设置项将不在设置页面中展示
  agreedAllAgreements: boolean;
  enableUserTracker: boolean;

  pinnedDMUsers: Array<string>;
}

// 初始设置
export let SETTINGS: SettingsInterface = {
  fresh_type: 3,
  home_vid_count: 10,
  article_split_dom_count: 9999,
  enableFullAnimation: false,
  startupPage: "主页",

  agreedAllAgreements: false, // 是否已同意所有协议（用户协议 隐私协议 etc.）
  enableUserTracker: true,

  pinnedDMUsers: []
};

// 是否已从本地存储成功读过设置。
// 读取失败/尚未完成时，SETTINGS 只是默认值，调用方不能据此判断“用户未同意协议”。
let settingsLoaded = false;
// 本次会话内用户主动同意过协议：防止迟到的磁盘旧值把内存中的 true 覆盖回 false
let consentGrantedThisSession = false;
let settingsLoadPromise: Promise<boolean> | null = null;
// 最近一次读取尝试的编号，用于丢弃被新尝试取代的迟到回调
let latestLoadAttempt = 0;

function readSettingsFromStorage(): Promise<boolean> {
  const attemptId = ++latestLoadAttempt;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let attempts = 0;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    // 底层一直不回调时也不能让启动检查永远卡住
    const timer = setTimeout(() => {
      global.logger.warn('[settings] storage.get timed out');
      finish(false);
    }, 2500);

    const attempt = () => {
      attempts++;
      storage.get({
        key: 'settings',
        success: function (data) {
          clearTimeout(timer);
          // 已被更新的读取尝试取代：不要再把旧快照合并进内存
          if (attemptId !== latestLoadAttempt) {
            finish(false);
            return;
          }
          if (data) {
            try {
              const storedSettings = JSON.parse(data);
              SETTINGS = {
                ...SETTINGS,
                ...storedSettings
              };
            } catch (e) {
              global.logger.error('[settings] failed to parse stored settings:', e);
              finish(false);
              return;
            }
          }
          if (consentGrantedThisSession) {
            SETTINGS.agreedAllAgreements = true;
          }
          settingsLoaded = true;
          global.logger.log('Settings loaded:', SETTINGS);
          finish(true);
        },
        fail: function (data, code) {
          global.logger.log(`Failed to load settings, code = ${code}, attempt = ${attempts}`);
          if (attempts < 3) {
            setTimeout(attempt, 250 * attempts);
          } else {
            clearTimeout(timer);
            finish(false);
          }
        }
      });
    };
    attempt();
  });
}

// 读取设置。返回值表示是否成功读到本地设置（true 也包括“本地确实没有存过设置”）。
// 返回 false 时 SETTINGS 只是默认值，调用方不能据此下结论。
export function loadSettings(): Promise<boolean> {
  if (!settingsLoadPromise) {
    settingsLoadPromise = readSettingsFromStorage().then((ok) => {
      if (!ok) {
        settingsLoadPromise = null; // 允许下次调用重试
      }
      return ok;
    });
  }
  return settingsLoadPromise;
}

export function isSettingsLoaded(): boolean {
  return settingsLoaded;
}

export async function saveSettings(params: Partial<SettingsInterface>): Promise<boolean> {
  // 首次读取还没完成/失败过时先补一次读取，否则会把默认值（尤其是 agreedAllAgreements: false）写回磁盘
  if (!settingsLoaded) {
    await loadSettings();
  }
  SETTINGS = {
    ...SETTINGS,
    ...params
  };
  if (params.agreedAllAgreements === true) {
    consentGrantedThisSession = true;
  }
  if (!settingsLoaded && params.agreedAllAgreements !== true) {
    // 读不到旧设置时，除“用户明确同意协议”以外不写回，避免默认值覆盖用户的真实设置
    global.logger.error('[settings] settings not loaded, skip writing to storage');
    return false;
  }
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => {
      global.logger.warn('[settings] storage.set timed out');
      finish(false);
    }, 2000);
    storage.set({
      key: 'settings',
      value: JSON.stringify(SETTINGS), // 每次写入都重新序列化当前内存值
      success: function () {
        clearTimeout(timer);
        settingsLoaded = true;
        global.logger.log('Settings saved successfully');
        finish(true);
      },
      fail: function (data, code) {
        clearTimeout(timer);
        global.logger.log(`Failed to save settings, code = ${code}`);
        finish(false);
      }
    });
  });
}