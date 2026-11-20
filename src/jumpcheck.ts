import { storage, router, network } from './tsimports';

// 读取本地账号数据（原始 JSON 字符串）。
// 冷启动时 storage.get 可能失败或回调很慢，这里带重试和超时，避免账号读取把启动流程卡住。
function readStoredAccount(): Promise<string | null> {
    return new Promise((resolve) => {
        let settled = false;
        let attempts = 0;
        const finish = (value: string | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const timer = setTimeout(() => finish(null), 2000);

        const attempt = () => {
            attempts++;
            storage.get({
                key: "bilibili_account",
                success: (data: string) => {
                    clearTimeout(timer);
                    finish(data || "");
                },
                fail: () => {
                    if (attempts < 3) {
                        setTimeout(attempt, 250 * attempts);
                    } else {
                        clearTimeout(timer);
                        finish(null);
                    }
                }
            });
        };
        attempt();
    });
}

// 解析本地账号数据：只有 JSON 可解析且四个字段齐全才算可登录的账号。
// 数据损坏时返回 null，调用方应走登录页，而不是带着坏数据进 prepage 反复失败。
function parseStoredAccount(data: string | null): any {
    if (!data) return null;
    try {
        const account = JSON.parse(data);
        if (account && account.sessData && account.biliJct && account.dedeUserID && account.sid) {
            return account;
        }
        global.logger.log("Stored account data is incomplete");
    } catch (e) {
        global.logger.log("Stored account data is corrupted:", e);
    }
    return null;
}

// 本地是否存在可用的账号数据
export async function HasStoredAccount(): Promise<boolean> {
    return !!parseStoredAccount(await readStoredAccount());
}

export async function Jump() {
    const account = parseStoredAccount(await readStoredAccount());
    if (!account) {
        router.replace({
            uri: "pages/app/entry/login"
        })
    } else {
        router.replace({
            uri: "pages/app/entry/prepage"
        })
    }
}

export async function NetworkCheck(): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            resolve(ok);
        };
        const timer = setTimeout(() => {
            global.logger.log('Network type check timed out.');
            finish(false);
        }, 5000);
        network.getType({
            success: function (data: { type: string }) {
                clearTimeout(timer);
                if (!data.type) {
                    global.logger.log('Network type is empty or undefined.');
                    finish(false);
                } else if (data.type === 'none') {
                    finish(false);
                } else {
                    finish(true);
                }
            },
            fail: function () {
                clearTimeout(timer);
                global.logger.log('Failed to get network type.');
                finish(false);
            },
            complete: function () {
                global.logger.log('Network type check completed.');
            }
        });
    });
}