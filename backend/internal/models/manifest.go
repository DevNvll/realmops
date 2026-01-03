package models

type Manifest struct {
	ID          string           `yaml:"id" json:"id"`
	Name        string           `yaml:"name" json:"name"`
	Version     string           `yaml:"version" json:"version"`
	Description string           `yaml:"description" json:"description"`
	Runtime     RuntimeConfig    `yaml:"runtime" json:"runtime"`
	Storage     StorageConfig    `yaml:"storage" json:"storage"`
	Variables   []VariableConfig `yaml:"variables" json:"variables"`
	Install     InstallConfig    `yaml:"install" json:"install"`
	Config      ConfigRendering  `yaml:"config" json:"config"`
	Ports       []PortConfig     `yaml:"ports" json:"ports"`
	Start       StartConfig      `yaml:"start" json:"start"`
	Health      HealthConfig     `yaml:"health" json:"health"`
	Shutdown    ShutdownConfig   `yaml:"shutdown" json:"shutdown"`
	Mods        ModsConfig       `yaml:"mods" json:"mods"`
	RCON        RCONConfig       `yaml:"rcon" json:"rcon"`
}

type RCONConfig struct {
	Enabled          bool   `yaml:"enabled" json:"enabled"`
	PortName         string `yaml:"portName" json:"portName"`
	PasswordVariable string `yaml:"passwordVariable" json:"passwordVariable"`
}

type RuntimeConfig struct {
	Image      string            `yaml:"image" json:"image"`
	Workdir    string            `yaml:"workdir" json:"workdir"`
	User       string            `yaml:"user" json:"user"`
	Env        map[string]string `yaml:"env" json:"env"`
	Entrypoint []string          `yaml:"entrypoint" json:"entrypoint"`
}

type StorageConfig struct {
	MountPath string `yaml:"mountPath" json:"mountPath"`
}

type VariableConfig struct {
	Name        string   `yaml:"name" json:"name"`
	Label       string   `yaml:"label" json:"label"`
	Description string   `yaml:"description" json:"description"`
	Type        string   `yaml:"type" json:"type"` // string, number, boolean, select
	Default     any      `yaml:"default" json:"default"`
	Required    bool     `yaml:"required" json:"required"`
	Options     []string `yaml:"options" json:"options"` // for select type
	Min         *int     `yaml:"min" json:"min"`         // for number type
	Max         *int     `yaml:"max" json:"max"`         // for number type
}

type InstallConfig struct {
	Method   string `yaml:"method" json:"method"` // none, download, steamcmd
	URL      string `yaml:"url" json:"url"`       // for download method
	Dest     string `yaml:"dest" json:"dest"`     // destination path for download
	Checksum string `yaml:"checksum" json:"checksum"`
	AppID    int    `yaml:"appId" json:"appId"` // for steamcmd method
	Branch   string `yaml:"branch" json:"branch"`
}

type ConfigRendering struct {
	Templates []TemplateConfig `yaml:"templates" json:"templates"`
	EnvVars   []EnvVarConfig   `yaml:"envVars" json:"envVars"`
}

type TemplateConfig struct {
	Source      string `yaml:"source" json:"source"`
	Destination string `yaml:"destination" json:"destination"`
}

type EnvVarConfig struct {
	Name     string `yaml:"name" json:"name"`
	Value    string `yaml:"value" json:"value"`
	Template bool   `yaml:"template" json:"template"`
}

type PortConfig struct {
	Name          string `yaml:"name" json:"name"`
	ContainerPort int    `yaml:"containerPort" json:"containerPort"`
	Protocol      string `yaml:"protocol" json:"protocol"` // tcp, udp
	HostPortMode  string `yaml:"hostPortMode" json:"hostPortMode"` // auto, user
	Description   string `yaml:"description" json:"description"`
}

type StartConfig struct {
	Command []string `yaml:"command" json:"command"`
}

type HealthConfig struct {
	Type        string `yaml:"type" json:"type"` // tcp, udp, process, http
	Port        int    `yaml:"port" json:"port"`
	Path        string `yaml:"path" json:"path"` // for http
	GracePeriod int    `yaml:"gracePeriod" json:"gracePeriod"` // seconds
	Interval    int    `yaml:"interval" json:"interval"`       // seconds
	Timeout     int    `yaml:"timeout" json:"timeout"`         // seconds
	Retries     int    `yaml:"retries" json:"retries"`
}

type ShutdownConfig struct {
	Signal  string `yaml:"signal" json:"signal"` // SIGTERM, SIGINT, etc.
	Timeout int    `yaml:"timeout" json:"timeout"` // seconds
}

type ModsConfig struct {
	Enabled               bool        `yaml:"enabled" json:"enabled"`
	Targets               []ModTarget `yaml:"targets" json:"targets"`
	ApplyWhileRunning     bool        `yaml:"applyWhileRunning" json:"applyWhileRunning"`
}

type ModTarget struct {
	Name     string `yaml:"name" json:"name"`
	Path     string `yaml:"path" json:"path"`
	Behavior string `yaml:"behavior" json:"behavior"` // merge, clean-then-merge, replace
}
