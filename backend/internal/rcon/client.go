package rcon

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

const (
	PacketTypeResponse     int32 = 0
	PacketTypeExecCommand  int32 = 2
	PacketTypeAuthResponse int32 = 2
	PacketTypeAuth         int32 = 3

	MaxPacketSize     = 4096
	AuthFailedID      = -1
	DefaultTimeout    = 10 * time.Second
	DefaultReadBuffer = 4096
)

var (
	ErrAuthFailed     = errors.New("rcon authentication failed")
	ErrNotConnected   = errors.New("not connected to rcon server")
	ErrPacketTooLarge = errors.New("packet too large")
	ErrInvalidPacket  = errors.New("invalid packet received")
)

type Client struct {
	conn      net.Conn
	host      string
	port      int
	password  string
	requestID atomic.Int32
	mu        sync.Mutex
	connected bool
}

type Packet struct {
	Length    int32
	RequestID int32
	Type      int32
	Body      string
}

func NewClient(host string, port int, password string) *Client {
	return &Client{
		host:     host,
		port:     port,
		password: password,
	}
}

func (c *Client) Connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.connected {
		return nil
	}

	addr := fmt.Sprintf("%s:%d", c.host, c.port)
	conn, err := net.DialTimeout("tcp", addr, DefaultTimeout)
	if err != nil {
		return fmt.Errorf("failed to connect to rcon: %w", err)
	}

	c.conn = conn
	c.connected = true

	if err := c.authenticateInternal(); err != nil {
		c.conn.Close()
		c.connected = false
		return err
	}

	return nil
}

func (c *Client) authenticateInternal() error {
	id := c.nextRequestID()
	packet := &Packet{
		RequestID: id,
		Type:      PacketTypeAuth,
		Body:      c.password,
	}

	if err := c.writePacketInternal(packet); err != nil {
		return fmt.Errorf("failed to send auth packet: %w", err)
	}

	response, err := c.readPacketInternal()
	if err != nil {
		return fmt.Errorf("failed to read auth response: %w", err)
	}

	if response.RequestID == AuthFailedID {
		return ErrAuthFailed
	}

	return nil
}

func (c *Client) Execute(command string) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected {
		return "", ErrNotConnected
	}

	id := c.nextRequestID()
	packet := &Packet{
		RequestID: id,
		Type:      PacketTypeExecCommand,
		Body:      command,
	}

	if err := c.writePacketInternal(packet); err != nil {
		return "", fmt.Errorf("failed to send command: %w", err)
	}

	response, err := c.readPacketInternal()
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	return response.Body, nil
}

func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected {
		return nil
	}

	c.connected = false
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *Client) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected
}

func (c *Client) nextRequestID() int32 {
	return c.requestID.Add(1)
}

func (c *Client) writePacketInternal(p *Packet) error {
	bodyBytes := []byte(p.Body)
	p.Length = int32(4 + 4 + len(bodyBytes) + 2)

	if p.Length > MaxPacketSize {
		return ErrPacketTooLarge
	}

	buf := new(bytes.Buffer)

	if err := binary.Write(buf, binary.LittleEndian, p.Length); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.LittleEndian, p.RequestID); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.LittleEndian, p.Type); err != nil {
		return err
	}
	buf.Write(bodyBytes)
	buf.WriteByte(0)
	buf.WriteByte(0)

	c.conn.SetWriteDeadline(time.Now().Add(DefaultTimeout))
	_, err := c.conn.Write(buf.Bytes())
	return err
}

func (c *Client) readPacketInternal() (*Packet, error) {
	c.conn.SetReadDeadline(time.Now().Add(DefaultTimeout))

	var length int32
	if err := binary.Read(c.conn, binary.LittleEndian, &length); err != nil {
		return nil, err
	}

	if length < 10 || length > MaxPacketSize {
		return nil, ErrInvalidPacket
	}

	data := make([]byte, length)
	if _, err := io.ReadFull(c.conn, data); err != nil {
		return nil, err
	}

	packet := &Packet{
		Length:    length,
		RequestID: int32(binary.LittleEndian.Uint32(data[0:4])),
		Type:      int32(binary.LittleEndian.Uint32(data[4:8])),
	}

	bodyEnd := len(data) - 2
	if bodyEnd > 8 {
		packet.Body = string(data[8:bodyEnd])
	}

	return packet, nil
}
