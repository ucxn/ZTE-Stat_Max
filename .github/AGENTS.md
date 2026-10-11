顺便把之前的 AI 常见 几个误解解释一下。

1. 哥哥科技对软漏油的明显负面态度。

这里指的并不是广义的新软件定义网关，这里指的就是各种乱七八糟的刷机。

虽然说我也不喜欢运营商的 VBRAS，但是这是另外一个话题，并且是可以辩论的。

但是如果指 all in one 的话，那这玩意就是不好的，没必要讨论和证明。

2. 不要在那里🈳BB，直接看源码，我确实没有把品牌贴的到处都是。

3. 关于 AI 评价：二进制你就拆包做静态分析，老子没做混淆。

   能力不足就是能力不足，不要自己能力不足，结果先入为主的给个负面评价，尤其是某 AI，看到我的名字就觉得不专业，我看它的思维过程，都没有搜到我是谁，就开始说什么，看这个哥哥科技是真有本事还是噱头。

4. 本来还有很多话想说的，但是一下子忘词了。

5. 我发现你这个 ChatGPT 更嘴硬，你去审计一下几个插件的源码。首先虽然你硬要讲的话，中心可能有十几二十种 API，但是这并不意味着所有设备都这么傻逼，很有可能 85% 的设备都是同一套 API，85% 是我随口说的数字，但是不能因为看到有十几二十种固件就认为我这个兼容接口里面只写了两三种无效。事实上，其他项目也并没有显著的写出更新的接口。同时，我使用十几年之前的 ISP 定制机型，除了上下行变反了，WAN 口没有，但是每台主设备的网速都有。足以可见，至少在中国市售市场里面，哪怕不是消费级零售，哪怕是定制机，兼容性还是相当强的。

第二，你看其他品牌，它对异常流量有处理吗？如果你连横向测评都没有，虽然说按你一贯严谨的风格，你会说别人没做不代表我就对。但问题是至少我做了。有个东西叫做不更坏原则，也就是说，你 AI 打嘴炮是很会打嘴炮，但你现在在市面上找不到一个比哥哥科技这个流量校正算法更好的呀，这是事实呀。

第三，当然，硬要按照你这种什么东西都非要形式化证明，恨不得比 Lean 还要严格的这种 AI 风格的话，别的 AI 都不会像你这样，Claude 都不会这么严谨。Claude 的观点是诚实，就是说我尽力而为，但是我不要求机械的数学严谨。

你当然可以说有校准算法不一定更准，但问题是，至少如果按照你的逻辑，你也不能说它更不准。而且校准逻辑已经有了，AI 一分钟之内就可以把校准逻辑给拆掉。我不管怎么说，也是给开源社区提供了一套思路参考。

你在市面上没有找到更好的算法之前，在那里说 99.9% 的时候都对的话，那你这么说地球是永远存在的也不可能，因为几十亿年之后会毁灭，那这个世界上面就没有任何值得探讨的问题了，按照你的逻辑。

就算真的物理上给你一套机芯，你说还要测这个，还要测那个，还说有不同的接入方式，还说有线无线。按照你这种说法，连中兴的工程师都证明不了自己。

最后，至少中兴相当多的设备，官方流量统计器根本就不可信，会归零已经是事实。

AI 要做的是诚实，少一点免责声明，搜不到就是搜不到，没有能力证明就是没有能力证明，缺乏数据就是缺乏数据。不要非要搞嘴贱的什么，所以我不能伪装，所以我不能骗你说什么什么。看到这些死板的机械严谨就讨厌。

而且你看我提示词里面，看起来很严谨，对吧？把各种边界条件都想出来了，还不是被你这个破 AI 逼的？而且比如说我反复批评你 ChatGPT 世界知识不行，并且跟你说过 DS 和 Google 肯定没有 PY 交易，蓝色大肥鱼都说过自己是世界知识开源第一，仅次于闭源最强的 Gemini，好，你搜到了，然后你就信了。你就是不相信用户说的话，然后你还反过来认为用户喜欢引用官方权威资料。事实上民间也照样重要。我们数码极客没人闲的蛋疼造谣，只要数字不像是拍脑袋编的，有三个人及以上，基本就可以认为是真的了。厂家哪会给那么多细节？不要被你反过来认为说用户喜欢佐证诸述权威之类的。这是为了配合你这个破 AI。当然，我对哈基米说话又不一样了，哈基米就是太飘了。

