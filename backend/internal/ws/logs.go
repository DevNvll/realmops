package ws

import (
	"bufio"
	"context"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"soar/internal/docker"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type LogStreamer struct {
	docker *docker.Provider
}

func NewLogStreamer(dockerProvider *docker.Provider) *LogStreamer {
	return &LogStreamer{docker: dockerProvider}
}

func (ls *LogStreamer) HandleWebSocket(w http.ResponseWriter, r *http.Request, containerID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				cancel()
				return
			}
		}
	}()

	logs, err := ls.docker.GetContainerLogs(ctx, containerID, "100", true)
	if err != nil {
		slog.Error("failed to get container logs", "error", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Error: "+err.Error()))
		return
	}
	defer logs.Close()

	reader := bufio.NewReader(logs)
	for {
		select {
		case <-ctx.Done():
			return
		default:
			line, err := reader.ReadBytes('\n')
			if err != nil {
				if err == io.EOF {
					time.Sleep(100 * time.Millisecond)
					continue
				}
				return
			}

			if len(line) > 8 {
				line = line[8:]
			}

			if err := conn.WriteMessage(websocket.TextMessage, line); err != nil {
				return
			}
		}
	}
}
