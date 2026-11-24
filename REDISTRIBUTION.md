## 适用范围与初衷（本节为说明，非许可证正文）

本协议管的是本程序本身：它的副本、修改版，以及包含它的作品。

我真正在意的只有一件事：市面上流通的每一个版本，都应当带着我的名字。我不允许公开世界里出现无名氏版本。署名条款就是为这件事设计的。

## 与 GPL 的兼容性说明

> 本节是使用指南，不是许可证正文，不增加也不减少任何权利与义务，实际权利义务以仓库中的许可证文件为准。注意：我不是律师，写这些只是为了让使用者少碰麻烦。下面的结论并非我有意设下的限制，而是我基于许可证文本和实际实践得出的经验总结。

**先说原因。** <br> GPL 要求把合并后的整个作品都按 GPL 发布，并且不得在 GPL 之外对使用者再加限制。本协议带有较强的署名要求，另有收费、竞争方面的条款，在 GPL 看来都属于"额外限制"（性质上类似带广告条款的旧版 BSD 许可证，FSF 也认为它与 GPL 不兼容）。两边的要求没法同时满足，下面三条都由此而来。

**1. 如果您的程序是一个 GPL 程序，那么您可能不太方便对我的程序进行代码级别的融合（字面上难以两全）。**

我的代码并非专有程序，您的集成行为本身也未必违反本协议，麻烦出在 GPL 一侧：融合之后，GPL 会要求整个作品按 GPL 发布，而我的署名等条款对 GPL 来说可能会触发进一步限制之类，从而字面上不太纯洁。

**2. 一种例外：版权全部在您自己手里。**<br>
特别地，如果您的 GPL 程序从未引用过第三方 GPL 代码，
自始至终是您本人原创，或只引用了 MIT 等宽松许可的代码，没有第三方 GPL 代码，外部贡献者也都同意您这样处理，那么没有第三方能拦着您。也就是说，所有 CopyLeft 的义务来源全部来源于作者您自己或您有权控制的部分。

您可以为这次融合自行给出例外许可（类似常见的"链接例外"）。本协议允许与其他代码组成更大作品（见 APL-Bro 第 3.7 条），前提是我这一部分的条款继续得到满足。此时可以做代码级融合：我的部分按本协议，署名完整保留；您自己的部分按 GPL 加您给出的例外。整个作品不再是"纯 GPL"。

不过，基于本程序的实际运行环境（浏览器里的用户脚本），代码级融合在工程上也不太方便，所以这只是理论上的可能，不代表我推荐。

**3. 单纯聚合：任何许可证都可以，包括 AGPL。**

GPL 把这种情形叫"聚合体"（aggregate，GPLv2 里叫 mere aggregation）：彼此独立的作品放在同一个发行包里，没有合并成一个更大的程序，GPL 不会因此扩展到其他部分，聚合也不会改变我这部分的许可。只要您的用户脚本管理器没有抹除、篡改、弱化署名的功能，且您集成的脚本与官方版本逐字节一致，署名条款通常无需担心：

- 与官方逐字节一致，原样集成，署名完整；
- 您的程序（比如用户脚本管理器）没有抹除、篡改、弱化署名的功能，包括贴牌、白标之类，也没有借汇编额外限制用户对各个作品本来拥有的权利；
- 不违反本项目的条款，尤其是不能违反署名条款；
- 您的程序本身没有额外的白牌限制等；
- 与您程序的主要功能之间没有深度交互：互相不是对方的扩展，不共享内部数据结构，不在同一进程内相互调用；不是衍生作品或者深度调用；
- 我的显著、强制、UI署名等条款仍然适用于我的那一部分。

哪怕是看似严厉的 AGPL，您依然可以按照您的协议手搓一个，或者集成一个用户脚本管理器，把本程序当成给用户的快捷入口。

就如同图吧工具箱或者各类网络诊断工具一样，我建议直接原样集成我的程序，并且和您程序的主要功能之间没有深度交互。

**关于数据交换。** <br>本程序的导出物（如 CSV）可以交给您的程序读取。文件、管道、命令行参数是彼此独立的程序之间的通常交流方式，导出的数据属于使用者自己的数据，不含本程序的代码。文件级的数据交换属于保持距离的通信，这不构成 GPL 所说的"合并成一个更大的程序"（combined work，即衍生作品）。边界在于交流的深度：双方若交换复杂的内部数据结构，紧密到像一个程序的两个部分，就可能被视为一个更大的程序，那就回到第 1 条。

