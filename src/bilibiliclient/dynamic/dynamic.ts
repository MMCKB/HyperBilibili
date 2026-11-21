export const BilibiliClientDynamicMethods = {
    async getDynamicList(this: any, host_mid: number = 0, offset: number = 0): Promise<any>{
        let url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?platform=web`
        if (host_mid) url += `&host_mid=${host_mid}`;
        if (offset) url += `&offset=${offset}`;

        const response = await this.getRequest(url);
        return response.data.data;
    },

    // 分享视频到动态，有 aid 时发视频卡片，message 作为动态正文
    async createShareDynamic(this: any, bvid: string, title: string, aid: any, message: string = ""): Promise<any> {
        const csrf = encodeURIComponent(this.biliJct);
        const deviceReq = encodeURIComponent('{"platform":"web","device":"pc"}');
        const webReq = encodeURIComponent('{"spm_id":"333.999"}');
        const url = `https://api.bilibili.com/x/dynamic/feed/create/dyn?platform=web&csrf=${csrf}&x-bili-device-req-json=${deviceReq}&x-bili-web-req-json=${webReq}`;

        const hasVideo = !!aid;
        const text = `分享视频：${title || bvid}\nhttps://www.bilibili.com/video/${bvid}`;
        const rawText = (message || "").trim() || (hasVideo ? "" : text);
        const dynReq = {
            content: {
                contents: [
                    { raw_text: rawText, type: 1, biz_id: "" }
                ]
            },
            scene: hasVideo ? 5 : 1,
            upload_id: `${hasVideo ? 0 : this.accountInfo.mid}_${Math.floor(Date.now() / 1000)}_${Math.floor(Math.random() * 9000 + 1000)}`,
            meta: {
                app_meta: { from: "create.dynamic.web", mobi_app: "web" }
            }
        };
        const payload = { dyn_req: dynReq };
        if (hasVideo) {
            payload["web_repost_src"] = {
                revs_id: {
                    dyn_type: 8,
                    rid: aid
                }
            };
        }
        const response = await this.postRequest(url, JSON.stringify(payload), "application/json");
        return response && response.data;
    }
}