package main

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"net"
	"time"
)

var servers = []string{
	"stun.hot-chilli.net:3478",
	"stun.chat.bilibili.com:3478",
	"stunserver2025.stunprotocol.org:3478",
}

type NATResult struct {
	Local  string
	Public string
}

func getSTUNMapping(conn *net.UDPConn, server string) (string, error) {
	addr, err := net.ResolveUDPAddr("udp", server)
	if err != nil {
		return "", err
	}
	req := make([]byte, 20)
	binary.BigEndian.PutUint16(req[0:2], 0x0001)
	binary.BigEndian.PutUint32(req[4:8], 0x2112A442) // Magic Cookie
	rand.Read(req[8:20])

	conn.WriteToUDP(req, addr)
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	resp := make([]byte, 1024)
	n, _, err := conn.ReadFromUDP(resp)
	if err != nil {
		return "TIMEOUT", err
	}

	for i := 20; i < n; {
		if i+4 > n { break }
		attrType := binary.BigEndian.Uint16(resp[i : i+2])
		attrLen := binary.BigEndian.Uint16(resp[i+2 : i+4])
		
		// XOR-MAPPED-ADDRESS (0x0020)
		if attrType == 0x0020 {
			// 1. 解码端口
			port := binary.BigEndian.Uint16(resp[i+6 : i+8]) ^ 0x2112
			
			// 2. 解码 IP (关键：必须异或 Magic Cookie)
			rawIP := binary.BigEndian.Uint32(resp[i+8 : i+12])
			decodedIP := rawIP ^ 0x2112A442
			
			ip := make(net.IP, 4)
			binary.BigEndian.PutUint32(ip, decodedIP)
			
			return fmt.Sprintf("%s:%d", ip.String(), port), nil
		}
		i += 4 + int(attrLen)
	}
	return "PARSE_ERROR", nil
}

func countdown(msg string, seconds int) {
	fmt.Printf("[%s] ", msg)
	for i := seconds; i > 0; i-- {
		fmt.Printf("\r[%s] 深度等待倒计时: %d 秒... ", msg, i)
		time.Sleep(time.Second)
	}
	fmt.Println("\n[!] 等待结束，准备执行下一阶段。")
}

func main() {
	fmt.Println("==================================================")
	fmt.Println("    哥哥科技：RFC 5780 & 3489 深度组合探测器")
	fmt.Println("==================================================")

	// --- 阶段一：固定端口 & 目标敏感度 (RFC 5780 Mapping Test) ---
	fmt.Println("\n【维度 A：固定本地端口 - 即时目标测试】")
	lAddr, _ := net.ResolveUDPAddr("udp", "0.0.0.0:6666")
	conn, _ := net.ListenUDP("udp", lAddr)
	res1, _ := getSTUNMapping(conn, servers[0])
	res2, _ := getSTUNMapping(conn, servers[1])
	fmt.Printf("结果 A1 (目标1): %s -> %s\n", lAddr.String(), res1)
	fmt.Printf("结果 A2 (目标2): %s -> %s\n", lAddr.String(), res2)
	conn.Close()

	// --- 阶段二：固定端口 & 时间敏感度 (6分钟老化测试) ---
	fmt.Println("\n【维度 B：固定本地端口 - 6分钟老化重置测试】")
	countdown("Session Aging", 360)
	connB, _ := net.ListenUDP("udp", lAddr)
	resB, _ := getSTUNMapping(connB, servers[0])
	fmt.Printf("结果 B (老化后同端口): %s -> %s\n", lAddr.String(), resB)
	connB.Close()

	// --- 阶段三：递增端口 & 分配算法测试 (RFC 3489 变体) ---
	fmt.Println("\n【维度 C：本地端口递增 - 映射相关性测试】")
	for i := 0; i < 3; i++ {
		p := 7777 + i
		curL, _ := net.ResolveUDPAddr("udp", fmt.Sprintf("0.0.0.0:%d", p))
		curC, _ := net.ListenUDP("udp", curL)
		resC, _ := getSTUNMapping(curC, servers[0])
		fmt.Printf("结果 C%d (内网 %d): 公网 -> %s\n", i+1, p, resC)
		curC.Close()
		time.Sleep(time.Second)
	}

	// --- 阶段四：随机端口 & 全局分配策略 ---
	fmt.Println("\n【维度 D：本地随机端口 - 全局规律探测】")
	for i := 0; i < 2; i++ {
		curC, _ := net.ListenUDP("udp", nil) // 随机分配
		resD, _ := getSTUNMapping(curC, servers[0])
		fmt.Printf("结果 D%d (内网随机): %s -> %s\n", i+1, curC.LocalAddr().String(), resD)
		curC.Close()
		time.Sleep(time.Second)
	}

	fmt.Println("\n==================================================")
	fmt.Println("探测结束。请对比 A1/A2 (判映射)，B (判老化)，C (判算法)。")
}