package main

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"net"
	"time"
)

// ==========================================
// 核心配置区
// ==========================================
var TargetServers = []string{
	"stun.hot-chilli.net:3478",
	"stunserver2025.stunprotocol.org:3478",
	"stun.chat.bilibili.com:3478",
}

const (
	WaitStandard = 150 // 标准击穿时间 (切断 UDP 粘滞)
	WaitMedium   = 360 // 6 分钟软老化
	WaitHard     = 600 // 10 分钟终极硬老化
)

type ProbeResult struct {
	LocalAddr  string
	Server     string
	Protocol   string
	PublicIP   string
	PublicPort int
	IsTimeout  bool
}

var GlobalEvidences []string

// ==========================================
// 辅助功能：获取真实的本地出口 IPv4
// ==========================================
func getOutboundIP(server string) string {
	conn, err := net.Dial("udp4", server)
	if err != nil {
		return "UnknownIP"
	}
	defer conn.Close()
	return conn.LocalAddr().(*net.UDPAddr).IP.String()
}

// ==========================================
// 底层协议：构造与解析
// ==========================================
func buildSTUNRequest(protocol string) []byte {
	req := make([]byte, 20)
	binary.BigEndian.PutUint16(req[0:2], 0x0001) // Binding Request

	isRFC5780 := (protocol == "RFC5780-Map" || protocol == "RFC5780-Filter")
	if isRFC5780 {
		binary.BigEndian.PutUint32(req[4:8], 0x2112A442) 
	} else {
		rand.Read(req[4:8]) 
	}
	rand.Read(req[8:20])

	if protocol == "RFC5780-Filter" {
		binary.BigEndian.PutUint16(req[2:4], 0x0008)      // 属性总长度: 8 bytes
		attr := make([]byte, 8)
		binary.BigEndian.PutUint16(attr[0:2], 0x0003)     // 属性类型: CHANGE-REQUEST
		binary.BigEndian.PutUint16(attr[2:4], 0x0004)     // 属性长度: 4
		binary.BigEndian.PutUint32(attr[4:8], 0x00000002) // Flag: Change Port (要求换端口)
		req = append(req, attr...)
	} else {
		binary.BigEndian.PutUint16(req[2:4], 0x0000)
	}
	
	return req
}

func executeProbe(conn *net.UDPConn, server string, protocol string) ProbeResult {
	localIP := getOutboundIP(server)
	localPort := conn.LocalAddr().(*net.UDPAddr).Port

	res := ProbeResult{
		LocalAddr: fmt.Sprintf("%s:%d", localIP, localPort),
		Server:    server,
		Protocol:  protocol,
		IsTimeout: false,
	}

	addr, err := net.ResolveUDPAddr("udp4", server)
	if err != nil {
		res.IsTimeout = true
		return res
	}

	req := buildSTUNRequest(protocol)
	conn.WriteToUDP(req, addr)
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))

	resp := make([]byte, 1024)
	
	// 核心漏洞修复：抓取真实回包地址 rAddr 进行防欺骗审计
	n, rAddr, err := conn.ReadFromUDP(resp)
	if err != nil {
		res.IsTimeout = true
		return res
	}

	// 严防 "阳奉阴违" 的伪合规服务器
	if protocol == "RFC5780-Filter" && rAddr.String() == addr.String() {
		res.IsTimeout = true
		res.Protocol = "RFC5780-Filter (Server Ignored Flag)"
		return res
	}

	for i := 20; i < n; {
		if i+4 > n { break }
		attrType := binary.BigEndian.Uint16(resp[i : i+2])
		attrLen := binary.BigEndian.Uint16(resp[i+2 : i+4])

		if i+4+int(attrLen) > n { break } 

		if attrType == 0x0020 { 
			res.PublicPort = int(binary.BigEndian.Uint16(resp[i+6 : i+8]) ^ 0x2112)
			rawIP := binary.BigEndian.Uint32(resp[i+8 : i+12])
			decodedIP := rawIP ^ 0x2112A442
			ipBuf := make(net.IP, 4)
			binary.BigEndian.PutUint32(ipBuf, decodedIP)
			res.PublicIP = ipBuf.String()
			return res
		}
		if attrType == 0x0001 { 
			res.PublicPort = int(binary.BigEndian.Uint16(resp[i+6 : i+8]))
			ipBuf := make(net.IP, 4)
			copy(ipBuf, resp[i+8:i+12])
			res.PublicIP = ipBuf.String()
			return res
		}
		
		i += 4 + ((int(attrLen) + 3) &^ 3)
	}
	res.IsTimeout = true
	return res
}

