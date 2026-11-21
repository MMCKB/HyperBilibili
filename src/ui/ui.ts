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
        // 没有声明scrclass的页面（例如没有动画绑定的页面）不要凭空加属性
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
    GlobalActions.UpdateCurrentPageName()
    GlobalActions.AddToVmPool(vm)
    GlobalActions.ClearCurrentVmSrcClass()
    global.logger.log("[ui.InitPage] vm set successed. name=", global.currentPageName)
}

// 功能区（arealist）子页面：从功能区进入时是栈底页（router.clear + replace）
// 直接 router.back() 会退出应用，改为返回功能区，lastpage 用于高亮对应按钮
// 注意：搜索页不在此列——它由功能区 router.push 进入，栈底留着存活的功能区页，
// 走下方通用返回路径即可，返回时功能区播放 frombackanim 复原动画
const MENU_BACK_PAGES = ["dynamic", "savedcontent", "mypage", "settings"]

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
    var prevHasAnim = prevVm && prevVm !== currentVm && typeof prevVm.scrclass === "string"

    if(currentHasAnim){
        currentVm.scrclass = "scroll-backanim"
    }

    // 与远程仓库的返回时序一致：150ms 后清类并返回
    setTimeout(() => {
        if(currentHasAnim){
            currentVm.scrclass = ""
        }

        // 栈底的功能区子页：回功能区而不是退出应用
        var pageSeg = currentName.split("/").pop()
        if(pageSeg && MENU_BACK_PAGES.indexOf(pageSeg) >= 0){
            router.replace({
                uri: "pages/app/arealist",
                params: {
                    lastpage: pageSeg
                }
            })
            global.uiBackPending = false
            return
        }

        router.back()

        // 底层页从卡片态原地放大复原
        if(prevHasAnim){
            prevVm.scrclass = ""
            prevVm.scrclass = "scroll-frombackanim"
        }
        if(prevName !== ""){
            global.currentPageName = prevName
        }
        global.logger.log("[ui.OnBackPress] back. lastpage=", global.currentPageName)

        setTimeout(() => {
            global.uiBackPending = false
        }, 50)
    }, currentHasAnim ? 150 : 0)
}