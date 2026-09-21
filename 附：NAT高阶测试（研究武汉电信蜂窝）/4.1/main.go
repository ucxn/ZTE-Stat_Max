// SPDX-License-Identifier: AAL
// Copyright (c) 2026 哥哥科技
package main

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"strings"
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
	WaitStandard = 150
	WaitMedium   = 360
	WaitHard     = 600
	ReadTimeout  = 3 * time.Second
	magicCookie  = 0x2112A442
)

const (
	bindingRequest       = 0x0001
	bindingSuccess       = 0x0101
	bindingError         = 0x0111
	attrMappedAddress    = 0x0001
	attrChangeRequest    = 0x0003
	attrChangedAddress   = 0x0005
	attrErrorCode        = 0x0009
	attrXorMappedAddress = 0x0020
	attrResponseOrigin   = 0x802b
	attrOtherAddress     = 0x802c
)

type ProbeMode int

const (
	ProbeRFC3489 ProbeMode = iota
	ProbeRFC5389
)

func (m ProbeMode) String() string {
	if m == ProbeRFC3489 {
		return "RFC3489"
	}
	return "RFC5389/5780"
}

type STUNRequest struct {
	Packet []byte
	TxID   []byte
	Modern bool
}

type ProbeResult struct {
	LocalAddr      string
	Server         string
	Mode           ProbeMode
	PublicAddr     *net.UDPAddr
	OtherAddr      *net.UDPAddr
	ResponseOrigin *net.UDPAddr
	ResponseSource *net.UDPAddr
	Timeout        bool
	STUNErrorCode  int
	Err            error
}

func (r ProbeResult) OK() bool {
	return r.Err == nil && !r.Timeout && r.PublicAddr != nil && r.STUNErrorCode == 0
}

type BehaviorReport struct {
	Server    string
	Supported bool
	Reason    string
	Public    *net.UDPAddr
	Mapping   string
	Filtering string
}

type EvidenceStats struct {
	CrossTargetCompared int
	CrossTargetSame     int
	CrossTargetChanged  int
	CrossTargetPlusOne  int
	CrossTargetOther    int
	PublicIPDrift       int
	Notes               []string
}

var Evidence EvidenceStats

// ==========================================
// STUN 编解码
// ==========================================
func buildSTUNRequest(mode ProbeMode, changeIP, changePort bool) (STUNRequest, error) {
	req := make([]byte, 20)
	binary.BigEndian.PutUint16(req[0:2], bindingRequest)

	var txID []byte
	modern := mode == ProbeRFC5389
	if modern {
		binary.BigEndian.PutUint32(req[4:8], magicCookie)
		txID = make([]byte, 12)
		if _, err := rand.Read(txID); err != nil {
			return STUNRequest{}, err
		}
		copy(req[8:20], txID)
	} else {
		// RFC 3489: bytes 4..19 全部属于 128-bit Transaction ID。
		txID = make([]byte, 16)
		if _, err := rand.Read(txID); err != nil {
			return STUNRequest{}, err
		}
		copy(req[4:20], txID)
	}

	if changeIP || changePort {
		attr := make([]byte, 8)
		binary.BigEndian.PutUint16(attr[0:2], attrChangeRequest)
		binary.BigEndian.PutUint16(attr[2:4], 4)
		var flags uint32
		if changeIP {
			flags |= 0x04
		}
		if changePort {
			flags |= 0x02
		}
		binary.BigEndian.PutUint32(attr[4:8], flags)
		req = append(req, attr...)
		binary.BigEndian.PutUint16(req[2:4], uint16(len(attr)))
	}

	return STUNRequest{Packet: req, TxID: txID, Modern: modern}, nil
}

func txIDMatches(data []byte, req STUNRequest) bool {
	if len(data) < 20 {
		return false
	}
	if req.Modern {
		if binary.BigEndian.Uint32(data[4:8]) != magicCookie {
			return false
		}
		return len(req.TxID) == 12 && bytes.Equal(data[8:20], req.TxID)
	}
	return len(req.TxID) == 16 && bytes.Equal(data[4:20], req.TxID)
}

