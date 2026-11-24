export const BilibiliClientCommentMethods = {
    // 获取评论区内容
    async getReplies(this: any, type: string, oid: string, pn: number = 1, ps: number = 10, sort: number = 1) {
        const url = `https://api.bilibili.com/x/v2/reply?type=${type}&oid=${oid}&pn=${pn}&ps=${ps}&sort=${sort}`;
        const response = await this.getRequest(url);
        return response.data.data;
    },

    // 获取二级评论区内容
    async getSecReplies(this: any, type: string, oid: string, root: string, pn: number = 1, ps: number = 10) {
        const url = `https://api.bilibili.com/x/v2/reply/reply?type=${type}&oid=${oid}&pn=${pn}&ps=${ps}&root=${root}`;
        const response = await this.getRequest(url);
        return response.data.data;
    },

    // 点赞/取消赞评论，action：1 点赞，0 取消赞
    async LikeReply(this: any, type: string, oid: string, rpid: string, action: number) {
        const url = "https://api.bilibili.com/x/v2/reply/action";
        const body = `type=${type}&oid=${oid}&rpid=${rpid}&action=${action}&csrf=${this.biliJct}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response.data;
    },

    // 删除评论（只能删除自己的评论，或自己管理的评论区下的评论）
    async deleteReply(this: any, type: string, oid: string, rpid: string) {
        const url = "https://api.bilibili.com/x/v2/reply/del";
        const body = `type=${type}&oid=${oid}&rpid=${rpid}&csrf=${this.biliJct}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response.data;
    },

    // 举报评论，reason 见 https://github.com/SocialSisterYi/bilibili-API-collect
    // content 仅在 reason=0（其它）时有效；addBlacklist 为 true 时同时拉黑该用户
    async reportReply(this: any, type: string, oid: string, rpid: string, reason: number, content: string = "", addBlacklist: boolean = false) {
        const url = "https://api.bilibili.com/x/v2/reply/report";
        let body = `type=${type}&oid=${oid}&rpid=${rpid}&reason=${reason}`;
        if (reason === 0 && content) {
            body += `&content=${encodeURIComponent(content)}`;
        }
        if (addBlacklist) {
            body += `&add_blacklist=true`;
        }
        body += `&csrf=${this.biliJct}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response.data;
    },

    // 发送评论
    async GiveReply(this: any, type: string, oid: string, message: string) {
        const url = "https://api.bilibili.com/x/v2/reply/add";
        const body = `type=${type}&oid=${oid}&message=${encodeURIComponent(message)}&plat=1&csrf=${this.biliJct}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response.data;
    },

    // 回复评论（发送二级评论）
    async GiveSecReply(this: any, type: string, oid: string, parent: string, message: string) {
        const url = "https://api.bilibili.com/x/v2/reply/add";
        const body = `type=${type}&oid=${oid}&parent=${parent}&message=${encodeURIComponent(message)}&plat=1&csrf=${this.biliJct}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response.data;
    },

    // 回复二级评论（对话树）
    async GiveTreeReply(this: any, type: string, oid: string, parent: string, root: string, message: string) {
        const url = "https://api.bilibili.com/x/v2/reply/add";
        const body = `type=${type}&oid=${oid}&parent=${parent}&root=${root}&message=${encodeURIComponent(message)}&plat=1&csrf=${this.biliJct}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response.data;
    },
};