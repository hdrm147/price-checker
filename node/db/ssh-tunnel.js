/**
 * SSH Tunnel Support
 *
 * Creates SSH tunnels for remote database connections.
 * Supports both direct SSH config (host, port, key) and SSH config names (~/.ssh/config).
 *
 * Usage:
 *   const tunnel = await createTunnel({
 *     sshConfigName: 'cyber-server', // Use SSH config name
 *     // OR direct config:
 *     // sshHost: 'server.example.com',
 *     // sshPort: 22,
 *     // sshUser: 'user',
 *     // sshPrivateKey: '/path/to/key',
 *     localPort: 15432,         // Local port to bind
 *     remoteHost: 'localhost',  // Remote host from tunnel perspective
 *     remotePort: 5432,         // Remote port (PostgreSQL)
 *   });
 */
const { Client } = require('ssh2');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Parse SSH config file to get host configuration
 * @param {string} configName - Host name from ~/.ssh/config
 * @returns {object} SSH configuration
 */
function parseSSHConfig(configName) {
  const configPath = path.join(os.homedir(), '.ssh', 'config');

  if (!fs.existsSync(configPath)) {
    throw new Error(`SSH config file not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf8');
  const lines = content.split('\n');

  let currentHost = null;
  let config = {};
  const hosts = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // Match Host directive
    const hostMatch = trimmed.match(/^Host\s+(.+)$/i);
    if (hostMatch) {
      if (currentHost && Object.keys(config).length > 0) {
        hosts[currentHost] = config;
      }
      currentHost = hostMatch[1].trim();
      config = {};
      continue;
    }

    // Match key-value pairs
    const kvMatch = trimmed.match(/^(\w+)\s+(.+)$/);
    if (kvMatch && currentHost) {
      const key = kvMatch[1].toLowerCase();
      let value = kvMatch[2].trim();

      // Expand ~ in paths
      if (value.startsWith('~')) {
        value = path.join(os.homedir(), value.slice(1));
      }

      config[key] = value;
    }
  }

  // Don't forget the last host
  if (currentHost && Object.keys(config).length > 0) {
    hosts[currentHost] = config;
  }

  // Find matching host (supports wildcards)
  let matchedConfig = hosts[configName];

  if (!matchedConfig) {
    // Try wildcard matching
    for (const [pattern, cfg] of Object.entries(hosts)) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(configName)) {
          matchedConfig = cfg;
          break;
        }
      }
    }
  }

  if (!matchedConfig) {
    throw new Error(`SSH config host not found: ${configName}`);
  }

  return {
    host: matchedConfig.hostname || configName,
    port: parseInt(matchedConfig.port || '22', 10),
    username: matchedConfig.user || os.userInfo().username,
    privateKeyPath: matchedConfig.identityfile,
    proxyJump: matchedConfig.proxyjump,
  };
}

/**
 * Create an SSH tunnel
 * @param {object} options - Tunnel configuration
 * @returns {Promise<{tunnel: object, localPort: number, close: function}>}
 */
async function createTunnel(options) {
  const {
    // SSH connection options (direct)
    sshHost,
    sshPort = 22,
    sshUser,
    sshPassword,
    sshPrivateKey,
    sshPrivateKeyPath,
    sshPassphrase,
    // SSH config name (alternative to direct)
    sshConfigName,
    // Tunnel options
    localPort = 0, // 0 = auto-assign
    localHost = '127.0.0.1',
    remoteHost = 'localhost',
    remotePort,
    // Misc
    keepAlive = true,
    keepAliveInterval = 10000,
    readyTimeout = 30000,
  } = options;

  // Resolve SSH config
  let sshConfig = {};

  if (sshConfigName) {
    const parsed = parseSSHConfig(sshConfigName);
    sshConfig = {
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      privateKey: parsed.privateKeyPath ? fs.readFileSync(parsed.privateKeyPath) : undefined,
    };
    console.log(`[ssh-tunnel] Using SSH config: ${sshConfigName} -> ${sshConfig.host}:${sshConfig.port}`);
  } else {
    // Use direct config
    let privateKey = sshPrivateKey;
    if (!privateKey && sshPrivateKeyPath) {
      privateKey = fs.readFileSync(sshPrivateKeyPath);
    }

    sshConfig = {
      host: sshHost,
      port: sshPort,
      username: sshUser,
      password: sshPassword,
      privateKey,
      passphrase: sshPassphrase,
    };
  }

  return new Promise((resolve, reject) => {
    const sshClient = new Client();
    let server = null;
    let resolvedLocalPort = localPort;

    // Create local TCP server
    server = net.createServer((socket) => {
      sshClient.forwardOut(
        socket.remoteAddress || localHost,
        socket.remotePort || 0,
        remoteHost,
        remotePort,
        (err, stream) => {
          if (err) {
            console.error('[ssh-tunnel] Forward error:', err.message);
            socket.end();
            return;
          }

          socket.pipe(stream).pipe(socket);
        }
      );
    });

    server.on('error', (err) => {
      console.error('[ssh-tunnel] Server error:', err.message);
      sshClient.end();
      reject(err);
    });

    sshClient.on('ready', () => {
      server.listen(localPort, localHost, () => {
        resolvedLocalPort = server.address().port;
        console.log(`[ssh-tunnel] Tunnel established: ${localHost}:${resolvedLocalPort} -> ${remoteHost}:${remotePort}`);

        resolve({
          tunnel: sshClient,
          server,
          localPort: resolvedLocalPort,
          localHost,
          remoteHost,
          remotePort,
          close: () => {
            return new Promise((res) => {
              server.close(() => {
                sshClient.end();
                console.log('[ssh-tunnel] Tunnel closed');
                res();
              });
            });
          },
        });
      });
    });

    sshClient.on('error', (err) => {
      console.error('[ssh-tunnel] SSH error:', err.message);
      if (server) server.close();
      reject(err);
    });

    sshClient.on('close', () => {
      console.log('[ssh-tunnel] SSH connection closed');
      if (server) server.close();
    });

    // Connect
    sshClient.connect({
      ...sshConfig,
      keepaliveInterval: keepAlive ? keepAliveInterval : 0,
      readyTimeout,
    });
  });
}

/**
 * Create tunnels for both price server and main backend databases
 * @param {object} config - Full configuration object
 * @returns {Promise<{pricesTunnel?: object, mainTunnel?: object, close: function}>}
 */
async function createDatabaseTunnels(config) {
  const tunnels = {
    pricesTunnel: null,
    mainTunnel: null,
  };

  // Create tunnel for price server database (if SSH enabled)
  if (config.ssh?.enabled && config.ssh?.prices) {
    try {
      tunnels.pricesTunnel = await createTunnel({
        sshConfigName: config.ssh.prices.configName,
        sshHost: config.ssh.prices.host,
        sshPort: config.ssh.prices.port,
        sshUser: config.ssh.prices.user,
        sshPrivateKeyPath: config.ssh.prices.privateKeyPath,
        localPort: config.ssh.prices.localPort || 15432,
        remoteHost: config.ssh.prices.remoteHost || 'localhost',
        remotePort: config.ssh.prices.remotePort || config.postgres?.port || 5432,
      });

      // Update config to use tunnel
      config.postgres.host = tunnels.pricesTunnel.localHost;
      config.postgres.port = tunnels.pricesTunnel.localPort;
    } catch (err) {
      console.error('[ssh-tunnel] Failed to create prices tunnel:', err.message);
      throw err;
    }
  }

  // Create tunnel for main backend database (if SSH enabled)
  if (config.ssh?.enabled && config.ssh?.main) {
    try {
      tunnels.mainTunnel = await createTunnel({
        sshConfigName: config.ssh.main.configName,
        sshHost: config.ssh.main.host,
        sshPort: config.ssh.main.port,
        sshUser: config.ssh.main.user,
        sshPrivateKeyPath: config.ssh.main.privateKeyPath,
        localPort: config.ssh.main.localPort || 15433,
        remoteHost: config.ssh.main.remoteHost || 'localhost',
        remotePort: config.ssh.main.remotePort || config.mainDb?.port || 5432,
      });

      // Update config to use tunnel
      config.mainDb.host = tunnels.mainTunnel.localHost;
      config.mainDb.port = tunnels.mainTunnel.localPort;
    } catch (err) {
      console.error('[ssh-tunnel] Failed to create main tunnel:', err.message);
      // Close prices tunnel if main fails
      if (tunnels.pricesTunnel) {
        await tunnels.pricesTunnel.close();
      }
      throw err;
    }
  }

  tunnels.close = async () => {
    if (tunnels.pricesTunnel) {
      await tunnels.pricesTunnel.close();
    }
    if (tunnels.mainTunnel) {
      await tunnels.mainTunnel.close();
    }
  };

  return tunnels;
}

module.exports = {
  createTunnel,
  createDatabaseTunnels,
  parseSSHConfig,
};