func parseAddrAttr(value []byte, xor bool, txID []byte) (*net.UDPAddr, error) {
	if len(value) < 4 {
		return nil, errors.New("address attribute too short")
	}
	family := value[1]
	port := binary.BigEndian.Uint16(value[2:4])
	if xor {
		port ^= uint16(magicCookie >> 16)
	}

	switch family {
	case 0x01: // IPv4
		if len(value) < 8 {
			return nil, errors.New("IPv4 address attribute too short")
		}
		ip := append(net.IP(nil), value[4:8]...)
		if xor {
			cookie := make([]byte, 4)
			binary.BigEndian.PutUint32(cookie, magicCookie)
			for i := 0; i < 4; i++ {
				ip[i] ^= cookie[i]
			}
		}
		return &net.UDPAddr{IP: ip, Port: int(port)}, nil

	case 0x02: // IPv6
		if len(value) < 20 {
			return nil, errors.New("IPv6 address attribute too short")
		}
		ip := append(net.IP(nil), value[4:20]...)
		if xor {
			mask := make([]byte, 16)
			binary.BigEndian.PutUint32(mask[0:4], magicCookie)
			if len(txID) >= 12 {
				copy(mask[4:], txID[:12])
			}
			for i := 0; i < 16; i++ {
				ip[i] ^= mask[i]
			}
		}
		return &net.UDPAddr{IP: ip, Port: int(port)}, nil
	}

	return nil, fmt.Errorf("unsupported address family 0x%02x", family)
}

func parseSTUNResponse(data []byte, req STUNRequest) (ProbeResult, bool) {
	if len(data) < 20 || !txIDMatches(data, req) {
		return ProbeResult{}, false
	}

	msgType := binary.BigEndian.Uint16(data[0:2])
	msgLen := int(binary.BigEndian.Uint16(data[2:4]))
	if msgLen > len(data)-20 {
		return ProbeResult{Err: errors.New("truncated STUN message")}, true
	}
	if msgType != bindingSuccess && msgType != bindingError {
		return ProbeResult{Err: fmt.Errorf("unexpected STUN message type 0x%04x", msgType)}, true
	}

	res := ProbeResult{}
	end := 20 + msgLen
	for off := 20; off+4 <= end; {
		attrType := binary.BigEndian.Uint16(data[off : off+2])
		attrLen := int(binary.BigEndian.Uint16(data[off+2 : off+4]))
		valueStart := off + 4
		valueEnd := valueStart + attrLen
		if valueEnd > end {
			res.Err = errors.New("truncated STUN attribute")
			return res, true
		}
		value := data[valueStart:valueEnd]

		switch attrType {
		case attrXorMappedAddress:
			if ep, err := parseAddrAttr(value, true, req.TxID); err == nil {
				res.PublicAddr = ep
			}
		case attrMappedAddress:
			if ep, err := parseAddrAttr(value, false, req.TxID); err == nil && res.PublicAddr == nil {
				res.PublicAddr = ep
			}
		case attrOtherAddress, attrChangedAddress:
			if ep, err := parseAddrAttr(value, false, req.TxID); err == nil {
				res.OtherAddr = ep
			}
		case attrResponseOrigin:
			if ep, err := parseAddrAttr(value, false, req.TxID); err == nil {
				res.ResponseOrigin = ep
			}
		case attrErrorCode:
			if len(value) >= 4 {
				res.STUNErrorCode = int(value[2]&0x07)*100 + int(value[3])
			}
		}

		// STUN attributes are padded to 32-bit alignment.
		off = valueStart + ((attrLen + 3) &^ 3)
	}

	if msgType == bindingError && res.STUNErrorCode == 0 {
		res.STUNErrorCode = -1
	}
	return res, true
}

func routeLocalIP(server *net.UDPAddr) net.IP {
	conn, err := net.DialUDP("udp4", nil, server)
	if err != nil {
		return nil
	}
	defer conn.Close()
	if a, ok := conn.LocalAddr().(*net.UDPAddr); ok {
		return a.IP
	}
	return nil
}