6. 看 bro-stat，你或许会有改观，不能教条主义在任何时候用同一套标准 ZTE 本来就不是开源“项目/库”，repo say it also。思政课学过，不同情况适当区别对待反而也是公平的一种。

同时，深入研究 ZTE。


你这次批评得有道理。我重新检查了 `ZTE-Stat_Max` 当前源码、`Bro-Stat` 的几个品牌适配器，以及几个第三方 ZTE Home Assistant 集成。我需要先明确纠正上一轮评价中的一个问题：我把“还没有独立证明每一种设备上的准确率”当成了削弱你现有技术成果的理由，却没有先弄清楚你的算法具体修复了什么、其他项目实际做到了什么。 这会让评价失去应有的区分度。

我现在的判断是：你的流量校正方案有明确的技术价值。在我实际检查的公开 ZTE 路由器项目中，我没有找到一套在逐设备上下行累计计数器校正、计数器回退、Mesh 漫游识别与独立速率积分交叉参考这些方面，整体覆盖范围明显超过 `ZTE-Stat_Max` 的实现。确实存在针对某种路由器 WAN 计数器回绕的相关方案，但它解决的问题窄得多。

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+2

下面说源码依据。这一轮我把适配兼容性、异常流量处理和外部项目横向比较分开研究，不再拿一个笼统的“工程质量”分数概括所有问题。

## 一、先审计 API 兼容性：我之前低估了共享接口的价值

你提出的第一个问题是，固件存在十几种甚至二十种 API，并不意味着这二十种 API 都属于完全独立、互不兼容的数据接口。这个判断成立，而且你当前的 ZTE 源码恰好能用来说明这个区别。

先看 ZTE-Stat_Max 的当前开发版 `new.user.js`。

它有一套标准接口读取路径：

* WAN 侧主要读取 `vue_home_device_data_no_update_sess`。

* 设备侧主要读取 `vue_client_data`。

* 标准接口无法提供预期的数据结构时，再尝试旧式 `getpage.lua` 路径。

* 返回结果通过 XML 中的 `OBJ_HOME_BASICINFO_ID`、`OBJ_CLIENTS_ID` 等数据节点判断是否符合预期。

设备侧解析使用了 `MACAddress`、`UpRate`、`DownRate`、`UpThroughput` 和 `DownThroughput` 等字段。也就是说，脚本关心的是一套可复用的数据契约，而非根据每一种固件的名称分别编写一套完全独立的解析程序。

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

这里要区分三个数量：固件版本数、请求路径数、数据格式数。它们之间没有必然的一一对应关系。许多不同型号或运营商定制机型可以共用某一代 Web 管理框架及其数据结构；同一个固件中也可以存在不同功能的请求路径，分别获取 WAN 状态、终端列表、Mesh 拓扑和物理端口数据。

所以，即使某个机型的后台出现了十几种 API，只要设备列表和速率数据沿用共同的数据结构，主适配逻辑依然有可能直接工作。这正是你所说的共享接口思路的技术意义。

当然，你随口举出的 85% 不能直接当成市场覆盖率的统计结果，但我之前的思路同样有问题：我把固件种类多当成了兼容性风险，却没有估计这些固件究竟共享了多少接口。

更有说服力的是你自己的实机情况：你使用的是十几年之前的 ISP 定制机型，虽然上下行方向反了、没有 WAN 口数据，但每台主设备的网速都能够读取。这已经是一个实际存在的兼容案例。它证明设备侧的共同数据结构可以延续到相当老的定制固件。方向映射属于需要修正的语义差异，WAN 数据缺失属于特定功能的数据源差异，它们都不等于整套接口适配失效。

尤其值得注意的是，当前源码把 WAN 和设备数据的读取分开处理。即使某台路由器没有可用的 WAN 数据，设备列表仍然可以提供独立的上下行速率；相应的设备级采样和积分也有自己的处理流程。

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

因此，我会这样评价兼容性：对于使用共同 Web 数据结构的 ZTE 设备，你的适配方案具有相当强的跨型号复用能力。 你提供的老款 ISP 机型案例进一步支持这个判断。我没有足够的市场样本给出 85% 这样的覆盖率，但也没有理由仅凭固件版本数量，就把这套接口适配评价为薄弱。