## Scope and Purpose (this section is explanatory, not part of the license text)

This license governs the program itself: its copies, its modified versions, and works that contain it.

There is really only one thing I care about: every version in circulation should carry my name. I do not allow anonymous versions to exist in the public world. The attribution clause was designed for exactly this purpose.

## Note on Compatibility with the GPL

> This section is a usage guide, not part of the license text. It neither adds nor removes any rights or obligations; the actual rights and obligations are governed by the license file in the repository. Note: I am not a lawyer, and I am writing this only to save users trouble. The conclusions below are not restrictions I deliberately impose, but rules of thumb I have drawn from the license text and from actual practice.

**The reason first.** The GPL requires that the entire combined work be released under the GPL, and that no further restrictions be placed on recipients beyond those of the GPL. This license has a fairly strong attribution requirement, plus terms on charging fees and on competition. From the GPL's perspective, all of these count as "additional restrictions" (similar in nature to the old BSD license with the advertising clause, which the FSF also considers incompatible with the GPL). The two sets of requirements cannot be satisfied at the same time, and the three points below all follow from this.

**1. If your program is a GPL program, it may be inconvenient for you to integrate my program at the code level (the two are literally hard to reconcile).**

My code is not proprietary, and your integration does not necessarily violate this license. The trouble lies on the GPL side: after merging, the GPL would require the whole work to be released under the GPL, and my attribution and other terms might, from the GPL's perspective, trigger further restrictions and the like, making the result literally "not pure".

**2. One exception: you hold all the copyright.**
In particular, suppose your GPL program has never incorporated third-party GPL code. It has been entirely your own original work from the start, or has only incorporated code under permissive licenses such as MIT, with no third-party GPL code. And suppose outside contributors all agree to your handling it this way. Then no third party can stop you. That is, every source of copyleft obligation comes entirely from you, the author, or from parts you have the right to control.

You may grant an exception license for this merger yourself (similar to the common "linking exception"). This license allows combining with other code into a larger work (see Section 3.7 of APL-Bro), provided that the terms for my part continue to be satisfied. In that case, code-level merging is possible: my part falls under this license, with attribution fully preserved, and your part falls under the GPL plus the exception you grant. The whole work is then no longer "pure GPL".

However, given the program's actual runtime environment (userscripts in the browser), code-level merging is also not very practical from an engineering standpoint. So this is only a theoretical possibility, not something I recommend.

**3. Mere aggregation: any license is fine, including the AGPL.**

The GPL calls this situation an "aggregate" (in GPLv2, "mere aggregation"): independent works placed in the same distribution package, not merged into one larger program. The GPL does not extend to the other parts because of this, and aggregation does not change the license of my part. As long as your userscript manager has no feature that erases, tampers with, or weakens attribution, and the script you integrate is byte-for-byte identical to the official version, you usually need not worry about the attribution clause:

- It is byte-for-byte identical to the official version, integrated as-is, with attribution intact.
- Your program (e.g., a userscript manager) has no feature that erases, tampers with, or weakens attribution, including rebranding, white-labeling, and the like. It also does not use compilation to impose additional restrictions on the rights users originally have in each work.
- You do not violate the terms of this project, and in particular you do not violate the attribution clause.
- Your program itself has no additional white-label restrictions, etc.
- There is no deep interaction with your program's main functionality: neither is an extension of the other, they share no internal data structures, and they do not call each other within the same process. It is not a derivative work or a deep integration.
- My prominent, mandatory, UI-level attribution and related terms still apply to my part.

Even with the seemingly strict AGPL, you can still build one yourself under your own license, or integrate a userscript manager that treats this program as a shortcut entry point for users.

Just like the Tualatin-Bar (图拉丁吧) Toolbox or various network diagnostic tool collections, I suggest integrating my program as-is, with no deep interaction with your program's main functionality.

**On data exchange.** This program's exports (such as CSV files) may be handed to your program to read. Files, pipes, and command-line arguments are the usual ways independent programs communicate with each other. The exported data belongs to the user and contains none of this program's code. File-level data exchange is communication at arm's length, and it does not amount to "merging into a larger program" (a "combined work", i.e., a derivative work) in the GPL's sense. The boundary is the depth of the exchange: if the two sides exchange complex internal data structures and are so tightly coupled that they look like two parts of one program, they may be treated as one larger program, and then we are back at Point 1.