// 智能暴力防抖层
func executeProbeWithRetry(conn *net.UDPConn, server string, protocol string) ProbeResult {
	res := executeProbe(conn, server, protocol)
	
	// 如果是 Filter 测试或者是服务器不支持导致的异常中断，绝对禁止重试
	if protocol == "RFC5780-Filter" || res.Protocol == "RFC5780-Filter (Server Ignored Flag)" || !res.IsTimeout { 
		return res 
	}

	fmt.Printf("      [!] %s 首次探测无响应，等待 5 秒后执行防抖重试 (1/4)...\n", protocol)
	time.Sleep(5 * time.Second)
	res = executeProbe(conn, server, protocol)
	if !res.IsTimeout { return res }

	fmt.Printf("      [!] %s 依然无响应，等待 5 秒后执行重试 (2/4)...\n", protocol)
	time.Sleep(5 * time.Second)
	res = executeProbe(conn, server, protocol)
	if !res.IsTimeout { return res }

	fmt.Printf("      [!] %s 连续短时重试失败。等待 60 秒后重试 (3/4)...\n", protocol)
	time.Sleep(60 * time.Second)
	res = executeProbe(conn, server, protocol)
	if !res.IsTimeout { return res }

	fmt.Printf("      [!] %s 进入终极防线，等待最后 60 秒后执行重试 (4/4)...\n", protocol)
	time.Sleep(60 * time.Second)
	res = executeProbe(conn, server, protocol)
	
	if res.IsTimeout {
		fmt.Printf("      [X] 彻底宣告失败，该节点或网络处于不可达状态。\n")
	}
	return res
}

// ==========================================
// 可视化与分析引擎
// ==========================================
func waitWithCountdown(seconds int, phase string) {
	fmt.Printf("\n[Zzz] %s - 触发基站 UDP 会话老化，潜水 %d 秒...\n", phase, seconds)
	for i := seconds; i > 0; i-- {
		if i%10 == 0 || i <= 5 {
			fmt.Printf("\r  -> 老化倒计时: %3d 秒 (严禁切断网络) ...", i)
		}
		time.Sleep(1 * time.Second)
	}
	fmt.Printf("\r  -> 老化完成! 准备发动下一轮探测。                    \n\n")
}

func getConn(port int) *net.UDPConn {
	addr, _ := net.ResolveUDPAddr("udp4", fmt.Sprintf("0.0.0.0:%d", port))
	conn, err := net.ListenUDP("udp4", addr)
	if err != nil {
		panic(fmt.Sprintf("端口 %d 绑定失败: %v", port, err))
	}
	return conn
}

func printVisualization(prev, curr ProbeResult, stepName string) {
	// 判断是否是服务器不支持
	displayProtocol := curr.Protocol
	if displayProtocol == "RFC5780-Filter (Server Ignored Flag)" {
		displayProtocol = "RFC5780-Filter" // 保持对齐
	}

	fmt.Printf("  [%s] 本地: %-21s | 协议: %-14s | 目标: %s\n", 
		stepName, curr.LocalAddr, displayProtocol, curr.Server)

	// 拦截服务器阳奉阴违的情况
	if curr.Protocol == "RFC5780-Filter (Server Ignored Flag)" {
		fmt.Printf("      └─> 结果: [无效] 该服务器不支持 Change-Request，已废弃该数据防误判。\n")
		return
	}

	if curr.IsTimeout {
		if curr.Protocol == "RFC5780-Filter" {
			fmt.Printf("      └─> 结果: [过滤拦截超时] 判定: Address-Dependent Filtering (NAT3/4 铁证)\n")
		} else {
			fmt.Printf("      └─> 结果: [彻底超时无响应]\n")
		}
		return
	}
	
	if curr.Protocol == "RFC5780-Filter" {
		fmt.Printf("      └─> 结果: 【 %s:%d 】 判定: Endpoint-Independent Filtering (全锥型 NAT1)\n", curr.PublicIP, curr.PublicPort)
		return
	}

	fmt.Printf("      └─> 结果: 【 %s:%d 】\n", curr.PublicIP, curr.PublicPort)

	// 核心法医诊断 (仅对 Mapping 结果计算 Delta)
	if !prev.IsTimeout && prev.PublicIP != "" && prev.Protocol != "RFC5780-Filter" && prev.Protocol != "RFC5780-Filter (Server Ignored Flag)" {
		delta := (curr.PublicPort - prev.PublicPort + 65536) % 65536
		
		if prev.PublicIP != curr.PublicIP {
			fmt.Printf("          [!] 警告: 公网 IP 发生物理漂移 (%s -> %s)！\n", prev.PublicIP, curr.PublicIP)
		} else {
			if prev.Server != curr.Server {
				// 跨目标比对
				if delta == 1 {
					msg := fmt.Sprintf("跨目标 NAT4E 步长递增 +1 (前置:%d -> 当前:%d, 目标: %s -> %s)", prev.PublicPort, curr.PublicPort, prev.Server, curr.Server)
					fmt.Printf("          [★] 致命证据: %s\n", msg)
					GlobalEvidences = append(GlobalEvidences, msg)
				} else if delta == 0 {
					fmt.Printf("          [=] 跨目标映射保持不变。判定: Endpoint-Independent Mapping (NAT1/2/3)\n")
				} else {
					msg := fmt.Sprintf("跨目标无序跳变 (Delta: %d, 目标: %s -> %s)", delta, prev.Server, curr.Server)
					fmt.Printf("          [~] 映射改变。判定: Symmetric NAT4 (动态端口)。\n")
					GlobalEvidences = append(GlobalEvidences, msg)
				}
			} else {
				// 同目标比对
				if delta == 1 {
					fmt.Printf("          [★] 同目标步长递增 +1。本地端口未变，极有可能是软老化重置！\n")
				} else if delta == 0 {
					fmt.Printf("          [=] 同目标映射保持粘滞。\n")
				} else {
					fmt.Printf("          [~] 同目标端口剧烈跳变 (Delta: %d)。疑为全局池刷新。\n", delta)
				}
			}
		}
	}
	fmt.Println()
}

