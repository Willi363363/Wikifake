import { baseConfig } from '@wikifake/config/vitest';

// The transport tests open a real server on a real port and connect a real
// client to it: a WebSocket handshake mocked against a fake is a fake tested
// against a fake, and the guarantees of C5 are all about what happens on the
// wire. Ports are picked by the OS, so files may run in parallel.
export default baseConfig;
