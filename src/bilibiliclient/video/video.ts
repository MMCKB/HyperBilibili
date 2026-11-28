export const BilibiliClientVideoMethods = {
    // 获取首页视频推荐
    async getMainPageRecommendVideos(this: any, fresh_type: number, pagesize: number): Promise<any> {
        const url = `https://api.bilibili.com/x/web-interface/index/top/rcmd?fresh_type=${fresh_type}&ps=${pagesize}&version=1`;
        const response = await this.getRequest(url);
        return response.data.data.item;
    },

    // 获取热门视频（综合热门，支持分页）
    async getPopularVideos(this: any, pn: number, pagesize: number): Promise<any> {
        const url = `https://api.bilibili.com/x/web-interface/popular?pn=${pn}&ps=${pagesize}`;
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return {
            list: (response.data.data && response.data.data.list) || [],
            no_more: !!(response.data.data && response.data.data.no_more)
        };
    },

    // 获取分区排行榜视频（rid 为排行榜分区 id，0 表示全站）
    async getRankVideosByRid(this: any, rid: number): Promise<any> {
        const url = "https://api.bilibili.com/x/web-interface/ranking/v2";
        let response: any;
        if (this.accountInfo && this.accountInfo.wbi_img) {
            response = await this.getRequestWbi(url, { rid: String(rid), type: "all" });
        } else {
            response = await this.getRequest(`${url}?rid=${rid}&type=all`);
        }
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return (response.data.data && response.data.data.list) || [];
    },

    // 根据视频BV号获取视频详情信息
    async getVideoInfoByBVID(this: any, bvid: string): Promise<any> {
        const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
        const response = await this.getRequest(url);
        return response.data.data;
    },

    // 获取视频标签（其中 tag_type 为 topic 的即为话题标签）
    async getVideoTagsByBVID(this: any, bvid: string): Promise<any[]> {
        const url = `https://api.bilibili.com/x/web-interface/view/detail/tag?bvid=${encodeURIComponent(bvid)}`;
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return response.data.data || [];
    },

    // 判断视频是否被点赞
    async isVideoLikedByBVID(this: any, bvid: string): Promise<boolean> {
        const url = `https://api.bilibili.com/x/web-interface/archive/has/like?bvid=${bvid}`;
        const response = await this.getRequest(url);
        return response.data.data;
    },

    // 判断视频是否被投币
    async isVideoCoinedByBVID(this: any, bvid: string): Promise<boolean> {
        const url = `https://api.bilibili.com/x/web-interface/archive/coins?bvid=${bvid}`;
        const response = await this.getRequest(url);
        return response.data.data.multiply;
    },

    // 判断视频是否被收藏
    async isVideoStaredByBVID(this: any, bvid: string): Promise<boolean> {
        const url = `https://api.bilibili.com/x/v2/fav/video/favoured?aid=${bvid}`;
        const response = await this.getRequest(url);
        return response.data.data.favoured;
    },

    // 获取视频AI摘要（B站官方 conclusion/get，wbi签名）
    // 返回 { available, code, summary, outline, stage, message }
    // stage: ok / processing（生成中）/ nospeech（无可识别语音）/ unsupported（内容不支持）
    //        empty（总结为空）/ outer / inner / parse / network
    async getVideoAISummaryByBVID(this: any, bvid: string, cid: string, up_mid: string) {
        const url = "https://api.bilibili.com/x/web-interface/view/conclusion/get";
        const tryParse = (value: any): any => {
            if (typeof value === "string") {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return value;
                }
            }
            return value;
        };

        let response: any;
        try {
            response = await this.getRequestWbi(url, {
                bvid,
                cid,
                up_mid
            });
        } catch (e) {
            global.logger.error("[getVideoAISummaryByBVID] request failed: ", e);
            return { available: false, code: -999, summary: "", outline: [], stage: "network", message: "网络请求失败" };
        }

        let body = tryParse(response);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return { available: false, code: -998, summary: "", outline: [], stage: "parse", message: "返回数据异常" };
        }
        // 某些适配层会把真实响应再包一层 { code: 200, data: "<json>" }
        if (body.message === undefined && body.data !== undefined &&
            (body.code === undefined || String(body.code) === "200")) {
            const inner = tryParse(body.data);
            if (inner && typeof inner === "object" && inner.code !== undefined && inner.message !== undefined) {
                body = inner;
            }
        }

        const outerCode = Number(body.code);
        const data = body.data;
        if (outerCode !== 0 || !data) {
            return {
                available: false,
                code: outerCode,
                summary: "",
                outline: [],
                stage: "outer",
                message: String(body.message || body.msg || "")
            };
        }

        const innerCode = Number(data.code);
        const model = data.model_result;
        if (innerCode !== 0 || !model) {
            let stage = "inner";
            if (innerCode === 1) {
                stage = String(data.stid) === "0" ? "processing" : "nospeech";
            } else if (innerCode === -1) {
                stage = "unsupported";
            }
            return {
                available: false,
                code: innerCode,
                summary: "",
                outline: [],
                stage,
                message: String(data.message || data.msg || body.message || "")
            };
        }

        const summary = model.summary || "";
        const outline = Array.isArray(model.outline) ? model.outline : [];
        const available = !!(summary || outline.length > 0);
        return {
            available,
            code: 0,
            summary,
            outline,
            stage: available ? "ok" : "empty",
            message: ""
        };
    },

    // 获取根据BVID与CID获取视频MP4流地址
    async getVideoMP4StreamByBVID(this: any, cid: string, bvid: string, qn: string = "32") {
        const url = `https://api.bilibili.com/x/player/wbi/playurl`;
        const response = await this.getRequestWbi(url, {
            cid,
            bvid,
            qn,
            fnval: "1",
            platform: "html5"
        });

        global.logger.log(response);
        return response.data.data;
    },

    async getVideoBestAudioUrlByBVID(this: any, bvid: string): Promise<string> {
        const info = await this.getVideoInfoByBVID(bvid);
        const cid = info.cid || info.pages?.[0]?.cid;
        if (!cid) {
            throw new Error("cid not found");
        }

        const url = `https://api.bilibili.com/x/player/wbi/playurl`;
        const response = await this.getRequestWbi(url, {
            bvid,
            cid,
            fnval: 4048,
            fourk: 1,
            platform: "pc"
        });

        const payload = response && response.data ? response.data : response;
        if (!payload) {
            global.logger.error("[getVideoBestAudioUrlByBVID] empty response");
            throw new Error("empty response");
        }
        global.logger.log("[getVideoBestAudioUrlByBVID] response code:", payload.code, "message:", payload.message);

        const dash = payload.data?.dash || payload.dash;
        const audioTracks = dash?.audio || [];
        global.logger.log("[getVideoBestAudioUrlByBVID] audioTracks length:", audioTracks.length);
        if (!audioTracks.length) {
            const keys = Object.keys(payload.data || payload || {});
            global.logger.error("[getVideoBestAudioUrlByBVID] no audio tracks, payload keys:", keys);
            throw new Error("audio stream not found");
        }

        audioTracks.sort((a: any, b: any) => (b.bandwidth || 0) - (a.bandwidth || 0));
        const best = audioTracks[0] || {};

        const candidates: Array<string> = [];
        const baseUrl = best.baseUrl || best.base_url;
        if (baseUrl) candidates.push(baseUrl);

        const backupUrls = best.backupUrl || best.backup_url;
        if (Array.isArray(backupUrls)) {
            backupUrls.forEach((u: any) => {
                if (typeof u === "string" && u.length > 0) candidates.push(u);
            });
        }

        const uniqueCandidates = candidates.filter((u, idx) => candidates.indexOf(u) === idx);
        uniqueCandidates.sort((a, b) => {
            const score = (u: string) => {
                let s = 0;
                if (u.includes("mcdn")) s -= 10;
                if (u.includes("upos")) s += 2;
                return s;
            };
            return score(b) - score(a);
        });

        const selected = uniqueCandidates[0];
        global.logger.log("[getVideoBestAudioUrlByBVID] selected url:", selected);
        return selected;
    },
};