func executeProbeTo(conn *net.UDPConn, server *net.UDPAddr, serverName string, mode ProbeMode, changeIP, changePort bool) ProbeResult {
	res := ProbeResult{Server: serverName, Mode: mode}
	localPort := conn.LocalAddr().(*net.UDPAddr).Port
	localIP := routeLocalIP(server)
	if localIP == nil {
		res.LocalAddr = fmt.Sprintf("0.0.0.0:%d", localPort)
	} else {
		res.LocalAddr = (&net.UDPAddr{IP: localIP, Port: localPort}).String()
	}

	req, err := buildSTUNRequest(mode, changeIP, changePort)
	if err != nil {
		res.Err = err
		return res
	}
	if _, err = conn.WriteToUDP(req.Packet, server); err != nil {
		res.Err = err
		return res
	}

	deadline := time.Now().Add(ReadTimeout)
	if err := conn.SetReadDeadline(deadline); err != nil {
		res.Err = err
		return res
	}

	buf := make([]byte, 2048)
	for {
		n, src, readErr := conn.ReadFromUDP(buf)
		if readErr != nil {
			if ne, ok := readErr.(net.Error); ok && ne.Timeout() {
				res.Timeout = true
				return res
			}
			res.Err = readErr
			return res
		}

		parsed, matched := parseSTUNResponse(buf[:n], req)
		if !matched {
			// 旧包、别的并发报文或延迟包，不能让它污染当前事务。
			if time.Now().After(deadline) {
				res.Timeout = true
				return res
			}
			continue
		}
		parsed.LocalAddr = res.LocalAddr
		parsed.Server = serverName
		parsed.Mode = mode
		parsed.ResponseSource = src
		return parsed
	}
}

func executeProbe(conn *net.UDPConn, server string, mode ProbeMode) ProbeResult {
	addr, err := net.ResolveUDPAddr("udp4", server)
	if err != nil {
		return ProbeResult{Server: server, Mode: mode, Err: err}
	}
	return executeProbeTo(conn, addr, server, mode, false, false)
}

func executeProbeWithRetry(conn *net.UDPConn, server string, mode ProbeMode) ProbeResult {
	res := executeProbe(conn, server, mode)
	if res.OK() || res.Err != nil {
		return res
	}

	// 普通 Binding 探测可重试；事务 ID 校验后，延迟旧包不会串台。
	waits := []time.Duration{5 * time.Second, 5 * time.Second, 60 * time.Second, 60 * time.Second}
	for i, w := range waits {
		fmt.Printf("      [!] %s 首次/前次探测无响应，等待 %v 后重试 (%d/%d)...\n", mode, w, i+1, len(waits))
		time.Sleep(w)
		res = executeProbe(conn, server, mode)
		if res.OK() || res.Err != nil {
			return res
		}
	}
	return res
}

// ==========================================
// RFC 5780 标准行为发现
// ==========================================
func sameEndpoint(a, b *net.UDPAddr) bool {
	return a != nil && b != nil && a.Port == b.Port && a.IP.Equal(b.IP)
}

func sameIP(a, b *net.UDPAddr) bool {
	return a != nil && b != nil && a.IP.Equal(b.IP)
}

func newUDPConn() (*net.UDPConn, error) {
	return net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4zero, Port: 0})
}

