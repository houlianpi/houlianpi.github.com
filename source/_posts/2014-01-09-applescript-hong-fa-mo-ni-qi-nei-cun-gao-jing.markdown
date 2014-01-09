---
layout: post
title: "UI Automation 中触发iOS模拟器内存警告"
date: 2014-01-09 19:18
comments: true
categories: iOS simulator MemoryWarning AppleScript
---

在UI Automation的api中没有提供模拟内存警告的接口。在Monkey测试的过程中 MemoryWarning还是非常有用的。所以需要想办法自己封一个simulateMemoryWarning接口。

经过调研，决定采用AppleScript来实现功能，然后在UI Automation中使用host.performTaskWithPathArgumentsTimeout调用AppleScript方式来实现。

调试AppleScript。在[stackoverflow](http://stackoverflow.com/questions/2784892/simulate-memory-warnings-from-the-code-possible "Title") 中，可以找到OC和AppleScript版本的内存告警实现。其中AppleScript的实现为：

``` applescript AppleScript Tricks start:1
tell application "System Events"
	tell process "iPhone Simulator"
		tell menu bar 1
			tell menu bar item "Hardware"
				tell menu "Hardware"
					click menu item "Simulate Memory Warning"
				end tell
			end tell
		end tell
	end tell
end tell
```

简单的调试发现不稳定，最好加入一下代码：

``` applescript AppleScript Tricks start:1
tell application "iPhone Simulator"
	activate
end tell
```


之前的脚本只能支持英文版操作系统，为了兼容中文操作系统，再次加入代码：

``` applescript AppleScript Tricks start:1
on get_language()
	return user locale of (get system info)
end get_language
set menubar to "Hardware"
set menuclick to "Simulate Memory Warning"
if get_language() = "zh_CN" then
	set menubar to "硬件"
	set menuclick to "模拟内存警告"
end if
tell application "iPhone Simulator"
	activate
end tell
tell application "System Events"
	tell process "iPhone Simulator"
		tell menu bar 1
			tell menu bar item menubar
				tell menu menubar
					click menu item menuclick
				end tell
			end tell
		end tell
	end tell
end tell
```

保存好文件以后，放入固定的路径，使用UI Automation调用，可以参考一下代码：

``` javascript JavaScript Tricks start:1
simulateMemoryWarning: function(){
    var target = UIATarget.localTarget(); 
    var host = target.host();
    var result = host.performTaskWithPathArgumentsTimeout("/usr/bin/osascript", [this.scriptPath+"SMW.scpt"], 5);
    if(result.exitCode==0){
        return 0;
        }else{
         return null;
            }
}
```

好的，功能就做完了。还算顺利，但是如果你是一个geek的话，会觉得之前的AppleScript中有一段很蛋疼的代码。没错我也觉得蛋疼，并且有些老外也觉得蛋疼，所以有一个现成的函数可以使用：

``` applescript AppleScript Tricks start:1
on menu_click(mList)	local appName, topMenu, r	-- Validate our input	if mList's length < 3 then error "Menu list is not long enough"	-- Set these variables for clarity and brevity later on	set {appName, topMenu} to (items 1 through 2 of mList)	set r to (items 3 through (mList's length) of mList)	-- This overly-long line calls the menu_recurse function with	-- two arguments: r, and a reference to the top-level menu	tell application "System Events" to my menu_click_recurse(r, ((process appName)'s ¬		(menu bar 1)'s (menu bar item topMenu)'s (menu topMenu)))end menu_clickon menu_click_recurse(mList, parentObject)	local f, r	-- `f` = first item, `r` = rest of items	set f to item 1 of mList	if mList's length > 1 then set r to (items 2 through (mList's length) of mList)	-- either actually click the menu item, or recurse again	tell application "System Events"		if mList's length is 1 then			click parentObject's menu item f		else			my menu_click_recurse(r, (parentObject's (menu item f)'s (menu f)))		end if	end tellend menu_click_recursetell application "iPhone Simulator"	activateend tellmenu_click({"iPhone Simulator", "硬件", "模拟内存警告"})
```

大概玩了一下AppleScript，感觉语法方面有点颠覆之前学过的语言，但是如果能熟练了以后，写代码就像说话一下。感兴趣的同学可以试试。以上相关功能代码已经加入[ynm3k](https://github.com/douban/ynm3k "Title")中。也可以直接使用的。

