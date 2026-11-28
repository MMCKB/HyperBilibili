export function CreateLoadingAnimation(pageModel: any, colorReverse = true){
    // anims存在性检测
    if(!pageModel.anims){
        pageModel.anims = {}
    }

    // 使用 static spinner 图片 + 全局 CSS loading-spin 旋转动画，
    // 不再创建逐帧 SequenceAnim / 定时器。
    pageModel.anims.loading_src = { value: "/common/loading.png" }
    pageModel.anims.loading = {
        start: function(){},
        stop: function(){}
    }
    pageModel.anims.show_loading = true

    global.logger.log("[Animation Engine] Created CSS Loading Animation for page", pageModel.$page.name)
}