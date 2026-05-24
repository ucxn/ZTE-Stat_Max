package main

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"net"
	"time"
)

// 定义测试用的高质量公共 STUN 服务器 (避免单一服务器出 Bug)
var stunServers = []string{
	"stun.hot-chilli.net:3478",
	"stun.chat.bilibili.com:3478",
	"stunserver2025.stunprotocol.org:3478",
}

// 核心 STUN 探测函数
func doSTUNRequest(conn *net.UDPConn, serverAddr string) (string, error) {
	addr, err := net.ResolveUDPAddr("udp", serverAddr)
	if err != nil {
		return "", err
	}

	// 构造标准 RFC 5389 STUN Binding Request (携带随机 Transaction ID)
	req := make([]byte, 20)
	binary.BigEndian.PutUint16(req[0:2], 0x0001)     // Binding Request
	binary.BigEndian.PutUint16(req[2:4], 0x0000)     // Length: 0
	binary.BigEndian.PutUint32(req[4:8], 0x2112A442) // Magic Cookie
	rand.Read(req[8:20])                             // 12字节随机 Transaction ID

	// 发送并设置 3 秒超时读取
	conn.WriteToUDP(req, addr)
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))

	resp := make([]byte, 1024)
	n, _, err := conn.ReadFromUDP(resp)
	if err != nil {
		return "Timeout (无响应)", nil
	}

	// 解析 STUN 响应，寻找映射地址
	for i := 20; i < n; {
		attrType := binary.BigEndian.Uint16(resp[i : i+2])
		attrLen := binary.BigEndian.Uint16(resp[i+2 : i+4])

		if attrType == 0x0020 || attrType == 0x0102 { // XOR-MAPPED-ADDRESS
			port := binary.BigEndian.Uint16(resp[i+6 : i+8]) ^ 0x2112
			return fmt.Sprintf("%d", port), nil
		}
		if attrType == 0x0001 { // MAPPED-ADDRESS (旧版兼容)
			port := binary.BigEndian.Uint16(resp[i+6 : i+8])
			return fmt.Sprintf("%d", port), nil
		}
		i += 4 + int(attrLen)
	}
	return "解析失败", nil
}

// 倒计时工具，防止长达 150 秒的等待让人觉得程序卡死了
func waitWithCountdown(seconds int) {
	fmt.Printf("[Zzz] 触发基站 UDP 会话老化，进入深度潜水状态...\n")
	for i := seconds; i > 0; i-- {
		fmt.Printf("\r  等待倒计时: %3d 秒 (请勿切断网络) ...", i)
		time.Sleep(1 * time.Second)
	}
	fmt.Printf("\r  等待完成! 准备发动下一次突袭。          \n\n")
}

func main() {
	fmt.Println("==================================================")
	fmt.Println("    哥哥科技专属：NAT 底层逻辑终极测谎仪 v1.0")
	fmt.Println("==================================================")
	
	waitTime := 150 // 每次测试后的硬核等待时间 (秒)

	// ==========================================
	// 阶段一：【连续固定端口测试】(测 3 次)
	// ==========================================
	fmt.Println("\n>>> [阶段一] 开始【连续固定端口】测试 (复用同一 Socket)")
	fixedLocalAddr, _ := net.ResolveUDPAddr("udp", "0.0.0.0:55555")
	fixedConn, err := net.ListenUDP("udp", fixedLocalAddr)
	if err != nil {
		fmt.Println("[-] 本地 55555 端口被占用，请更换。")
		return
	}
	fmt.Printf("[+] 成功死锁本地端口: %s\n\n", fixedLocalAddr.String())

	var fixedResults []string

	for i := 0; i < 3; i++ {
		server := stunServers[i%len(stunServers)]
		fmt.Printf(" [回合 %d] 测试目标: %s\n", i+1, server)
		
		pubPort, _ := doSTUNRequest(fixedConn, server)
		fmt.Printf(" [!] 电信基站分配的公网端口: 【 %s 】\n", pubPort)
		fixedResults = append(fixedResults, pubPort)

		if i < 2 { // 最后一次测试完不用等
			waitWithCountdown(waitTime)
		}
	}
	fixedConn.Close() // 彻底释放这个固定端口

	// ==========================================
	// 阶段二：【随机动态端口测试】(测 2 次)
	// ==========================================
	fmt.Println("\n--------------------------------------------------")
	fmt.Println(">>> [阶段二] 开始【随机动态端口】测试 (每次新建 Socket)")
	// 在进入阶段二前，再等一次，彻底切断阶段一的因果律
	waitWithCountdown(waitTime)

	var randomResults []string

	for i := 0; i < 2; i++ {
		server := stunServers[(i+1)%len(stunServers)] // 换着花样用服务器
		
		// 每次使用 "0.0.0.0:0" 让操作系统分配一个全新的随机可用端口
		randLocalAddr, _ := net.ResolveUDPAddr("udp", "0.0.0.0:0")
		randConn, _ := net.ListenUDP("udp", randLocalAddr)
		
		fmt.Printf(" [回合 %d] 本地随机端口: %s | 测试目标: %s\n", i+4, randConn.LocalAddr().String(), server)
		
		pubPort, _ := doSTUNRequest(randConn, server)
		fmt.Printf(" [!] 电信基站分配的公网端口: 【 %s 】\n", pubPort)
		randomResults = append(randomResults, pubPort)
		
		randConn.Close() // 测完立刻释放

		if i < 1 {
			waitWithCountdown(waitTime)
		}
	}

	// ==========================================
	// 阶段三：【终极法医报告】
	// ==========================================
	fmt.Println("\n==================================================")
	fmt.Println("               终极法医诊断报告")
	fmt.Println("==================================================")
	fmt.Printf("【阶段一：固定内网端口】公网端口轨迹: %s -> %s -> %s\n", fixedResults[0], fixedResults[1], fixedResults[2])
	fmt.Printf("【阶段二：随机内网端口】公网端口轨迹: %s -> %s\n\n", randomResults[0], randomResults[1])

	// 智能判定逻辑
	if fixedResults[0] == fixedResults[1] && fixedResults[1] == fixedResults[2] && fixedResults[0] != "Timeout (无响应)" {
		fmt.Println("[诊断结论] 货真价实的 Endpoint-Independent Mapping (NAT3)！")
		fmt.Println("[分析] 熬过了 150 秒的老化时间，换了 3 个不同的服务器，基站居然死死为你保留了同一个公网端口。向日葵能打通完全是实力。")
	} else if fixedResults[0] != "Timeout (无响应)" {
		fmt.Println("[诊断结论] Address-Dependent Mapping (对称型 NAT4) 实锤！")
		fmt.Println("[分析] 在本地端口完全锁死的情况下，随着时间流逝和目标切换，公网端口发生了跳变。EIM 假象已被彻底粉碎。")
		
		// 检测是否是 NAT4E (+1 步进)
		fmt.Println("\n[特别提醒] 请观察阶段一的端口轨迹是否呈现 +1 或连续递增状态。")
		fmt.Println("          如果是，证明武汉电信使用的是 NAT4E (顺序分配) 算法，这解释了向日葵为何能靠盲猜实现 50% 的打洞率！")
	}
	fmt.Println("==================================================")
}