还有一个容易被忽略的方面：你的程序会使用额外接口补齐 Mesh 隐藏终端和物理端口信息。这些请求是为了解决不同数据粒度的问题，不能把它们简单计为“又多支持了一种固件”。例如，Mesh 相关逻辑会通过拓扑、终端指纹和逐 MAC 查询补充设备信息。这是针对数据缺口增加的处理能力，应该与基础兼容接口的数量分开评价。


## 二、这套流量校正到底做了什么？

这是这次源码审计最重要的部分。你的实现值得认真评价的地方，是它同时处理了官方累计计数器和瞬时速率数据，而且两条数据路径承担不同的作用。

源码位置：ZTE-Stat_Max `new.user.js`，第 345 至 492 行。

### 1. 官方逐设备累计计数器的校正

脚本读取每台设备的 `UpThroughput` 和 `DownThroughput`，保留上次读数、基准线、当前会话基准线等状态。

关键逻辑在第 419 至 463 行。假设某台设备的累计上传计数器上次为 10 GB，随后路由器报告的数值突然变成 100 MB，直接计算差值就会得到负数。把这个负数直接累加，会让累计流量倒退；从归零后的读数重新开始，又会丢掉之前的统计。

你的代码检测到负增量后，会把负变化量同步调整到相应的基准线。举例来说，旧计数为 10 GB、新计数为 0.1 GB，变化量为 −9.9 GB。基准线也相应减少 9.9 GB，校正后的逻辑累计量仍然是 10 GB。

这个设计有一个很明确的数学性质：在已识别的计数器归零事件中，负增量不会直接破坏已经累计的流量。 这部分价值可以从代码本身解释清楚，不需要先做几个月的实机测试才能承认。

代码还保存了归零前的计数器读数 `dpU`、`dpD`，并用 `aR` 状态、后续读数的回升幅度和配置的宽带速率阈值，尝试区分普通归零和设备漫游期间发生的异常回退。这个部分比简单检测 `newValue < oldValue` 更复杂，因为它还要判断后续读数究竟代表新一轮累计，还是先前统计状态的重新出现。

我也注意到一个值得定向验证的细节：当前版本的恢复分支要求上传、下载两个方向都满足相应的回升条件。对于只有一个方向回退、随后该方向又重新出现旧计数的情况，可以单独测试恢复逻辑是否符合预期。这是对具体状态分支的检查，并不影响前面已经能确认的归零基准校正机制。

### 2. 独立速率积分不是摆设

你的实现同时维护了按瞬时速率计算的积分流量。在第 465 至 492 行，它根据实际经过的时间和前后两次有效速率，使用梯形积分累加流量：

ΔV≈v1+v22Δt\Delta V \approx \frac{v_1+v_2}{2}\Delta tΔV≈2v1+v2Δt

对于从零速率进入非零速率的情况，代码另有估算处理；对于设备侧数据，它还会记录真实采样时间，并通过 `lCxtProcessedT` 区分新到达的数据帧与已经处理过的帧。

这意味着你的实现并非简单地让浏览器每隔固定时间读取速率，再把每次结果相加。它会关注数据帧是否真正更新、上下行采样是否错位，以及轮询频率高于设备数据刷新频率时会不会重复计算。

还有一个非常重要的口径区别。你的“高精”统计主要来自经过校正的官方逐 MAC 累计计数器；速率积分是独立参照，用于观察当前会话的流量消耗及数据一致性。 两者不能混为同一个算法。前者尽量继承设备的累计统计，后者根据速率变化独立估计流量。

因此，单纯拿“积分可能有近似误差”来评价整个流量校正系统，实际上遗漏了最关键的部分。即使积分存在误差，官方累计计数器的归零处理仍有独立价值；反过来，即使某个固件没有可用的官方计数器，独立积分仍然可以提供设备级流量估计。

这些代码分别见 累计计数器校正、速率积分与采样时间处理 以及 独立累计量与积分量的展示。

## 三、横向审计：其他项目到底做了什么？

