package ports

import (
	"errors"
	"sync"

	"soar/internal/db"
)

type Allocator struct {
	db         *db.DB
	rangeStart int
	rangeEnd   int
	mu         sync.Mutex
}

func NewAllocator(database *db.DB, rangeStart, rangeEnd int) *Allocator {
	return &Allocator{
		db:         database,
		rangeStart: rangeStart,
		rangeEnd:   rangeEnd,
	}
}

func (a *Allocator) AllocatePorts(serverID string, count int) ([]int, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	reserved, err := a.getReservedPorts()
	if err != nil {
		return nil, err
	}

	reservedSet := make(map[int]bool)
	for _, p := range reserved {
		reservedSet[p] = true
	}

	var allocated []int
	for port := a.rangeStart; port <= a.rangeEnd && len(allocated) < count; port++ {
		if !reservedSet[port] {
			allocated = append(allocated, port)
		}
	}

	if len(allocated) < count {
		return nil, errors.New("not enough ports available")
	}

	for _, port := range allocated {
		_, err := a.db.Exec(
			"INSERT INTO port_reservations (host_port, server_id) VALUES (?, ?)",
			port, serverID,
		)
		if err != nil {
			a.rollbackAllocations(serverID)
			return nil, err
		}
	}

	return allocated, nil
}

func (a *Allocator) AllocateSpecificPort(serverID string, port int) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if port < a.rangeStart || port > a.rangeEnd {
		return errors.New("port outside allowed range")
	}

	var count int
	err := a.db.QueryRow("SELECT COUNT(*) FROM port_reservations WHERE host_port = ?", port).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return errors.New("port already reserved")
	}

	_, err = a.db.Exec(
		"INSERT INTO port_reservations (host_port, server_id) VALUES (?, ?)",
		port, serverID,
	)
	return err
}

func (a *Allocator) ReleasePorts(serverID string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	_, err := a.db.Exec("DELETE FROM port_reservations WHERE server_id = ?", serverID)
	return err
}

func (a *Allocator) GetServerPorts(serverID string) ([]int, error) {
	rows, err := a.db.Query("SELECT host_port FROM port_reservations WHERE server_id = ? ORDER BY host_port", serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ports []int
	for rows.Next() {
		var port int
		if err := rows.Scan(&port); err != nil {
			return nil, err
		}
		ports = append(ports, port)
	}
	return ports, rows.Err()
}

func (a *Allocator) IsPortAvailable(port int) (bool, error) {
	if port < a.rangeStart || port > a.rangeEnd {
		return false, nil
	}

	var count int
	err := a.db.QueryRow("SELECT COUNT(*) FROM port_reservations WHERE host_port = ?", port).Scan(&count)
	if err != nil {
		return false, err
	}
	return count == 0, nil
}

func (a *Allocator) getReservedPorts() ([]int, error) {
	rows, err := a.db.Query("SELECT host_port FROM port_reservations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ports []int
	for rows.Next() {
		var port int
		if err := rows.Scan(&port); err != nil {
			return nil, err
		}
		ports = append(ports, port)
	}
	return ports, rows.Err()
}

func (a *Allocator) rollbackAllocations(serverID string) {
	a.db.Exec("DELETE FROM port_reservations WHERE server_id = ?", serverID)
}
