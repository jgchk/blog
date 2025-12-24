import { describe, it, expect } from 'vitest';

// We'll test argument parsing by importing it directly
// For now, we'll test the logic inline since parseArgs is not exported

describe('CLI Argument Parsing', () => {
  function parseArgs(args: string[]): {
    port?: number;
    noOpen?: boolean;
    help?: boolean;
    error?: string;
  } {
    const result: {
      port?: number;
      noOpen?: boolean;
      help?: boolean;
      error?: string;
    } = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--help' || arg === '-h') {
        result.help = true;
      } else if (arg === '--no-open') {
        result.noOpen = true;
      } else if (arg === '--port' || arg === '-p') {
        const nextArg = args[i + 1];
        if (!nextArg || nextArg.startsWith('-')) {
          result.error = 'Missing value for --port';
          break;
        }
        const port = parseInt(nextArg, 10);
        if (isNaN(port)) {
          result.error = `Invalid port: ${nextArg}. Port must be a number between 1024 and 65535.`;
          break;
        }
        result.port = port;
        i++;
      } else if (arg?.startsWith('-')) {
        result.error = `Unknown option: ${arg}`;
        break;
      }
    }

    return result;
  }

  it('should parse --port option', () => {
    const result = parseArgs(['--port', '8080']);
    expect(result.port).toBe(8080);
  });

  it('should parse -p short option', () => {
    const result = parseArgs(['-p', '3001']);
    expect(result.port).toBe(3001);
  });

  it('should parse --no-open option', () => {
    const result = parseArgs(['--no-open']);
    expect(result.noOpen).toBe(true);
  });

  it('should parse --help option', () => {
    const result = parseArgs(['--help']);
    expect(result.help).toBe(true);
  });

  it('should parse -h short option', () => {
    const result = parseArgs(['-h']);
    expect(result.help).toBe(true);
  });

  it('should combine multiple options', () => {
    const result = parseArgs(['-p', '4000', '--no-open']);
    expect(result.port).toBe(4000);
    expect(result.noOpen).toBe(true);
  });

  it('should error on missing port value', () => {
    const result = parseArgs(['--port']);
    expect(result.error).toContain('Missing value');
  });

  it('should error on invalid port value', () => {
    const result = parseArgs(['--port', 'abc']);
    expect(result.error).toContain('Invalid port');
  });

  it('should error on unknown option', () => {
    const result = parseArgs(['--unknown']);
    expect(result.error).toContain('Unknown option');
  });

  it('should return empty object for no args', () => {
    const result = parseArgs([]);
    expect(result.port).toBeUndefined();
    expect(result.noOpen).toBeUndefined();
    expect(result.help).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
});