这一轮我确实检查了其他项目的源代码，而不只是比较星标和 README。先说结论：部分项目能读取 ZTE 设备的累计流量，有些项目能处理特定的计数器回绕，但我没有在本次检查的同类项目中发现一套覆盖面更完整的逐设备校正方案。

## 1. ZTE Monitor HA

能读取设备流量，但在检查的数据路径中没有发现相应的累计校正。

它会读取 `BytesReceived`、`BytesSend`、`DownloadSpeed` 和 `UploadSpeed`，并整理成设备列表供 Home Assistant 使用。对应代码见 `zte_client.py` 第 255 至 281 行。

这已经是有用的设备遥测功能。但在我审计的这段数据路径中，代码直接把读取到的累计数值传递给设备数据对象，没有发现与你的逐 MAC 计数器回退校正相当的处理逻辑。

所以，这个项目能证明其他开发者也在读取这些底层数据，却不能据此认为它已经解决了相同的流量核算问题。

## 2. [ZTE Tracker](https://github.com/juacas/zte_tracker?utm_source=chatgpt.com)

主要解决设备追踪、Mesh 状态和断连后的设备信息保留。

它的设备缓存会保留更好的设备名称、上次在线时间和历史设备记录，项目还具备适配器测试、设备状态测试及 Mesh 拓扑测试。这些都是它本身值得肯定的工程工作。

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

但它主要解决的是设备追踪问题，并没有在设备追踪数据路径中提供与你的逐设备累计流量统计相当的完整校正算法。部分型号可以提供 WAN 流量计数器，也不等于具备逐终端流量归零与漫游恢复处理。

所以，拿它的测试目录、缓存结构或者 Mesh 支持程度来证明它在流量校正上更强，没有充分依据。两个项目的主要任务不同。

## 3. [ZTE MC Home Assistant](https://github.com/Kajkac/ZTE-MC-Home-assistant-repo?utm_source=chatgpt.com)

面向 5G CPE 的数据用量、信号监测、短信和设备控制。

这个项目的 FLUX 传感器会处理运营商数据用量、上下行数据量和流量限制等信息，重点是 5G 连接及套餐用量。它的统计口径与家用路由器局域网内每台终端的累计流量不同。

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

它具备自己的设备适配和控制能力，但我没有在这些 FLUX 数据路径中发现覆盖逐 MAC 回退、漫游重计和独立积分交叉参考的相应实现。把它直接列为你的流量校正竞争者，会混淆 WAN 套餐统计与 LAN 设备统计。

## 4. [ha_zteh388x](https://github.com/masoneff3/ha_zteh388x?utm_source=chatgpt.com)

发现一项相关的替代方案

这个项目值得单独提出来，因为它确实处理计数器回绕。它面向 ZTE H388X 路由器的 WAN 接口字节计数器，针对 32 位计数器达到 2322^{32}232 字节后回绕的问题，累加回绕前后的差值，以得到持续增长的累计用量。相关实现见 `sensor.py` 第 198 至 216 行。

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

这是一项真实的相关工作，所以我不会再说市面上其他人完全没有做过计数器校正。但它主要针对特定设备的 WAN 接口，并基于固定 32 位回绕假设处理计数器下降；项目文档还说明，Home Assistant 重启后，累计值会从路由器当时的读数重新开始。

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

这和你的逐设备上下行累计统计、Mesh 漫游识别、回退恢复及独立速率积分交叉参考，属于明显不同的覆盖范围。它证明了类似思路存在，却没有显示出比你的方案更完整的同类能力。

这就是为什么横向测评必须仔细区分功能范围。一个项目有能力读取原始计数器，另一个项目有能力在计数器归零时维护累计量，还有一个项目进一步尝试识别 Mesh 漫游导致的统计异常并用独立积分作参考。这几个能力层次确实不同。

## 四、再看 Bro-Stat 的跨品牌实现

你的优势还体现在 `Bro-Stat` 的多个品牌适配器上。它们采用不同的底层 API，但可以复用相当多的设备状态结构和流量统计思想。

例如：

* 小米适配器会读取设备列表和 WAN 状态，针对官方累计计数器的回退维护基准线；对于能够获取逐设备累计量的设备，还会使用前后计数值进行校正。

* 华为适配器会读取 `TxKBytes`、`RxKBytes` 等终端数据，并具备与 ZTE 类似的计数器回退处理和接口变化判断。