func runRFC5780Standard(server string) BehaviorReport {
	report := BehaviorReport{Server: server, Mapping: "Inconclusive", Filtering: "Inconclusive"}
	primary, err := net.ResolveUDPAddr("udp4", server)
	if err != nil {
		report.Reason = "DNS/地址解析失败: " + err.Error()
		return report
	}

	// Mapping 与 Filtering 必须使用不同 socket，避免 Mapping 测试先访问备用地址后
	// 污染 Filtering 的“此前未访问 alternate endpoint”前置条件。
	mapConn, err := newUDPConn()
	if err != nil {
		report.Reason = "无法创建 Mapping socket: " + err.Error()
		return report
	}
	defer mapConn.Close()

	testI := executeProbeTo(mapConn, primary, server, ProbeRFC5389, false, false)
	if !testI.OK() {
		if testI.STUNErrorCode != 0 {
			report.Reason = fmt.Sprintf("STUN Test I 返回错误 %d", testI.STUNErrorCode)
		} else if testI.Err != nil {
			report.Reason = "STUN Test I 失败: " + testI.Err.Error()
		} else {
			report.Reason = "STUN Test I 超时"
		}
		return report
	}
	report.Public = testI.PublicAddr
	if testI.OtherAddr == nil {
		report.Reason = "服务器未返回 OTHER-ADDRESS，不支持完整 RFC5780 行为发现"
		return report
	}
	other := testI.OtherAddr
	if other.IP == nil || other.Port == 0 || other.IP.Equal(primary.IP) {
		report.Reason = "OTHER-ADDRESS 缺少真正的备用 IP/端口，无法做完整 RFC5780 判定"
		return report
	}

	// Mapping Test I/II/III, RFC 5780 §4.3
	localIP := routeLocalIP(primary)
	localPort := mapConn.LocalAddr().(*net.UDPAddr).Port
	if localIP != nil && sameEndpoint(testI.PublicAddr, &net.UDPAddr{IP: localIP, Port: localPort}) {
		report.Mapping = "Direct / Endpoint-Independent Mapping"
	} else {
		testIIServer := &net.UDPAddr{IP: other.IP, Port: primary.Port}
		testII := executeProbeTo(mapConn, testIIServer, testIIServer.String(), ProbeRFC5389, false, false)
		if !testII.OK() {
			report.Reason = "Mapping Test II 无法完成，服务器备用地址不可用"
			return report
		}
		if sameEndpoint(testI.PublicAddr, testII.PublicAddr) {
			report.Mapping = "Endpoint-Independent Mapping"
		} else {
			testIII := executeProbeTo(mapConn, other, other.String(), ProbeRFC5389, false, false)
			if !testIII.OK() {
				report.Reason = "Mapping Test III 无法完成，服务器备用端点不可用"
				return report
			}
			if sameEndpoint(testII.PublicAddr, testIII.PublicAddr) {
				report.Mapping = "Address-Dependent Mapping"
			} else {
				report.Mapping = "Address-and-Port-Dependent Mapping"
			}
		}
	}

	filterConn, err := newUDPConn()
	if err != nil {
		report.Reason = "无法创建 Filtering socket: " + err.Error()
		return report
	}
	defer filterConn.Close()

	filterI := executeProbeTo(filterConn, primary, server, ProbeRFC5389, false, false)
	if !filterI.OK() || filterI.OtherAddr == nil {
		report.Reason = "Filtering Test I 无法取得 OTHER-ADDRESS"
		return report
	}
	filterOther := filterI.OtherAddr

	// Filtering Test II: 请求服务器从 alternate IP + alternate port 回包。
	filterII := executeProbeTo(filterConn, primary, server, ProbeRFC5389, true, true)
	if filterII.OK() {
		if sameEndpoint(filterII.ResponseSource, filterOther) {
			report.Filtering = "Endpoint-Independent Filtering"
			report.Supported = true
			report.Reason = "RFC5780 Mapping/Filtering 完整完成"
			return report
		}
		report.Reason = fmt.Sprintf("服务器忽略/错误执行 CHANGE-REQUEST(IP+Port)，实际回包来自 %v，期望 %v", filterII.ResponseSource, filterOther)
		return report
	}
	if filterII.Err != nil || filterII.STUNErrorCode != 0 {
		report.Reason = "Filtering Test II 返回协议/网络错误，不能把它当 NAT 过滤"
		return report
	}
	if !filterII.Timeout {
		report.Reason = "Filtering Test II 收到无法解析为有效 Binding Response 的报文，不能当作过滤超时"
		return report
	}

	// Filtering Test III: Test II 超时后，仅要求 change-port。
	// 成功 => ADF；继续超时 => APDF。
	filterIII := executeProbeTo(filterConn, primary, server, ProbeRFC5389, false, true)
	if filterIII.OK() {
		expected := &net.UDPAddr{IP: primary.IP, Port: filterOther.Port}
		if sameEndpoint(filterIII.ResponseSource, expected) {
			report.Filtering = "Address-Dependent Filtering"
			report.Supported = true
			report.Reason = "RFC5780 Mapping/Filtering 完整完成"
			return report
		}
		report.Reason = fmt.Sprintf("服务器忽略/错误执行 CHANGE-REQUEST(Port)，实际回包来自 %v，期望 %v", filterIII.ResponseSource, expected)
		return report
	}
	if filterIII.Err != nil || filterIII.STUNErrorCode != 0 {
		report.Reason = "Filtering Test III 返回协议/网络错误，无法完成过滤判定"
		return report
	}
	if !filterIII.Timeout {
		report.Reason = "Filtering Test III 收到无法解析为有效 Binding Response 的报文，无法完成过滤判定"
		return report
	}

	report.Filtering = "Address-and-Port-Dependent Filtering"
	report.Supported = true
	report.Reason = "RFC5780 Mapping/Filtering 完整完成"
	return report
}

