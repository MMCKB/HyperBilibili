// 评论图片处理

export interface CommentPicture {
    url: string
    width: number
    height: number
}

const BILI_HOST = /(^|\.)(hdslb\.com|biliimg\.com)$/i

function NormalizeUrl(raw: any): string {
    let url = String(raw === null || raw === undefined ? "" : raw).trim()
    url = url.replace(/&amp;/g, "&")
    if (!url) {
        return ""
    }
    if (url.indexOf("//") === 0) {
        url = "https:" + url
    }
    if (url.indexOf("http://") === 0) {
        let host = ""
        try {
            host = url.slice(7).split("/")[0].split(":")[0]
        } catch (e) {
            host = ""
        }
        if (BILI_HOST.test(host)) {
            url = "https://" + url.slice(7)
        }
    }
    return /^https?:\/\//i.test(url) ? url : ""
}

function HostOf(url: string): string {
    try {
        const noProtocol = url.replace(/^https?:\/\//i, "")
        return noProtocol.split("/")[0].split(":")[0]
    } catch (e) {
        return ""
    }
}

function StripTransform(url: string): string {
    return url.replace(/@(\d+[a-z]_?)*(\..*)?$/i, "")
}

export function IsCommentImagesEnabled(): boolean {
    const settings = global.settings && global.settings.SETTINGS
    return !settings || settings.enableCommentImages !== false
}

export function ExtractCommentPictures(reply: any): CommentPicture[] {
    let data = reply
    if (typeof data === "string") {
        try {
            data = JSON.parse(data)
        } catch (e) {
            return []
        }
    }
    if (!data || typeof data !== "object") {
        return []
    }

    const content = data.content || {}
    let pictures = content.pictures || data.pictures
    if (!Array.isArray(pictures)) {
        pictures = []
    }

    const result: CommentPicture[] = []
    const seen: { [key: string]: boolean } = {}
    const add = (rawUrl: any, rawWidth: any, rawHeight: any) => {
        const url = NormalizeUrl(rawUrl)
        if (!url || seen[url]) {
            return
        }
        seen[url] = true
        const width = Number(rawWidth)
        const height = Number(rawHeight)
        result.push({
            url,
            width: isNaN(width) ? 0 : width,
            height: isNaN(height) ? 0 : height
        })
    }

    pictures.forEach((picture: any) => {
        if (typeof picture === "string") {
            add(picture, 0, 0)
        } else if (picture && typeof picture === "object") {
            add(
                picture.img_src || picture.url || picture.src || picture.img_url,
                picture.img_width,
                picture.img_height
            )
        }
    })

    // 兼容少数把图片塞进 message 的返回；表情图不当作评论图片
    if (result.length === 0 && content.message) {
        const pattern = /<img[^>]+src=["']([^"']+)["']/gi
        let match: RegExpExecArray | null = null
        while ((match = pattern.exec(String(content.message))) !== null) {
            const url = NormalizeUrl(match[1])
            if (url && BILI_HOST.test(HostOf(url)) && url.indexOf("/bfs/new_dyn/") >= 0) {
                add(url, 0, 0)
            }
        }
    }

    return result
}

export function CleanCommentMessage(message: any): string {
    return String(message === null || message === undefined ? "" : message).replace(/<img[^>]*>/gi, "").trim()
}

export function CommentThumbUrl(rawUrl: string, size: number = 82): string {
    const url = NormalizeUrl(rawUrl)
    if (!url) {
        return ""
    }
    if (!BILI_HOST.test(HostOf(url))) {
        return url
    }
    const side = Number(size) > 0 ? Math.floor(Number(size)) : 82
    return StripTransform(url) + `@${side}w_${side}h_1c`
}

export function CommentPreviewUrl(rawUrl: string): string {
    const url = NormalizeUrl(rawUrl)
    if (!url) {
        return ""
    }
    if (!BILI_HOST.test(HostOf(url))) {
        return url
    }
    return StripTransform(url) + "@1080w_1080h"
}

// 图片查看器统一处理：本地/内部 URI 原样，B 站图片升级 https 并取 1080 预览
export function NormalizeViewerImageUrl(rawUrl: string): string {
    let url = String(rawUrl === null || rawUrl === undefined ? "" : rawUrl).trim()
    if (!url) {
        return ""
    }
    if (url.indexOf("//") === 0) {
        url = "https:" + url
    }
    if (url.indexOf("/") === 0 || /^(internal|file|data):/i.test(url)) {
        return url
    }
    if (!/^https?:\/\//i.test(url)) {
        return ""
    }
    if (url.indexOf("http://") === 0 && BILI_HOST.test(HostOf(url))) {
        url = "https://" + url.slice(7)
    }
    if (BILI_HOST.test(HostOf(url))) {
        return StripTransform(url) + "@1080w_1080h"
    }
    return url
}

export function ViewerRetryImageUrl(rawUrl: string): string {
    const url = NormalizeViewerImageUrl(rawUrl)
    if (!url || !BILI_HOST.test(HostOf(url))) {
        return ""
    }
    return StripTransform(url) + "@720w_720h"
}