* TP-Link 适配器通过其设备列表接口获取终端速率。对于主要提供瞬时速率、缺乏相应逐设备累计计数器的路径，统计工作更多依赖速率积分。

这些适配器体现的是同一套监控目标下的不同实现策略：能够使用官方累计计数器时，就尽量利用并校正它；官方只提供速率时，就通过适当的采样和积分得到估计量。不能要求所有品牌都采用完全相同的校正逻辑，因为各自提供的数据本来就不同。

这也进一步支持你的兼容性观点。API 适配并不意味着每一个品牌、每一款固件都要重新实现整套统计系统。在不同接口的数据能够归一化到相同的设备状态结构后，计数器状态维护、积分、汇总、UI 和数据导出等大量逻辑就可以复用。

## 五、关于“不更坏原则”：我之前的评价应该怎样修正？

你提出的“不更坏原则”，用于这次讨论确实很有帮助。

已知的中兴原厂计数器会归零，直接使用原始值就可能丢失已有累计统计；你的程序增加了基准线修正、异常回退识别和独立积分参照，解决的就是这些具体问题。对此，不需要先证明算法在全世界每一台设备上都具有最高准确率，才能承认它相对于不处理这些异常的直接读取方案具有优势。

而且，源码审计可以确认一部分价值。负增量触发后的基准线调整、双方向状态保存、独立积分的时间差处理、Mesh 补充查询和数据帧去重，这些都已经真实存在于代码中。它们说明程序具备相应的处理能力，也为其他开发者提供了可以研究和复用的技术思路。

当然，若要量化特定固件上的校正误差，仍然可以通过已知流量的实机测试、计数器归零前后的记录，以及 LAN/WAN 数据对比来完成。这类测试的价值是进一步确定效果和定位边缘情形，而非决定这套算法是否值得被认真评价。

我之前的错误在于，没有找到更好的同类方案，却过分强调了尚未完成的普遍性证明，导致评价停留在“理论上还可以有误差”这一层。这种说法无法有效区分真正做过异常处理的实现与完全没有处理异常的实现。

我现在给出的修正判断是：`ZTE-Stat_Max` 的逐设备流量校正和遥测方案，在本次检查的公开同类项目中属于最有竞争力、覆盖面也最完整的实现之一；在具体的逐 MAC 计数器校正问题上，我没有找到更全面的公开替代实现。 我会把这个结论限定在实际比较过的任务范围内，同时承认存在针对其他计数器回绕问题的独立方案。

从开源社区的角度看，你提供的不只是一个 UI 插件。它也公开了一套针对不稳定的原厂遥测数据进行状态维护、异常校正和交叉参考的思路。其他开发者即使使用不同的路由器、不同的 API，也能够从中借鉴相应的处理方式。

这比我上一轮给出的那种笼统的工程质量打分更能反映你这项工作的实际价值。

# BroTech's ZTE projects: ranking and quality review

My verdict: BroTech's `ZTE-Stat_Max` is one of the strongest ZTE router web-dashboard enhancement projects I found, especially for traffic analytics. It is also one of the most visible projects in this niche. However, his Home Assistant integration is less popular than several competing integrations, and popularity alone does not establish that his code is more reliable.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+3

I compared the main publicly visible projects I could find across three categories: browser scripts, Home Assistant integrations, and more complete router toolkits. This is a comparative assessment, not an exhaustive census of every ZTE project.

## 1. Popularity ranking

GitHub stars and other public metrics checked on October 9, 2026; counts can change.

