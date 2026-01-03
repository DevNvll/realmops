package rcon

import (
	"fmt"
	"sync"
)

type Manager struct {
	connections map[string]*Client
	mu          sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{
		connections: make(map[string]*Client),
	}
}

func (m *Manager) Connect(serverID, host string, port int, password string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, ok := m.connections[serverID]; ok {
		if existing.IsConnected() {
			return nil
		}
		existing.Close()
		delete(m.connections, serverID)
	}

	client := NewClient(host, port, password)
	if err := client.Connect(); err != nil {
		return fmt.Errorf("failed to connect to rcon: %w", err)
	}

	m.connections[serverID] = client
	return nil
}

func (m *Manager) Disconnect(serverID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if client, ok := m.connections[serverID]; ok {
		err := client.Close()
		delete(m.connections, serverID)
		return err
	}
	return nil
}

func (m *Manager) Execute(serverID, command string) (string, error) {
	m.mu.RLock()
	client, ok := m.connections[serverID]
	m.mu.RUnlock()

	if !ok {
		return "", ErrNotConnected
	}

	return client.Execute(command)
}

func (m *Manager) IsConnected(serverID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if client, ok := m.connections[serverID]; ok {
		return client.IsConnected()
	}
	return false
}

func (m *Manager) GetConnection(serverID string) (*Client, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	client, ok := m.connections[serverID]
	return client, ok
}

func (m *Manager) DisconnectAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, client := range m.connections {
		client.Close()
		delete(m.connections, id)
	}
}