func runCombo(conn *net.UDPConn, prevRes ProbeResult, tagPrefix string) ProbeResult {
	currentRes := prevRes
	for sIdx, server := range TargetServers {
		step3489 := fmt.Sprintf("%s-S%d-3489", tagPrefix, sIdx+1)
		res3489 := executeProbeWithRetry(conn, server, "RFC3489")
		printVisualization(currentRes, res3489, step3489)
		currentRes = res3489

		step5780M := fmt.Sprintf("%s-S%d-5780M", tagPrefix, sIdx+1)
		res5780M := executeProbeWithRetry(conn, server, "RFC5780-Map")
		printVisualization(currentRes, res5780M, step5780M)
		currentRes = res5780M

		step5780F := fmt.Sprintf("%s-S%d-5780F", tagPrefix, sIdx+1)
		res5780F := executeProbeWithRetry(conn, server, "RFC5780-Filter")
		printVisualization(currentRes, res5780F, step5780F)
	}
	fmt.Println("  --------------------------------------------------")
	return currentRes 
}

// ==========================================
// 主程序：矩阵执行
// ==========================================
func main() {
	fmt.Println("================================================================")
	fmt.Println("   The Ultimate Matrix: CGNAT 深度四维状态机探测系统 v3.1 (极限审计版)")
	fmt.Println("================================================================")
	fmt.Println("警告：包含长时硬等待和防伪审计，本程序旨在一次性拿到绝对铁证。")
	fmt.Println("----------------------------------------------------------------")

	var lastRes ProbeResult

	fmt.Println("\n>>> [Phase 1] 战役一：基准独立测试 (纯 3489 + 顺序递增)")
	basePortPhase1 := 41000
	for i := 0; i < 3; i++ {
		curPort := basePortPhase1 + i
		conn := getConn(curPort)
		fmt.Printf("\n【Phase 1 - 回合 %d】使用顺序端口: %d\n", i+1, curPort)
		res := executeProbeWithRetry(conn, TargetServers[0], "RFC3489")
		printVisualization(lastRes, res, fmt.Sprintf("P1-Seq%d", i+1))
		lastRes = res
		conn.Close()
		if i < 2 { waitWithCountdown(WaitStandard, "1.1 递增端口间断开粘滞") }
	}

	waitWithCountdown(WaitStandard, "战役一 -> 战役二 深度隔离期")

	fmt.Println("\n>>> [Phase 2] 战役二：双协议多目标混合 3-2-1 阵型 (核心战区)")

	fmt.Println("\n【路线 A】3-2-1 连续固定阵型 (验证同端口绝对粘滞性)")
	portA := 42000
	connA := getConn(portA)
	fmt.Println("  -- Round A-1 (固定端口连续 3 次连招) --")
	for i := 0; i < 3; i++ { lastRes = runCombo(connA, lastRes, fmt.Sprintf("A-R1-%d", i+1)) }
	waitWithCountdown(WaitStandard, "路线A-R1击穿")
	
	fmt.Println("  -- Round A-2 (固定端口连续 2 次连招) --")
	for i := 0; i < 2; i++ { lastRes = runCombo(connA, lastRes, fmt.Sprintf("A-R2-%d", i+1)) }
	waitWithCountdown(WaitStandard, "路线A-R2击穿")
	
	fmt.Println("  -- Round A-3 (固定端口单次连招) --")
	lastRes = runCombo(connA, lastRes, "A-R3-1")
	connA.Close()

	waitWithCountdown(WaitStandard, "路线 A -> 路线 B 深度隔离期")

	fmt.Println("\n【路线 B】3-2-1 顺序递增阵型 (捕捉跨周期 NAT4E 步长)")
	portB := 43000
	connB1 := getConn(portB)
	fmt.Printf("  -- Round B-1 (初始端口 %d, 连续 3 次) --\n", portB)
	for i := 0; i < 3; i++ { lastRes = runCombo(connB1, lastRes, fmt.Sprintf("B-R1-%d", i+1)) }
	connB1.Close()
	waitWithCountdown(WaitStandard, "路线B-R1击穿")
	
	portB++
	connB2 := getConn(portB)
	fmt.Printf("  -- Round B-2 (端口递增至 %d, 连续 2 次) --\n", portB)
	for i := 0; i < 2; i++ { lastRes = runCombo(connB2, lastRes, fmt.Sprintf("B-R2-%d", i+1)) }
	connB2.Close()
	waitWithCountdown(WaitStandard, "路线B-R2击穿")

	portB++
	connB3 := getConn(portB)
	fmt.Printf("  -- Round B-3 (端口递增至 %d, 单次连招) --\n", portB)
	lastRes = runCombo(connB3, lastRes, "B-R3-1")
	connB3.Close()

	waitWithCountdown(WaitStandard, "战役二 -> 战役三 深度隔离期")

	fmt.Println("\n>>> [Phase 3] 战役三：中长时老化硬核测试 (物理极限)")

	fmt.Println("\n【测试组 3.1】6 分钟软老化 + 协议翻转 (同端口)")
	portC := 44000
	connC := getConn(portC)
	res31_1 := executeProbeWithRetry(connC, TargetServers[0], "RFC3489")
	printVisualization(lastRes, res31_1, "Phase3-Pre-6Min")
	
	waitWithCountdown(WaitMedium, "6分钟中度物理老化")
	
	res31_2 := executeProbeWithRetry(connC, TargetServers[0], "RFC5780-Map")
	printVisualization(res31_1, res31_2, "Phase3-Post-6Min")
	connC.Close()

	waitWithCountdown(WaitStandard, "3.1 -> 3.3 深度隔离期")

	fmt.Println("\n【测试组 3.3】10 分钟死亡静默测试 (同端口)")
	portD := 45000
	connD := getConn(portD)
	res33_1 := executeProbeWithRetry(connD, TargetServers[0], "RFC5780-Map")
	printVisualization(lastRes, res33_1, "Phase3-Pre-10Min")

	waitWithCountdown(WaitHard, "10分钟终极物理死亡老化")

	res33_2 := executeProbeWithRetry(connD, TargetServers[0], "RFC5780-Map")
	printVisualization(res33_1, res33_2, "Phase3-Post-10Min")
	connD.Close()

	fmt.Println("\n================================================================")
	fmt.Println("                    终极法医诊断报告")
	fmt.Println("================================================================")
	if len(GlobalEvidences) == 0 {
		fmt.Println("[结论] 未发现明显的 Symmetric 或 NAT4E (递增) 特征。")
		fmt.Println("      如果整个过程端口几乎不变，说明该基站属于极其友好的 NAT3 (EIM)。")
		fmt.Println("      如果端口跳变完全随机无规律，则为极度恶劣的纯 Symmetric (NAT4)。")
	} else {
		fmt.Println("[致命发现汇总] 程序在运行中捕获到了以下关键的映射跳变证据：")
		for _, ev := range GlobalEvidences {
			fmt.Printf("  - %s\n", ev)
		}
		fmt.Println("\n[最终判定结论]")
		fmt.Println("  大量出现 '步长递增 +1' -> 该电信基站采用 Symmetric Easy Increase (NAT4E)。")
		fmt.Println("  基站不仅根据你的目标服务器分配不同的公网端口，而且分配逻辑是粗暴的序列发生器。")
		fmt.Println("  这意味着在 P2P 打洞时，对方可以通过预测端口强行击穿你的 NAT！")
	}
	fmt.Println("================================================================")
}