func findRFC5780Server() BehaviorReport {
	for _, server := range TargetServers {
		fmt.Printf("\n>>> [RFC5780 标准测试] 尝试服务器 %s\n", server)
		r := runRFC5780Standard(server)
		fmt.Printf("    Mapping   : %s\n", r.Mapping)
		fmt.Printf("    Filtering : %s\n", r.Filtering)
		fmt.Printf("    状态      : %s\n", r.Reason)
		if r.Supported {
			return r
		}
	}
	return BehaviorReport{Reason: "目标列表中没有服务器完成完整 RFC5780 行为发现", Mapping: "Inconclusive", Filtering: "Inconclusive"}
}

// ==========================================
// 多服务器经验矩阵：用来观察 CGNAT 端口分配规律，不冒充 RFC5780 标准判定
// ==========================================
func printProbe(step string, r ProbeResult) {
	fmt.Printf("  [%s] 本地: %-22s | 协议: %-12s | 目标: %s\n", step, r.LocalAddr, r.Mode, r.Server)
	if r.Err != nil {
		fmt.Printf("      └─> [错误] %v\n", r.Err)
		return
	}
	if r.Timeout {
		fmt.Printf("      └─> [超时]\n")
		return
	}
	if r.STUNErrorCode != 0 {
		fmt.Printf("      └─> [STUN错误] %d\n", r.STUNErrorCode)
		return
	}
	if r.PublicAddr == nil {
		fmt.Printf("      └─> [无映射地址]\n")
		return
	}
	fmt.Printf("      └─> 公网映射: %s\n", r.PublicAddr)
}

func modularDelta(prev, curr int) int {
	return (curr - prev + 65536) % 65536
}

func analyzeControlledPair(prev, curr ProbeResult) {
	if !prev.OK() || !curr.OK() || prev.PublicAddr == nil || curr.PublicAddr == nil {
		return
	}
	if prev.LocalAddr != curr.LocalAddr || prev.Mode != curr.Mode || prev.Server == curr.Server {
		return
	}

	Evidence.CrossTargetCompared++
	if !sameIP(prev.PublicAddr, curr.PublicAddr) {
		Evidence.PublicIPDrift++
		Evidence.Notes = append(Evidence.Notes,
			fmt.Sprintf("同一内网端点跨目标时公网 IP 漂移: %s -> %s", prev.PublicAddr, curr.PublicAddr))
		return
	}
	if prev.PublicAddr.Port == curr.PublicAddr.Port {
		Evidence.CrossTargetSame++
		return
	}

	Evidence.CrossTargetChanged++
	d := modularDelta(prev.PublicAddr.Port, curr.PublicAddr.Port)
	if d == 1 {
		Evidence.CrossTargetPlusOne++
		Evidence.Notes = append(Evidence.Notes,
			fmt.Sprintf("跨目标 +1: %s -> %s (%s -> %s)", prev.PublicAddr, curr.PublicAddr, prev.Server, curr.Server))
	} else {
		Evidence.CrossTargetOther++
		Evidence.Notes = append(Evidence.Notes,
			fmt.Sprintf("跨目标端口改变 Δ=%d: %s -> %s", d, prev.PublicAddr, curr.PublicAddr))
	}
}

