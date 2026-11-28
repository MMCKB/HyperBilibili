// 动态内容解析：投票卡片与 @提及

export interface DynamicMentionUser {
    mid: string
    uname: string
    avatar: string
}

export interface DynamicVotePreview {
    voteId: string
    title: string
    joinNum: number
}

export interface DynamicTopic {
    id: string
    name: string
}

export interface DynamicLivePreview {
    cover: string
    title: string
    areaName: string
    statusText: string
    isLive: boolean
}

function AsArray(value: any): any[] {
    return Array.isArray(value) ? value : []
}

function NormalizeText(value: any): string {
    return String(value === null || value === undefined ? "" : value)
        .replace(/^\s*@/, "")
        .trim()
}

function ParseDynamic(data: any): any {
    if (typeof data !== "string") {
        return data
    }
    try {
        return JSON.parse(data)
    } catch (e) {
        return null
    }
}

// 同时兼容 desc.rich_text_nodes 与 opus.summary.rich_text_nodes 两级结构
function CollectRichTextNodes(moduleDynamic: any): any[] {
    if (!moduleDynamic) {
        return []
    }
    const nodes: any[] = []
    const desc = moduleDynamic.desc
    if (desc && Array.isArray(desc.rich_text_nodes)) {
        desc.rich_text_nodes.forEach((node) => nodes.push(node))
    }
    const major = moduleDynamic.major
    const summary = major && major.opus && major.opus.summary
    if (summary && Array.isArray(summary.rich_text_nodes)) {
        summary.rich_text_nodes.forEach((node) => nodes.push(node))
    }
    return nodes
}

// 提取动态正文里被 @ 的用户，供卡片与详情页展示提及列表
export function ExtractDynamicMentions(data: any): DynamicMentionUser[] {
    const dyn = ParseDynamic(data)
    if (!dyn || typeof dyn !== "object") {
        return []
    }
    const modules = dyn.modules || {}
    const nodes = CollectRichTextNodes(modules.module_dynamic)
    const users: DynamicMentionUser[] = []
    const seen: { [key: string]: boolean } = {}
    nodes.forEach((node) => {
        if (!node || node.type !== "RICH_TEXT_NODE_TYPE_AT") {
            return
        }
        const mid = String(node.rid || node.uid || node.mid || "")
        const uname = NormalizeText(node.text || node.orig_text)
        if (!mid || !uname || seen[mid]) {
            return
        }
        seen[mid] = true
        users.push({
            mid: mid,
            uname: uname,
            avatar: ""
        })
    })
    return users
}

// 提取动态附带的话题标签，兼容 module_dynamic.topic 与正文富文本两种来源
export function ExtractDynamicTopics(data: any): DynamicTopic[] {
    const dyn = ParseDynamic(data)
    if (!dyn || typeof dyn !== "object") {
        return []
    }
    const modules = dyn.modules || {}
    const moduleDynamic = modules.module_dynamic
    if (!moduleDynamic) {
        return []
    }
    const topics: DynamicTopic[] = []
    const seen: { [key: string]: boolean } = {}
    const addTopic = (rawId: any, rawName: any) => {
        const id = String(rawId || "")
        let name = NormalizeText(rawName)
        name = name.replace(/^#+/, "").replace(/#+$/, "").trim()
        if (!id || !name || seen[id]) {
            return
        }
        seen[id] = true
        topics.push({ id: id, name: name })
    }
    if (moduleDynamic.topic) {
        addTopic(moduleDynamic.topic.id, moduleDynamic.topic.name)
    }
    CollectRichTextNodes(moduleDynamic).forEach((node) => {
        if (!node || node.type !== "RICH_TEXT_NODE_TYPE_TOPIC") {
            return
        }
        addTopic(node.rid, node.text || node.orig_text)
    })
    return topics
}

// 提取直播动态的展示信息（只用于卡片展示，不提供直播跳转）
export function ExtractDynamicLive(data: any): DynamicLivePreview | null {
    const dyn = ParseDynamic(data)
    if (!dyn || typeof dyn !== "object") {
        return null
    }
    const modules = dyn.modules || {}
    const moduleDynamic = modules.module_dynamic
    const major = moduleDynamic && moduleDynamic.major
    if (!major) {
        return null
    }
    const normalize = (url: any): string => {
        let value = String(url || "")
        if (value.indexOf("//") === 0) value = "https:" + value
        return value
    }
    if (major.live) {
        const live = major.live
        const status = Number(live.live_state) === 1
        return {
            cover: normalize(live.cover),
            title: String(live.title || ""),
            areaName: String(live.desc_first || ""),
            statusText: status
                ? String((live.badge && live.badge.text) || "直播中")
                : "直播已结束",
            isLive: status
        }
    }
    if (major.live_rcmd) {
        const live = major.live_rcmd
        let content = live.content
        if (typeof content === "string") {
            try {
                content = JSON.parse(content)
            } catch (e) {
                content = null
            }
        }
        const info = (content && content.live_play_info) || {}
        const watched = info.watched_show || {}
        const status = Number(info.live_status) === 1
        return {
            cover: normalize(info.cover || live.cover),
            title: String(info.title || live.title || ""),
            areaName: String(info.area_name || live.area_name || ""),
            statusText: status
                ? String(watched.text_large || "直播中")
                : "直播已结束",
            isLive: status
        }
    }
    return null
}

// 提取动态附带的投票卡片信息；没有投票时返回 null
export function ExtractDynamicVote(data: any): DynamicVotePreview | null {
    const dyn = ParseDynamic(data)
    if (!dyn || typeof dyn !== "object") {
        return null
    }
    const modules = dyn.modules || {}
    const moduleDynamic = modules.module_dynamic
    if (!moduleDynamic) {
        return null
    }
    const additional = moduleDynamic.additional || {}
    const vote = additional.vote
    if (vote && (additional.type === "ADDITIONAL_TYPE_VOTE" || vote.vote_id || vote.voteId)) {
        const voteId = String(vote.vote_id || vote.voteId || "")
        if (voteId) {
            return {
                voteId: voteId,
                title: String(vote.title || vote.desc || ""),
                joinNum: Number(vote.join_num) || 0
            }
        }
    }
    // 某些动态只在正文富文本里带投票节点
    const nodes = CollectRichTextNodes(moduleDynamic)
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i] || {}
        if (node.type === "RICH_TEXT_NODE_TYPE_VOTE" && node.rid) {
            return {
                voteId: String(node.rid),
                title: NormalizeText(node.text || node.orig_text),
                joinNum: 0
            }
        }
    }
    return null
}
