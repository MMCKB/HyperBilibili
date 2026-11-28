const DYNAMIC_FEATURES = "itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,decorationCard,onlyfansAssetsV2,forwardListHidden,ugcDelete,onlyfansQaCard,commentsNewVersion,avatarAutoTheme,sunflowerStyle,cardsEnhance,eva3CardOpus,eva3CardVideo,eva3CardComment,eva3CardVote,eva3CardUser";

const DYNAMIC_DETAIL_FEATURES = "itemOpusStyle,opusBigCover,onlyfansVote,endFooterHidden,decorationCard,onlyfansAssetsV2,ugcDelete,onlyfansQaCard,editable,opusPrivateVisible,avatarAutoTheme,sunflowerStyle,cardsEnhance,eva3CardOpus,eva3CardVideo,eva3CardComment,eva3CardVote,eva3CardUser";

export const BilibiliClientDynamicMethods = {
    // 获取关注动态：type 为 all/video/article；传 host_mid 时获取该用户的空间动态
    async getDynamicList(this: any, host_mid: number = 0, offset: number | string = 0, type: string = "all"): Promise<any>{
        let url: string;
        if (host_mid) {
            // 空间动态接口能稳定返回自己刚发布的动态；关注流不保证
            url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${host_mid}&features=${encodeURIComponent(DYNAMIC_FEATURES)}`;
        } else {
            // 带上 features 才会返回投票等附加卡片
            url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?platform=web&type=${type}&features=${encodeURIComponent(DYNAMIC_FEATURES)}`;
        }
        if (offset) url += `&offset=${encodeURIComponent(offset)}`;

        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return response.data.data;
    },

    // 获取单条动态详情，用于发布成功后立即插入列表
    async getDynamicDetail(this: any, id: string | number): Promise<any> {
        const url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${encodeURIComponent(String(id))}&timezone_offset=-480&features=${encodeURIComponent(DYNAMIC_DETAIL_FEATURES)}&web_location=333.1330`;
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return response.data.data;
    },

    // 获取话题详情（名称、简介、浏览/讨论数）
    async getTopicDetail(this: any, topicId: string | number): Promise<any> {
        const url = `https://api.bilibili.com/x/topic/web/details/top?topic_id=${encodeURIComponent(String(topicId))}&source=Web`;
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return response.data.data && response.data.data.top_details;
    },

    // 获取话题下的动态列表，offset 为空时加载第一页
    async getTopicFeed(this: any, topicId: string | number, offset: string = "", sortBy: number = 0): Promise<any> {
        let url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/topic?topic_id=${encodeURIComponent(String(topicId))}`
            + `&sort_by=${sortBy}&page_size=20&source=Web&features=${encodeURIComponent(DYNAMIC_FEATURES)}`;
        if (offset) url += `&offset=${encodeURIComponent(offset)}`;
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return response.data.data;
    },

    // 话题点赞 / 取消点赞：isLike 为当前是否已点赞
    async likeTopic(this: any, topicId: string | number, isLike: boolean): Promise<any> {
        const mid = this.accountInfo && this.accountInfo.mid;
        if (!mid || !this.biliJct) {
            throw new Error("not logged in");
        }
        const body = `action=${isLike ? "cancel_like" : "like"}`
            + `&up_mid=${encodeURIComponent(String(mid))}`
            + `&topic_id=${encodeURIComponent(String(topicId))}`
            + `&csrf=${encodeURIComponent(this.biliJct)}`
            + `&business=topic`;
        const response = await this.postRequest("https://api.bilibili.com/x/topic/like", body, "application/x-www-form-urlencoded");
        return response && response.data;
    },

    // 话题收藏 / 取消收藏
    async setTopicFavorite(this: any, topicId: string | number, add: boolean): Promise<any> {
        if (!this.biliJct) {
            throw new Error("not logged in");
        }
        const url = add
            ? "https://api.bilibili.com/x/topic/fav/sub/add"
            : "https://api.bilibili.com/x/topic/fav/sub/cancel";
        const body = `topic_id=${encodeURIComponent(String(topicId))}&csrf=${encodeURIComponent(this.biliJct)}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response && response.data;
    },

    // 获取 opus 图文专栏详情（新版动态专栏没有 cv 号，需要单独读取内容）
    async getOpusDetail(this: any, opusId: string | number): Promise<any> {
        const url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/opus/detail?id=${encodeURIComponent(String(opusId))}`;
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return response.data.data && response.data.data.item;
    },

    // 获取动态投票的详细信息（选项、票数、已投选项、截止时间等）
    async getDynamicVoteInfo(this: any, voteId: string | number): Promise<any> {
        const url = `https://api.bilibili.com/x/vote/vote_info?vote_id=${encodeURIComponent(String(voteId))}`;
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return response.data.data;
    },

    // 参与动态投票：votes 为选项下标数组；anonymous 为是否匿名
    async doDynamicVote(this: any, voteId: string | number, votes: number[], anonymous: boolean = false, dynamicId: string | number = 0): Promise<any> {
        const mid = this.accountInfo && this.accountInfo.mid;
        if (!mid || !this.biliJct) {
            throw new Error("not logged in");
        }
        const csrf = encodeURIComponent(this.biliJct);
        const url = `https://api.bilibili.com/x/vote/do_vote?csrf=${csrf}`;
        const body = {
            vote_id: Number(voteId),
            votes: votes,
            voter_uid: mid,
            status: anonymous ? 1 : 0,
            op_bit: 0,
            // 动态 id 可能超过 JS 安全整数，保持十进制字符串避免精度丢失
            dynamic_id: String(dynamicId || "0"),
            csrf_token: this.biliJct,
            csrf: this.biliJct
        };
        const response = await this.postRequest(url, JSON.stringify(body), "application/json");
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        return response.data;
    },

    // 搜索发布动态时可选择的话题
    async searchDynamicTopics(this: any, keyword: string = ""): Promise<any> {
        const search = keyword || "日常";
        const url = `https://api.bilibili.com/x/topic/pub/search?keywords=${encodeURIComponent(search)}&content=&page_size=20&page_num=1&web_location=333.1365`;
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        return (response.data.data && response.data.data.topic_items) || [];
    },

    // 获取可 @ 的用户（最近提及/关注分组）
    async getDynamicMentionUsers(this: any, keyword: string = ""): Promise<any> {
        let url = "https://api.bilibili.com/x/polymer/web-dynamic/v1/mention/search?web_location=333.1365";
        if (keyword) {
            url += `&keyword=${encodeURIComponent(keyword)}`;
        }
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        const groups = (response.data.data && response.data.data.groups) || [];
        const users = [];
        const seen = {};
        groups.forEach((group) => {
            (group.items || []).forEach((item) => {
                const uid = String(item.uid || "");
                if (users.length >= 8 || !uid || !item.name || seen[uid]) {
                    return;
                }
                seen[uid] = true;
                users.push({
                    uid: uid,
                    name: item.name || "",
                    face: item.face || "",
                    fans: item.fans || 0
                });
            });
        });
        return users;
    },

    // 创建文字动态，支持标题、话题、定时、可见范围、精选评论、@、投票节点和直播预约卡片
    async createDynamicPost(this: any, options: any = {}): Promise<any> {
        const text = (options.text || "").trim();
        const mentions = options.mentions || [];
        const vote = options.vote || null;
        if (!text && !mentions.length && !vote) {
            throw new Error("empty dynamic content");
        }
        const mid = this.accountInfo && this.accountInfo.mid;
        if (!mid || !this.biliJct) {
            throw new Error("not logged in");
        }

        const contents = [];
        if (text) {
            contents.push({ raw_text: text, type: 1, biz_id: "" });
        }
        if (mentions.length && text) {
            contents.push({ raw_text: " ", type: 1, biz_id: "" });
        }
        mentions.forEach((user) => {
            contents.push({ raw_text: `@${user.name || ""}`, type: 2, biz_id: String(user.uid || "") });
            contents.push({ raw_text: " ", type: 1, biz_id: "" });
        });
        if (vote && vote.voteId) {
            if (!mentions.length && text) {
                contents.push({ raw_text: " ", type: 1, biz_id: "" });
            }
            contents.push({ raw_text: "我发起了一个投票", type: 1, biz_id: "" });
            contents.push({ raw_text: vote.title || "", type: 4, biz_id: String(vote.voteId) });
            contents.push({ raw_text: " ", type: 1, biz_id: "" });
        }

        const dynReq: any = {
            content: { contents: contents },
            scene: 1,
            upload_id: `${mid}_${Math.floor(Date.now() / 1000)}_${Math.floor(Math.random() * 9000 + 1000)}`,
            meta: {
                app_meta: { from: "create.dynamic.web", mobi_app: "web" }
            }
        };
        const title = (options.title || "").trim();
        if (title) {
            dynReq.content.title = title;
        }
        if (options.topic && options.topic.id) {
            dynReq.topic = {
                id: options.topic.id,
                name: options.topic.name || "",
                from_source: "dyn.web.list",
                from_topic_id: 0
            };
        }
        const option: any = {};
        if (options.privatePub) {
            option.private_pub = 1;
        }
        if (options.scheduledAt) {
            option.timer_pub_time = options.scheduledAt;
        }
        if (options.replyOption === "close") {
            option.close_comment = 1;
        } else if (options.replyOption === "choose") {
            option.up_choose_comment = 1;
        }
        if (Object.keys(option).length) {
            dynReq.option = option;
        }
        if (options.reserveId) {
            dynReq.attach_card = {
                common_card: {
                    type: 14,
                    biz_id: options.reserveId,
                    reserve_source: 0,
                    reserve_lottery: 0
                }
            };
        }

        const csrf = encodeURIComponent(this.biliJct);
        const deviceReq = encodeURIComponent('{"platform":"web","device":"pc"}');
        const webReq = encodeURIComponent('{"spm_id":"333.999"}');
        const url = `https://api.bilibili.com/x/dynamic/feed/create/dyn?platform=web&csrf=${csrf}&x-bili-device-req-json=${deviceReq}&x-bili-web-req-json=${webReq}`;
        const response = await this.postRequest(url, JSON.stringify({ dyn_req: dynReq }), "application/json");
        return response && response.data;
    },

    // 创建文字投票，返回 vote_id 后作为 type=4 富文本节点插进动态
    async createDynamicVote(this: any, vote: any): Promise<any> {
        const mid = this.accountInfo && this.accountInfo.mid;
        if (!mid || !this.biliJct) {
            throw new Error("not logged in");
        }
        const options = (vote.options || []).map((text) => ({ opt_desc: text, img_url: "" }));
        const body = {
            vote_info: {
                title: vote.title || "",
                desc: vote.desc || "",
                type: 0,
                choice_cnt: vote.choiceCnt || 1,
                duration: vote.duration || 86400,
                options: options,
                only_fans_level: 0,
                vote_publisher: mid
            }
        };
        const url = `https://api.bilibili.com/x/vote/create?csrf=${encodeURIComponent(this.biliJct)}`;
        const response = await this.postRequest(url, JSON.stringify(body), "application/json");
        return response && response.data;
    },

    // 创建直播预约卡片，返回 sid 后放进动态的 attach_card
    async createDynamicLiveReserve(this: any, title: string, livePlanStartTime: number): Promise<any> {
        if (!this.biliJct) {
            throw new Error("not logged in");
        }
        const url = "https://api.bilibili.com/x/new-reserve/up/reserve/create";
        const body = `type=2&sub_type=0&from=1&title=${encodeURIComponent(title)}&live_plan_start_time=${livePlanStartTime}&csrf=${encodeURIComponent(this.biliJct)}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response && response.data;
    },

    // 点赞 / 取消点赞动态，up：1 点赞，2 取消点赞
    async thumbDynamic(this: any, dynId: string, up: number): Promise<any> {
        if (!this.biliJct) {
            throw new Error("not logged in");
        }
        const url = `https://api.bilibili.com/x/dynamic/feed/dyn/thumb?csrf=${encodeURIComponent(this.biliJct)}`;
        const body = {
            dyn_id_str: String(dynId),
            up: up,
            spmid: "333.1369.0.0"
        };
        const response = await this.postRequest(url, JSON.stringify(body), "application/json");
        return response && response.data;
    },

    // 收藏 / 取消收藏动态（社区互动接口），add 为 true 时收藏
    async setDynamicFavorite(this: any, dynId: string, add: boolean): Promise<any> {
        if (!this.biliJct) {
            throw new Error("not logged in");
        }
        const url = `https://api.bilibili.com/x/community/cosmo/interface/simple_action?csrf=${encodeURIComponent(this.biliJct)}`;
        const body = {
            entity: {
                object_id_str: String(dynId),
                type: { biz: 2 }
            },
            action: add ? 3 : 4
        };
        const response = await this.postRequest(url, JSON.stringify(body), "application/json");
        return response && response.data;
    },

    // 转发动态到自己的动态列表，message 作为转发附言
    async createDynamicRepost(this: any, dynId: string, message: string = ""): Promise<any> {
        const mid = this.accountInfo && this.accountInfo.mid;
        if (!mid || !this.biliJct) {
            throw new Error("not logged in");
        }
        const text = (message || "").trim();
        const contents = text ? [{ raw_text: text, type: 1, biz_id: "" }] : [];
        const dynReq = {
            content: { contents: contents },
            scene: 4,
            upload_id: `${mid}_${Math.floor(Date.now() / 1000)}_${Math.floor(Math.random() * 9000 + 1000)}`,
            meta: {
                app_meta: { from: "create.dynamic.web", mobi_app: "web" }
            }
        };
        const payload = {
            dyn_req: dynReq,
            web_repost_src: { dyn_id_str: String(dynId) }
        };
        const csrf = encodeURIComponent(this.biliJct);
        const deviceReq = encodeURIComponent('{"platform":"web","device":"pc"}');
        const webReq = encodeURIComponent('{"spm_id":"333.999"}');
        const url = `https://api.bilibili.com/x/dynamic/feed/create/dyn?platform=web&csrf=${csrf}&x-bili-device-req-json=${deviceReq}&x-bili-web-req-json=${webReq}`;
        const response = await this.postRequest(url, JSON.stringify(payload), "application/json");
        return response && response.data;
    },

    // 删除自己的动态
    async removeDynamic(this: any, dynId: string): Promise<any> {
        if (!this.biliJct) {
            throw new Error("not logged in");
        }
        const url = `https://api.bilibili.com/x/dynamic/feed/operate/remove?platform=web&csrf=${encodeURIComponent(this.biliJct)}`;
        const body = { dyn_id_str: String(dynId) };
        const response = await this.postRequest(url, JSON.stringify(body), "application/json");
        return response && response.data;
    },

    // 置顶 / 取消置顶自己的动态
    async setDynamicTop(this: any, dynId: string, isTop: boolean): Promise<any> {
        if (!this.biliJct) {
            throw new Error("not logged in");
        }
        const action = isTop ? "set_top" : "rm_top";
        const url = `https://api.bilibili.com/x/dynamic/feed/space/${action}?csrf=${encodeURIComponent(this.biliJct)}`;
        const body = { dyn_str: String(dynId) };
        const response = await this.postRequest(url, JSON.stringify(body), "application/json");
        return response && response.data;
    },

    // 举报动态
    async reportDynamic(this: any, accusedUid: string, dynId: string, reasonType: number, reasonDesc: string = ""): Promise<any> {
        if (!this.biliJct) {
            throw new Error("not logged in");
        }
        const url = `https://api.bilibili.com/x/dynamic/feed/dynamic_report/add?csrf=${encodeURIComponent(this.biliJct)}`;
        let body = `accused_uid=${encodeURIComponent(String(accusedUid || ""))}`
            + `&dynamic_id=${encodeURIComponent(String(dynId || ""))}`
            + `&reason_type=${encodeURIComponent(String(reasonType))}`
            + `&reason_desc=${encodeURIComponent(reasonDesc || "")}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response && response.data;
    },

    // 获取动态页 UP 分区：已关注且有动态的 UP 列表
    async getDynamicUpList(this: any): Promise<any> {
        const url = "https://api.bilibili.com/x/polymer/web-dynamic/v1/portal?up_list_more=1&web_location=333.1365";
        const response = await this.getRequest(url);
        if (!response || !response.data) {
            throw new Error("empty response");
        }
        if (response.data.code !== 0) {
            throw new Error(response.data.message || `code ${response.data.code}`);
        }
        const upList = response.data.data && response.data.data.up_list;
        return (upList && upList.items) || [];
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