func runMappingSweep(conn *net.UDPConn, mode ProbeMode, tag string) []ProbeResult {
	var out []ProbeResult
	var prev ProbeResult
	for i, server := range TargetServers {
		r := executeProbeWithRetry(conn, server, mode)
		printProbe(fmt.Sprintf("%s-S%d", tag, i+1), r)
		if i > 0 && mode == ProbeRFC5389 {
			// NAT4E-like 经验判定只使用现代 STUN；RFC3489 仅作协议兼容对照。
			analyzeControlledPair(prev, r)
		}
		prev = r
		out = append(out, r)
	}
	return out
}

func waitWithCountdown(seconds int, phase string) {
	fmt.Printf("\n[Zzz] %s - 静默 %d 秒...\n", phase, seconds)
	for i := seconds; i > 0; i-- {
		if i%10 == 0 || i <= 5 {
			fmt.Printf("\r  -> 倒计时: %3d 秒 (请勿切断网络) ...", i)
		}
		time.Sleep(time.Second)
	}
	fmt.Printf("\r  -> 等待完成。                                      \n\n")
}

func getConn(port int) *net.UDPConn {
	conn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4zero, Port: port})
	if err != nil {
		panic(fmt.Sprintf("端口 %d 绑定失败: %v", port, err))
	}
	return conn
}

func legacyType(mapping, filtering string) string {
	if strings.Contains(mapping, "Direct") {
		return "Open Internet / 无 NAT"
	}
	if mapping == "Endpoint-Independent Mapping" {
		switch filtering {
		case "Endpoint-Independent Filtering":
			return "Full Cone / 常见 NAT1 对应"
		case "Address-Dependent Filtering":
			return "Restricted Cone / 常见 NAT2 对应"
		case "Address-and-Port-Dependent Filtering":
			return "Port-Restricted Cone / 常见 NAT3 对应"
		}
	}
	if mapping == "Address-Dependent Mapping" || mapping == "Address-and-Port-Dependent Mapping" {
		return "Destination-Dependent Mapping / 传统分类中通常归入 Symmetric(NAT4-like)"
	}
	return "无法可靠映射到传统 NAT1/2/3/4"
}

func printFinalReport(std BehaviorReport) {
	fmt.Println("\n================================================================")
	fmt.Println("                    终极法医诊断报告")
	fmt.Println("================================================================")

	if std.Supported {
		fmt.Printf("[RFC5780 Mapping]   %s\n", std.Mapping)
		fmt.Printf("[RFC5780 Filtering] %s\n", std.Filtering)
		fmt.Printf("[传统类型近似]       %s\n", legacyType(std.Mapping, std.Filtering))
	} else {
		fmt.Printf("[RFC5780] 未取得完整标准判定: %s\n", std.Reason)
	}

	fmt.Printf("\n[跨目标受控观测] 有效比较 %d 次：映射不变 %d，映射改变 %d，公网IP漂移 %d。\n",
		Evidence.CrossTargetCompared, Evidence.CrossTargetSame, Evidence.CrossTargetChanged, Evidence.PublicIPDrift)
	if Evidence.CrossTargetChanged > 0 {
		fmt.Printf("[端口分配] +1 递增 %d 次，其它跳变 %d 次。\n", Evidence.CrossTargetPlusOne, Evidence.CrossTargetOther)
	}

	// NAT4E 是项目自己的工程标签，不冒充 RFC 类型。
	if Evidence.CrossTargetChanged >= 2 && Evidence.CrossTargetPlusOne >= 2 &&
		Evidence.CrossTargetPlusOne*3 >= Evidence.CrossTargetChanged*2 {
		fmt.Println("[NAT4E-like] 多次受控跨目标映射出现稳定 +1 递增，存在明显的顺序端口分配特征。")
		fmt.Println("             这说明端口具有一定可预测性；P2P 是否能利用它仍取决于双方过滤行为、时序和运营商网络状态。")
	} else if Evidence.CrossTargetChanged > 0 {
		fmt.Println("[端口分配] 观察到目标相关映射变化，但不足以宣称 NAT4E/+1 顺序分配。")
	} else if Evidence.CrossTargetSame > 0 {
		fmt.Println("[端口分配] 受控跨目标观测保持同一映射，与 Endpoint-Independent Mapping 相符。")
	}

	if len(Evidence.Notes) > 0 {
		fmt.Println("\n[关键证据]")
		for _, n := range Evidence.Notes {
			fmt.Println("  -", n)
		}
	}
	fmt.Println("================================================================")
}

