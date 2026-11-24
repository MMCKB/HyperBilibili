import { storage, router } from '../../tsimports';
import { AccountData } from './accountData';

// 登录相关的方法
export const BilibiliClientLoginMethods = {
    // 更新账号信息
    async updateAccountInfo(this: any): Promise<boolean> {
        const accountInfoResponse = await this.getRequest("https://api.bilibili.com/x/web-interface/nav");

        // 请求失败（网络问题）时 getRequest 返回 undefined，不能当成“会话失效”
        if (!accountInfoResponse || !accountInfoResponse.data || !accountInfoResponse.data.data) {
            global.logger.error('获取账号信息失败，保留当前登录状态');
            return false;
        }

        if(!accountInfoResponse.data.data.isLogin){
            router.clear();
            router.replace({
                uri: "pages/error/sessionood"
            })
            return false;
        }

        this.accountInfo = accountInfoResponse.data.data;
        return true;
    },

    // 刷新BUVID
    async updateBUVID(this: any) {
        const response = await this.getRequest("https://api.bilibili.com/x/frontend/finger/spi");
        if (!response || !response.data || !response.data.data) {
            global.logger.log('获取BUVID失败');
            return;
        }
        this.buvid3 = response.data.data.b_3;
        this.buvid4 = response.data.data.b_4;
    },

    // 获取二维码信息
    async loginQR(this: any): Promise<{ url: string, qrcode_key: string }> {
        global.logger.log("请求登录二维码");
        const response = await this.getRequest('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');
        if (response && response.data) {
            this.qrCodeKey = response.data.data.qrcode_key;
            return { url: response.data.data.url, qrcode_key: response.data.data.qrcode_key };
        } else {
            throw new Error('获取二维码失败');
        }
    },

    // 登录函数，使用本地存储的账号数据或通过二维码登录
    async login(this: any, send_req: boolean, interval: NodeJS.Timeout | null = null): Promise<{ success: boolean, message: string }> {
        const accountData = await this.getStoredAccountData();
        if (accountData) {
            this.sessData = accountData.sessData;
            this.biliJct = accountData.biliJct;
            this.dedeUserID = accountData.dedeUserID;
            this.sid = accountData.sid;
            this.extraCookies = accountData.extraCookies || {};
            global.logger.log('使用存储的账号数据登录成功');
            global.logger.log('拉账号信息')
            const accountInfoOk = await this.updateAccountInfo();
            if (!accountInfoOk) {
                // 让入口页保留本地账号并给用户重试机会，而不是带着空的账号信息进入主页
                return { success: false, message: "获取账号信息失败，请重试" };
            }
            global.logger.log('拉buvid')
            await this.updateBUVID();

            return { success: true, message: "登录成功" };
        } else if (send_req) {
            const response = await this.getRequest(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${this.qrCodeKey}`);
            if (response && response.data && response.data.data.code === 0) {
                if (interval) clearInterval(interval);

                this.extractCookiesFromResponse(response.headers['Set-Cookie']);
                await this.storeAccountData();
                global.logger.log('使用二维码登录并存储账号数据成功');
                // 二维码已被消费，这里即使拉账号信息失败也应继续，避免用户卡在登录页
                if (!(await this.updateAccountInfo())) {
                    global.logger.error('二维码登录后获取账号信息失败');
                }
                await this.updateBUVID();
                return { success: true, message: "登录成功" };
            } else {
                return { success: false, message: "等待用户操作..." };
            }
        }
    },

    // 退出登录（清除内存中的登录态并删除本地存储的账号数据）
    logOut(this: any): Promise<boolean> {
        this.sessData = null;
        this.biliJct = null;
        this.dedeUserID = null;
        this.sid = null;
        this.extraCookies = {};
        this.accountInfo = null;

        return new Promise((resolve) => {
            let settled = false;
            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                resolve(ok);
            };
            const timer = setTimeout(() => {
                global.logger.warn('删除账号数据超时');
                finish(false);
            }, 1500);
            storage.delete({
                key: "bilibili_account",
                success: () => {
                    clearTimeout(timer);
                    finish(true);
                },
                fail: (data: any, code: number) => {
                    clearTimeout(timer);
                    global.logger.log(`删除账号数据失败，错误码 = ${code}`);
                    finish(false);
                }
            });
        });
    },

    // 从响应头中提取Cookies
    extractCookiesFromResponse(this: any, setCookieHeaders: string | string[]) {
        if (typeof setCookieHeaders === 'string') {
            setCookieHeaders = setCookieHeaders.split(', ');
        }
        if (!this.extraCookies) {
            this.extraCookies = {};
        }

        setCookieHeaders.forEach(cookie => {
            const nameMatch = cookie.match(/^\s*([^=;]+)=([^;]*)/);
            if (!nameMatch) {
                return;
            }
            const name = nameMatch[1].trim();
            const value = nameMatch[2];
            if (name === 'SESSDATA') this.sessData = value;
            else if (name === 'bili_jct') this.biliJct = value;
            else if (name === 'DedeUserID') this.dedeUserID = value;
            else if (name === 'sid') this.sid = value;
            else if (name === 'buvid3') this.buvid3 = value;
            else if (name === 'buvid4') this.buvid4 = value;
            else if (value) this.extraCookies[name] = value;
        });
    },

    // 辅助函数，用于解析cookie字符串
    parseCookie(this: any, cookie: string, name: string): string | null {
        const match = cookie.match(new RegExp(`${name}=([^;]+)`));
        return match ? match[1] : null;
    },

    // 获取本地存储的账号数据
    async getStoredAccountData(this: any): Promise<AccountData | null> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = (value: AccountData | null) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };
            // 存储层不回调时不能永远卡住登录流程
            const timer = setTimeout(() => {
                global.logger.warn('读取账号数据超时');
                finish(null);
            }, 2000);
            storage.get({
                key: 'bilibili_account',
                success: (data: string) => {
                    clearTimeout(timer);
                    if (!data) {
                        finish(null);
                        return;
                    }
                    try {
                        finish(JSON.parse(data) as AccountData);
                    } catch (e) {
                        global.logger.error('解析账号数据失败:', e);
                        finish(null);
                    }
                },
                fail: (data: any, code: number) => {
                    clearTimeout(timer);
                    global.logger.log(`获取存储的账号数据失败，错误码 = ${code}`);
                    finish(null);
                }
            });
        });
    },

    // 保存账号数据到本地存储
    async storeAccountData(this: any): Promise<void> {
        if (this.sessData && this.biliJct && this.dedeUserID && this.sid) {
            const accountData: AccountData = { sessData: this.sessData, biliJct: this.biliJct, dedeUserID: this.dedeUserID, sid: this.sid, extraCookies: this.extraCookies || {} };
            return new Promise((resolve, reject) => {
                storage.set({
                    key: 'bilibili_account',
                    value: JSON.stringify(accountData),
                    success: () => {
                        global.logger.log('账号数据存储成功');
                        resolve();
                    },
                    fail: (data: any, code: number) => {
                        global.logger.log(`存储账号数据失败，错误码 = ${code}`);
                        reject();
                    }
                });
            });
        }
        global.logger.error('账号数据不完整，未写入本地存储');
    }
};