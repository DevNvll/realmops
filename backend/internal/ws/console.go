package ws

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"realmops/internal/models"
	"realmops/internal/packs"
	"realmops/internal/rcon"
)

type ConsoleMessage struct {
	Type    string `json:"type"`    // "command"
	Payload string `json:"payload"` // command text
}

type ConsoleResponse struct {
	Type    string `json:"type"`    // "response", "error", "status"
	Payload string `json:"payload"`
	Time    string `json:"time"`
}

type ConsoleHandler struct {
	packLoader  *packs.Loader
	rconManager *rcon.Manager
}

func NewConsoleHandler(packLoader *packs.Loader, rconManager *rcon.Manager) *ConsoleHandler {
	return &ConsoleHandler{
		packLoader:  packLoader,
		rconManager: rconManager,
	}
}

func (ch *ConsoleHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request, server *models.Server) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	// Load pack manifest to get RCON config
	manifest, err := ch.packLoader.LoadFromDir(ch.packLoader.GetPackPath(server.PackID))
	if err != nil {
		ch.sendError(conn, "failed to load pack manifest")
		return
	}

	if !manifest.RCON.Enabled {
		ch.sendError(conn, "RCON is not enabled for this server type")
		return
	}

	// Find RCON port mapping
	var rconPort int
	for _, port := range server.Ports {
		if port.Name == manifest.RCON.PortName {
			rconPort = port.HostPort
			break
		}
	}

	if rconPort == 0 {
		ch.sendError(conn, "RCON port not found")
		return
	}

	// Get RCON password from server variables
	password := ""
	if passVar, ok := server.Vars[manifest.RCON.PasswordVariable]; ok {
		password, _ = passVar.(string)
	}

	if password == "" {
		ch.sendError(conn, "RCON password not configured")
		return
	}

	// Connect to RCON
	ch.sendStatus(conn, "connecting")

	err = ch.rconManager.Connect(server.ID, "127.0.0.1", rconPort, password)
	if err != nil {
		ch.sendError(conn, "failed to connect to RCON: "+err.Error())
		return
	}
	defer ch.rconManager.Disconnect(server.ID)

	ch.sendStatus(conn, "connected")

	// Handle bidirectional communication
	var wsMu sync.Mutex

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Error("websocket read error", "error", err)
			}
			return
		}

		var msg ConsoleMessage
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			ch.sendErrorSync(conn, &wsMu, "invalid message format")
			continue
		}

		switch msg.Type {
		case "command":
			if msg.Payload == "" {
				continue
			}

			response, err := ch.rconManager.Execute(server.ID, msg.Payload)
			if err != nil {
				ch.sendErrorSync(conn, &wsMu, "command failed: "+err.Error())
				// Try to reconnect
				if err := ch.rconManager.Connect(server.ID, "127.0.0.1", rconPort, password); err != nil {
					ch.sendErrorSync(conn, &wsMu, "reconnection failed, please refresh")
					return
				}
				ch.sendStatusSync(conn, &wsMu, "reconnected")
				continue
			}

			ch.sendResponseSync(conn, &wsMu, response)

		default:
			ch.sendErrorSync(conn, &wsMu, "unknown message type")
		}
	}
}

func (ch *ConsoleHandler) sendStatus(conn *websocket.Conn, status string) {
	resp := ConsoleResponse{
		Type:    "status",
		Payload: status,
		Time:    time.Now().Format(time.RFC3339),
	}
	data, _ := json.Marshal(resp)
	conn.WriteMessage(websocket.TextMessage, data)
}

func (ch *ConsoleHandler) sendError(conn *websocket.Conn, message string) {
	resp := ConsoleResponse{
		Type:    "error",
		Payload: message,
		Time:    time.Now().Format(time.RFC3339),
	}
	data, _ := json.Marshal(resp)
	conn.WriteMessage(websocket.TextMessage, data)
}

func (ch *ConsoleHandler) sendStatusSync(conn *websocket.Conn, mu *sync.Mutex, status string) {
	mu.Lock()
	defer mu.Unlock()
	ch.sendStatus(conn, status)
}

func (ch *ConsoleHandler) sendErrorSync(conn *websocket.Conn, mu *sync.Mutex, message string) {
	mu.Lock()
	defer mu.Unlock()
	ch.sendError(conn, message)
}

func (ch *ConsoleHandler) sendResponseSync(conn *websocket.Conn, mu *sync.Mutex, response string) {
	mu.Lock()
	defer mu.Unlock()

	resp := ConsoleResponse{
		Type:    "response",
		Payload: response,
		Time:    time.Now().Format(time.RFC3339),
	}
	data, _ := json.Marshal(resp)
	conn.WriteMessage(websocket.TextMessage, data)
}