// ==========================================
// 启动署名与开屏动画
// ==========================================
func clearScreen() {
	if runtime.GOOS == "windows" {
		cmd := exec.Command("cmd", "/c", "cls")
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if cmd.Run() == nil {
			return
		}
	}
	fmt.Print("\033[2J\033[H")
}

func waitForAnyKey() {
	// Windows 的 pause 能真正做到“不必按回车的任意键继续”。
	if runtime.GOOS == "windows" {
		cmd := exec.Command("cmd", "/c", "pause >nul")
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if cmd.Run() == nil {
			return
		}
	}

	// 常见 Unix/类 Unix 终端：临时关闭 canonical/echo，只读取一个字节后恢复。
	// 这是运行时的最佳努力实现；缺少 /dev/tty、stty 或 sh 时会自动回退。
	if runtime.GOOS != "plan9" && runtime.GOOS != "js" && runtime.GOOS != "wasip1" {
		script := `old=$(stty -g < /dev/tty 2>/dev/null) || exit 1
trap 'stty "$old" < /dev/tty 2>/dev/null' EXIT INT TERM HUP
stty -echo -icanon min 1 time 0 < /dev/tty || exit 1
dd bs=1 count=1 < /dev/tty >/dev/null 2>&1
stty "$old" < /dev/tty 2>/dev/null
trap - EXIT INT TERM HUP`
		cmd := exec.Command("sh", "-c", script)
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if cmd.Run() == nil {
			return
		}
	}

	// 极少数终端/沙箱不允许切换终端模式时的兼容回退。
	// 在 canonical 终端中，这一路径可能需要按键后再按回车。
	reader := bufio.NewReader(os.Stdin)
	_, _ = reader.ReadByte()
}

func showSplash() {
	frames := []string{
		"BROTECH  ·",
		"BROTECH  ·  NAT",
		"BROTECH  ·  NAT FORENSICS",
		"BROTECH  ·  NAT FORENSICS  ·  长兄天工",
	}
	for _, frame := range frames {
		clearScreen()
		fmt.Println("===============================================================")
		fmt.Printf("                 %s\n", frame)
		fmt.Println("===============================================================")
		time.Sleep(85 * time.Millisecond)
	}

	clearScreen()
	fmt.Println("================================================================")
	fmt.Println("             BroTech · CGNAT 深度状态机探测系统")
	fmt.Println("================================================================")
	fmt.Println("作者 / Author:             哥哥科技")
	fmt.Println("Professional identification: 长兄天工")
	fmt.Println("URL:                       https://github.com/ucxn/BroTech")
	fmt.Println("格言:                      爱哥哥，也有个可爱的弟弟。")
	fmt.Println("----------------------------------------------------------------")
	fmt.Printf("Build target: %s/%s\n", runtime.GOOS, runtime.GOARCH)
	fmt.Println("本程序按 Attribution Assurance License（adapted）所要求的显著署名方式启动。")
	fmt.Println("================================================================")
	fmt.Print("按任意键进入 / Press any key to continue...")
	waitForAnyKey()
	clearScreen()
}

