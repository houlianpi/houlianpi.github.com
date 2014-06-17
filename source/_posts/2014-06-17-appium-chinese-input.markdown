---
layout: post
title: "Appium中午输入问题的一些探索"
date: 2014-06-17 12:08
comments: true
categories: 
---


## Appium输入中文的问题

在使用Appium做手机端的自动化测试时，你可以会遇到输入中文的问题。但是由于Appium是三个自动化测试工具的集合，所以遇到的中文问题也可能会比较难说清楚。Appium支持iOS、Android和FireFoxOS三种操作系统。但是FireFoxOS一般人都不用，所以，文章中它是最后一次露面了。

Appium在iOS端自动化测试底层使用的是官方的[UI Autoamtion](https://developer.apple.com/library/mac/documentation/DeveloperTools/Conceptual/InstrumentsUserGuide/UsingtheAutomationInstrument/UsingtheAutomationInstrument.html"Title")。在Android端，4.2以上使用的官方的[Uiautomator](http://developer.android.com/tools/help/uiautomator/index.html"Title")，4.1以下使用的时eBay的[selendroid](http://selendroid.io/"Title")。所以在输入中文的问题上，三个平台理论上都有可能遇到问题。本文之后将重点调研Uiautomator的输入中文的问题。


关于中文输入的的结论：

*  Appium iOS  完全支持
*  Appium Android selendroid 应该支持（需要实践确认，目前没有试过，只是猜测）
*  Appium Android Uiautomator 不支持，应该是硬伤，目前无解


selendroid的调研之后补充。


## Appium iOS中文输入调研

首先先来说一下UI Automation。苹果官方的UI Automation在输入时有两种方法：

*  （1）直接使用Element的setValue方法。
*  （2）UI Automation中的 UIAKeyboard对象有一个typeString方法。

以上两个方法在模拟器上都是完美支持中文的。所以不管在iOS上面怎么玩，都是支持中文的。当然两个方式是有区别的。方法（1）简单直接，基本上就是一个简单的set方法。输入时不会触发什么类似textChanged事件。方法（2）需要很多支持，方法二是完全模拟人手工输入过程。苹果对英文以外的输入都做了很好地兼容。

Appium iOS版本的  sendkeys方法，直接对应  UIAKeyboard的typeString方法。由于typeString方法完美支持中文。所以Appium iOS版本也就支持中文了。当然，typeString方法也有缺点。当一个输入框内有内容的时候，typeString的输入方法是添加，所以，如果之前的内容不需要的时候，还需要先清除掉，在进行typeString。在没有特殊要求的情况下，我比较喜欢setValue这个方法，但是遗憾的时Appium不支持直接setValue。



## Appium Android Uiautomator中文输入调研

之所以能有这篇文章，主要是因为最近想使用Appium做一些App之间相互跳转的自动化确认测试。一个中文的App，如果不能输入中文基本上就是歇菜。在使用学习工具的时候发现了很多坑，不能输入中文的这个坑最大，最郁闷。所以，把自己的调研方法写出来，供大家参考。

首先 在一切未知的情况下，使用了这个方法进行输入：

	input.sendKeys("舌尖上的中国");
	
发现结果不对，然后尝试了不输入中文：

	input.sendKeys("ssssssss");
	
结果也不对，发现手机上使用的输入法是Google中文输入法。把输入法切换到英文输入法，以后，英文的正确的了，中文的还是有问题。于是Google了一下，找到了一个[帖子](http://testerhome.com/topics/242"Title")。上面信息量很大，看起来比较靠谱的是有一个方法，利用JS运行器来直接输入方法，翻译为Java版本以后，代码如下：

``` java Java
        inputDir.put("element",((RemoteWebElement)input).getId());
        inputDir.put("text","舌尖上的中国");
        driver.executeScript("element:setText", inputDir);
```

这个方法会出现一个没有实现的异常。


好吧，看源码。

在使用Appium 的sendkeys方法是，Client会发送一个http请求到Appium的server。在AppiumServer端的源码中 有一个 rounting 的文件，输入方法会发送这样的路由： rest.post('/wd/hub/session/:sessionId?/element/:elementId?/value', controller.setValue); 然后树藤摸瓜，找到controller的setValue方法。然后一步一步的查找，最终会找到bootstrap项目中的AndroidElement.java文件，其中有setText方法。代码如下：

``` java Java
 public boolean setText(final String text) throws UiObjectNotFoundException {
    if (UnicodeEncoder.needsEncoding(text)) {
      Logger.info("Sending Unicode text to element: " + text);
      String encodedText = UnicodeEncoder.encode(text);
      return el.setText(encodedText);
    } else {
      Logger.info("Sending plain text to element: " + text);
      return el.setText(text);
    }
  }
```

在Appium Android Uiautomator中，输入方法就是这一段代码。从这一段代码中会发现Appium基本没有做什么事情，最终调用了Uiautomator本身的setText方法。所以，接下来需要确认原生的Uiautomator是否可以支持中文输入。
经过简单的测试发现，Uiautomator不支持中文输入，然后继续Google解决方案。发现了一个[uiautomator-unicode-input-helper](https://github.com/sumio/uiautomator-unicode-input-helper"Title")开源项目。直接拿来尝试了中文，也发现不对。按照作者的说法是可以支持日语，但是貌似想支持中文的话，还要进行一定量的开发。

继续看看Uiautomator为什么不支持中文。然后继续找Android的源码，发现Uiautomator的所有的功能都是通过UiAutomatorBridge来完成的。在UiAutomatorBridge类中有一个成员变量类型是InteractionController。输入是通过InteractionController来实现的。具体的setText方法代码如下：

``` java Java
   public boolean More ...sendText(String text) {
        if (DEBUG) {
                    Log.d(LOG_TAG, "sendText (" + text + ")");
        }
        mUiAutomatorBridge.setOperationTime();
        KeyEvent[] events = mKeyCharacterMap.getEvents(text.toCharArray());
        if (events != null) {
            for (KeyEvent event2 : events) {
                // We have to change the time of an event before injecting it because
                // all KeyEvents returned by KeyCharacterMap.getEvents() have the same
                // time stamp and the system rejects too old events. Hence, it is
                // possible for an event to become stale before it is injected if it
                // takes too long to inject the preceding ones.
                KeyEvent event = KeyEvent.changeTimeRepeat(event2,
                        SystemClock.uptimeMillis(), 0);
                if (!injectEventSync(event)) {
                    return false;
                }
            }
        }
        return true;
    }
```

通过这段代码，基本上就明白了，Android的Uiautomator完全没有兼容英文以外的输入法的意思。并且也没有提供直接设置属性的方法。

Appium Android Uiautomator 要支持输入中文还有很长的一段路需要走。伤心了。



	
         
