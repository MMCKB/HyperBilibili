import { router } from "../tsimports"

class GlobalActions {
    static AddToVmPool(vm){
        global.vmPool[vm._name] = vm
    }

    static UpdateCurrentPageName(){
        global.currentPageName = router.getState().name
    }

    static ClearCurrentVmSrcClass(){
        var vm = global.vmPool[global.currentPageName]
        // 没有声明scrclass的页面（例如没有.scroll的文章页）不要凭空加属性
        if(vm && typeof vm.scrclass === "string"){
            vm.scrclass = ""
        }
    }
}

function runVmPoolGC(){
    for(var name in global.vmPool){
        if(global.vmPool[name]){
            if(global.vmPool[name].$valid){
                return
            }
        }

        global.logger.log("[ui.VmPoolGC] page named", name, " has been already destroyed.")
        delete global.vmPool[name]
    }
}

export function Init(){
    global.vmPool = {}
    global.currentPageName = ""
    global.uiBackPending = false
    global.logger.log("[ui.InitPage] inited.")

    setInterval(() => {
        runVmPoolGC()
    }, 10000)
}

export function InitPage(vm){
    var previousPageName = global.currentPageName
    // 只有带scrclass动画的页面才需要联动旧页；没有.scroll绑定的页面直接跳过
    var newPageHasCardEnter = typeof vm.scrclass === "string"

    GlobalActions.UpdateCurrentPageName()
    GlobalActions.AddToVmPool(vm)
    GlobalActions.ClearCurrentVmSrcClass()

    // 桌面卡片式前进：新页推入时，上一页同时左移、缩小并压暗。
    // 用页面栈校验前进方向：push时previousPageName紧挨在新页之前；
    // replace时被替换的页面已经不在栈里，不会误伤更下面的页面。
    var pageStack = router.getPages()
    var prevIndex = -1
    for(var i = 0; i < pageStack.length; i++){
        if(pageStack[i].name === previousPageName){
            prevIndex = i
            break
        }
    }
    var isForwardFromPrevious = previousPageName !== "" &&
        previousPageName !== global.currentPageName &&
        prevIndex >= 0 &&
        prevIndex >= pageStack.length - 2

    if(newPageHasCardEnter && isForwardFromPrevious){
        var prevVm = global.vmPool[previousPageName]
        // 上一页也必须声明了scrclass（即有.scroll绑定）才能做背景联动
        if(prevVm && typeof prevVm.scrclass === "string"){
            prevVm.scrclass = ""
            prevVm.scrclass = "scroll-backdrop"
            setTimeout(() => {
                // 新页已经盖住上一页，清掉临时类，避免动画末态残留在背景页上
                // 用scroll-noanim而不是空值：否则.scroll的进入动画会在背景页上重新播放一遍
                if(prevVm.scrclass === "scroll-backdrop"){
                    prevVm.scrclass = "scroll-noanim"
                }
            }, 380)
            global.logger.log("[ui.InitPage] card backdrop applied. prev=", previousPageName)
        }
    }

    global.logger.log("[ui.InitPage] vm set successed. name=", global.currentPageName)
}

export function OnBackPressTriggered(){
    // 退出动画期间屏蔽重复返回，避免连按导致一次退两层
    if(global.uiBackPending){
        return
    }
    global.uiBackPending = true

    GlobalActions.UpdateCurrentPageName()

    var pageStack = router.getPages()
    var currentName = pageStack.length > 0 ? pageStack[pageStack.length - 1].name : global.currentPageName
    var prevName = pageStack.length >= 2 ? pageStack[pageStack.length - 2].name : ""
    var currentVm = global.vmPool[currentName]
    var prevVm = prevName !== "" ? global.vmPool[prevName] : null
    var currentHasAnim = currentVm && typeof currentVm.scrclass === "string"

    if(currentHasAnim){
        currentVm.scrclass = "scroll-backanim"
    }
    if(currentHasAnim && prevVm && prevVm !== currentVm && typeof prevVm.scrclass === "string"){
        // 与新页退出同时反向：上一页从压暗缩小的背景态回到原位
        prevVm.scrclass = ""
        prevVm.scrclass = "scroll-frombackanim"
    }

    // 与300ms退出动画同时结束；清类和router.back在同一tick，避免页面回弹
    setTimeout(() => {
        if(currentHasAnim){
            currentVm.scrclass = ""
        }
        router.back()

        // 以实际栈顶修正当前页名，供下一次前进联动使用（回退失败时也不会记错页）
        var stackAfterBack = router.getPages()
        global.currentPageName = stackAfterBack.length > 0 ?
            stackAfterBack[stackAfterBack.length - 1].name : prevName
        global.logger.log("[ui.OnBackPress] back. lastpage=", global.currentPageName)

        setTimeout(() => {
            global.uiBackPending = false
        }, 50)
    }, currentHasAnim ? 300 : 0)
}