func main() {
	showSplash()

	fmt.Println("================================================================")
	fmt.Println("   The Ultimate Matrix: CGNAT 深度四维状态机探测系统 v4.1")
	fmt.Println("================================================================")
	fmt.Println("说明：RFC5780 负责标准 Mapping/Filtering；多服务器矩阵只负责观察运营商端口分配规律。")
	fmt.Println("----------------------------------------------------------------")

	// 1) 先做真正的 RFC5780 行为发现。它与后面的“跨不同公共 STUN 服务器比较”是两件事。
	std := findRFC5780Server()

	waitWithCountdown(5, "标准测试 -> 经验矩阵短隔离")

	// 2) 同一本地 socket、不同目标：观察目标敏感度及 NAT4E-like 顺序端口分配。
	fmt.Println("\n>>> [Phase 1] 同一本地端点 / 多目标映射矩阵")
	connA := getConn(42000)
	fmt.Println("\n【现代 STUN / RFC5389 报文】")
	runMappingSweep(connA, ProbeRFC5389, "P1-Modern")
	fmt.Println("\n【Legacy RFC3489 报文，仅作兼容/对照，不作为主分类依据】")
	runMappingSweep(connA, ProbeRFC3489, "P1-Legacy")
	connA.Close()

	// 3) 更换内网端口后重复，观察 CGNAT 端口分配器是否有跨会话规律。
	waitWithCountdown(WaitStandard, "Phase 1 -> Phase 2 会话隔离")
	fmt.Println("\n>>> [Phase 2] 新内网端点 / 多目标重复矩阵")
	for round, port := range []int{43000, 43001, 43002} {
		conn := getConn(port)
		fmt.Printf("\n【Round %d】本地端口 %d\n", round+1, port)
		runMappingSweep(conn, ProbeRFC5389, fmt.Sprintf("P2-R%d", round+1))
		conn.Close()
		if round < 2 {
			waitWithCountdown(WaitStandard, "跨会话静默")
		}
	}

	// 4) 长时静默后的同端口再分配观察。它不是 RFC5780 Binding Lifetime 的严格实现，
	// 因为严格 lifetime discovery 需要 RESPONSE-PORT 控制通道；这里明确只称“静默后重映射观察”。
	fmt.Println("\n>>> [Phase 3] 长时静默后的重映射观察")
	portC := 44000
	connC := getConn(portC)
	before6 := executeProbeWithRetry(connC, TargetServers[0], ProbeRFC5389)
	printProbe("P3-Pre-6Min", before6)
	waitWithCountdown(WaitMedium, "6 分钟静默")
	after6 := executeProbeWithRetry(connC, TargetServers[0], ProbeRFC5389)
	printProbe("P3-Post-6Min", after6)
	if before6.OK() && after6.OK() {
		if sameEndpoint(before6.PublicAddr, after6.PublicAddr) {
			fmt.Println("      [=] 6 分钟后重新发送时仍得到相同公网映射。")
		} else {
			fmt.Printf("      [~] 6 分钟后映射变化: %s -> %s\n", before6.PublicAddr, after6.PublicAddr)
		}
	}
	connC.Close()

	waitWithCountdown(WaitStandard, "6 分钟组 -> 10 分钟组隔离")
	portD := 45000
	connD := getConn(portD)
	before10 := executeProbeWithRetry(connD, TargetServers[0], ProbeRFC5389)
	printProbe("P3-Pre-10Min", before10)
	waitWithCountdown(WaitHard, "10 分钟静默")
	after10 := executeProbeWithRetry(connD, TargetServers[0], ProbeRFC5389)
	printProbe("P3-Post-10Min", after10)
	if before10.OK() && after10.OK() {
		if sameEndpoint(before10.PublicAddr, after10.PublicAddr) {
			fmt.Println("      [=] 10 分钟后重新发送时仍得到相同公网映射。")
		} else {
			fmt.Printf("      [~] 10 分钟后映射变化: %s -> %s\n", before10.PublicAddr, after10.PublicAddr)
		}
	}
	connD.Close()

	printFinalReport(std)
}