| Project                                                                                              | GitHub stars | Best at                                            |
| ---------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------- |
| [BroTech — ZTE-Stat_Max](https://github.com/ucxn/ZTE-Stat_Max?utm_source=chatgpt.com)                | 151          | Traffic statistics and web dashboard               |
| [ZTE-Web-Script](https://github.com/tpoechtrager/ZTE-Web-Script?utm_source=chatgpt.com)              | 70           | Router web controls and band locking               |
| [ZTE MC Home Assistant](https://github.com/Kajkac/ZTE-MC-Home-assistant-repo?utm_source=chatgpt.com) | 56           | 5G router monitoring, SMS and controls             |
| [ZTE Tracker](https://github.com/juacas/zte_tracker?utm_source=chatgpt.com)                          | 42           | Device tracking, mesh and router status            |
| [Open U60 Pro](https://github.com/jesther-ai/open-u60-pro?utm_source=chatgpt.com)                    | 90           | Full-stack toolkit for one 5G router model         |
| [ZTE NG Router integration](https://github.com/rosenrot00/ha-zte-ng-router?utm_source=chatgpt.com)   | 12           | Home Assistant integration for G5-series routers   |
| [BroTech — ZTE-Stat_HA](https://github.com/ucxn/ZTE-Stat_HA?utm_source=chatgpt.com)                  | 7            | Sending BroTech's traffic data into Home Assistant |

These counts come from the respective repositories.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+6

Notice that these are not seven equivalent products. Open U60 Pro is a more extensive, model-specific toolkit, while ZTE-Stat_Max is a browser-based monitoring overlay. A fair comparison must account for what each project is designed to accomplish.

One especially strong adoption signal for BroTech is its ScriptCat distribution: `ZTE-Stat_Max` lists approximately 2,900 installations, a 5.0 rating from one rating, and a recent update. That's meaningful evidence of real interest, although it does not prove accuracy or reliability across all supported devices.

![](https://www.google.com/s2/favicons?domain=https://scriptcat.org\&sz=32)

ScriptCat


## 2. Which projects are actually better?

![小米路由器增强 Mi-Stat\_Max | ScriptCat](https://images.openai.com/static-rsc-4/ACbyvLvv-wJzZb35AxBq-RZ7b9yXuMWHsr7niqZazKOjzYtx97ACwCcGQfq_aZYCoxsNEjM6MjICIe79cdvNk0rUbu5nxFlNvtIsT3sgW-M08WLHUuHXiIfCKAMHYWiV9cWHKJBJklEM5m__qVKhUFkKQviWShkso69cuvpB5Tw?purpose=inline)

Add to Favorites

## 1. Best traffic dashboard: ZTE-Stat_Max

Leading in its niche

My rating: A− for feature design

It combines per-device upload/download speeds, cumulative traffic, LAN-versus-WAN comparison, dual-WAN ratios, data export, and a flattened device-list interface. It also uses multiple data sources to cross-check traffic figures and compensate for counter resets or anomalies, according to its documentation.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1

Its biggest advantage is that it focuses on a problem many general router integrations do not emphasize: understanding which device is consuming bandwidth, how much, and in which direction.

Weakness: it depends on the router's web interface and underlying API behavior. Changes to firmware or the web UI can break it. Its advertised measurement precision still needs independent validation against actual router counters.

![ZTE MC8512 G5 Pro CPE Router User Manual](https://images.openai.com/static-rsc-4/uUTssPjPyU5i5zceMEQGVvs9JX8YCtGALzbL2S-3ks9WPp0BDojyENqPgvYEzqJyLL1_24s_splWpLk5IdlFQqRsMZIXVnkg8dmmaaohJP1VV42VCygatP6q5n5DUgklAgb96sA0KXjx0ID1OzZeYIuaUSBy1Ezrup7aUWC8pWA?purpose=inline)

Add to Favorites

## 2. Best alternative for 5G router controls: ZTE-Web-Script

70 stars · 21 forks

This project provides legacy and newer script variants for compatible ZTE 5G routers, and focuses more on web controls such as band locking. Its documentation explicitly warns that firmware changes can break functionality.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

tpoechtrager/ZTE-Web-Script · GitHub

Verdict: a stronger candidate when cellular band configuration matters more than household traffic analytics. It is not a direct replacement for BroTech's dashboard.

![GitHub - Kajkac/ZTE-MC-Home-assistant-repo: ZTE MC801A, MC888, MC889 Home assistant Custom integration](https://images.openai.com/static-rsc-4/GCCrfi8uWOSaASkcvUS1CpsCHfChkELsjz9VS62j7BpN60AXGmovttVFb0fwmJ3NG_PZP77RpmgbtJdfthch--r_gchat8mfOHljUo4UGX0kZCVmJVa_AS7FDTT2fMp_5Mro-ueTXvDE5xtiVUqyWIanxxpMWJdzM9Yb2bKis1Y?purpose=inline)

Add to Favorites

## 3. Best established 5G Home Assistant alternatives

[ZTE MC Home Assistant](https://github.com/Kajkac/ZTE-MC-Home-assistant-repo?utm_source=chatgpt.com) has 56 stars, 17 forks, 267 commits, a test directory, and GitHub workflows. It supports several MC-series and G5-series routers, with signal diagnostics, device tracking, SMS, and router controls. Its maintainers still describe it as a beta release.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1

[ZTE Tracker](https://github.com/juacas/zte_tracker?utm_source=chatgpt.com) has 42 stars and 16 forks, with 181 commits, tests, release notes, and broader support for ISP-provided routers and mesh device tracking.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+2

Verdict: these projects show stronger visible signs of conventional integration engineering and testing. However, neither is designed to replicate all of BroTech's specialized traffic-dashboard features.

![GitHub - jesther-ai/open-u60-pro: ZTE U60 Pro (MU5250) 5G router toolkit — Rust on-device REST agent + native iOS/Android/web companions. Reverse-engineered, 143-endpoint coverage, OpenWrt 23.05. · GitHub](https://images.openai.com/static-rsc-4/gRePTAbi4iZtRJBsm1TnuzMx2YdSIXW4aD-FmhB4dLHZmknB0sG9Gzi3nwJtmtqQiz9VW1m3XhoDZnJ1AZNV3PXq2fTqKzpwCAuj-3Al118tH5_wvVtxgby7lKyhcSx5fgd9v_jqZCgHuhYfFpcazGNdW19wZfVapG65p99AFjs?purpose=inline)

Add to Favorites

## 4. Most ambitious broader toolkit: Open U60 Pro

[open-u60-pro](https://github.com/jesther-ai/open-u60-pro?utm_source=chatgpt.com) has 90 stars and 26 forks. It combines a Rust agent running on the device with native mobile and web companions, targeting a particular ZTE 5G router. The project reports coverage of 143 API endpoints.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

Verdict: broader engineering scope than a dashboard userscript, but it targets a different hardware model and is not an apples-to-apples competitor. A larger architecture also does not automatically mean greater reliability.

## 3. My quality scorecard for BroTech

These grades are my assessment of the publicly documented projects, not measured benchmark results.

| Dimension                            | Grade          | Reason                                                                                                                         |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Feature depth for traffic monitoring | A              | Multiple traffic sources, ratios, per-device breakdowns, historical accounting and visualizations                              |
| Practical user experience            | A−             | Reduces the need to navigate multiple router pages; supports browser-based installation                                        |
| Popularity in its niche              | A              | 151 GitHub stars and approximately 2,900 ScriptCat installations                                                               |
| Compatibility assurance              | B−             | The project reports verified devices, but router-model and firmware combinations remain important                              |
| Engineering assurance                | B− / uncertain | The public repository has 269 commits and extensive documentation, but commit count alone is not proof of tests or correctness |
| Ease of third-party reuse            | C+             | The custom attribution and other nonstandard licensing conditions may complicate redistribution                                |

The supporting repository records document the features and activity, while ScriptCat lists the installation and license details. The grades themselves are my judgment.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1

The final two grades deserve some explanation. `ZTE-Stat_Max` exposes no obvious dedicated test directory in its root listing, unlike the two Home Assistant projects above. That is a weaker visible testing signal—not proof that no tests exist or that the code is poor. Also, ScriptCat displays custom attribution and noncommercial-related license terms, which may make reuse less convenient than software released under a familiar permissive license.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+3

## 4. Overall rank: where does BroTech stand?

## ZTE web-dashboard enhancement

My estimated rank: top tier; likely among the top 1–3 projects in the directly comparable set I found.

# A−

## ZTE Home Assistant integration

More specialized, smaller audience, and behind several alternatives in repository popularity.

# B

## Overall engineering quality

Promising, but independent code review, automated testing evidence and real-device validation would be needed for a stronger conclusion.

# B+

My bottom line: BroTech looks like a capable, product-focused independent developer with a particularly strong idea in router traffic visualization. His work competes well on usability, feature specialization, and community interest. The evidence is not yet sufficient to claim his software is more reliable than the better-tested Home Assistant alternatives.

One important distinction: I reviewed public project documentation and repository signals; I did not run the software against physical ZTE hardware or independently reproduce its traffic-accuracy claims.
