export const BilibiliClientWatchLaterMethods = {
    // 获取稍后再看列表（分页）
    async getWatchLaterList(this: any, pn: number, ps: number = 20): Promise<any> {
        const url = "https://api.bilibili.com/x/v2/history/toview/web";
        const response = await this.getRequestWbi(url, {
            pn,
            ps,
            viewed: 0,
            key: "",
            asc: false,
            need_split: true,
            web_location: 333.881
        });
        return response && response.data && response.data.data;
    },

    // 加入稍后再看
    async addWatchLater(this: any, bvid: string): Promise<any> {
        const url = "https://api.bilibili.com/x/v2/history/toview/add";
        const body = `bvid=${bvid}&csrf=${encodeURIComponent(this.biliJct)}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response && response.data;
    },

    // 从稍后再看移除，aids 可以是单个 aid 或 aid 数组
    async removeWatchLater(this: any, aids: any): Promise<any> {
        const resources = Array.isArray(aids) ? aids.join(",") : String(aids);
        const url = "https://api.bilibili.com/x/v2/history/toview/v2/dels";
        const body = `resources=${encodeURIComponent(resources)}&csrf=${encodeURIComponent(this.biliJct)}`;
        const response = await this.postRequest(url, body, "application/x-www-form-urlencoded");
        return response && response.data;
    }
};
