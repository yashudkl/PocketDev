import type { PtyClientMessage, PtyServerMessage, StartSessionResponse } from '@pocketdev/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getApiBaseUrl } from '@/api/axios';
import { jobsApi, sessionsApi } from '@/api/pocketdev';
import { getErrorMessage } from '@/utils/errors';
import { interactivePtyStart, plainTerminalText, terminalCommandInput } from '@/utils/terminal';

export type TerminalPhase =
  | 'idle'
  | 'creating'
  | 'connecting'
  | 'waiting'
  | 'ready'
  | 'stopping'
  | 'exited'
  | 'error'
  | 'disconnected';

const MAX_OUTPUT_CHARS = 300_000;
const CONNECTION_TIMEOUT_MS = 15_000;

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * The API's local-dev default is ws://localhost:4100. That works when the
 * client also runs on the development computer, but localhost on a physical
 * phone is the phone itself. When the configured API is reached through a LAN
 * address, reuse that host for a loopback worker URL while preserving its
 * protocol, port, path, and query string.
 */
export function normalizeWebSocketUrl(url: string, apiBaseUrl = getApiBaseUrl()): string {
  if (url.startsWith('/') && apiBaseUrl) {
    try {
      const api = new URL(apiBaseUrl);
      api.protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
      return new URL(url, api).toString();
    } catch {
      return url;
    }
  }

  const websocketUrl = url.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');

  if (!apiBaseUrl) return websocketUrl;

  try {
    const socket = new URL(websocketUrl);
    const api = new URL(apiBaseUrl);
    if (isLoopbackHost(socket.hostname) && !isLoopbackHost(api.hostname)) {
      socket.hostname = api.hostname;
      return socket.toString();
    }
  } catch {
    // Let React Native surface the original malformed URL through onerror.
  }

  return websocketUrl;
}

export function useTerminalSession(projectId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const launchRef = useRef<StartSessionResponse | null>(null);
  const endingRef = useRef(false);
  const sizeRef = useRef({ cols: 80, rows: 24 });
  const [phase, setPhase] = useState<TerminalPhase>('idle');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [lastCommand, setLastCommand] = useState('');
  const [launch, setLaunch] = useState<StartSessionResponse | null>(null);

  const append = useCallback((chunk: string) => {
    setOutput((current) => {
      const next = plainTerminalText(current + chunk);
      return next.length > MAX_OUTPUT_CHARS ? next.slice(-MAX_OUTPUT_CHARS) : next;
    });
  }, []);

  const send = useCallback((message: PtyClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const cancelInBackground = useCallback(() => {
    const currentLaunch = launchRef.current;
    const socket = socketRef.current;
    launchRef.current = null;
    socketRef.current = null;
    endingRef.current = true;

    if (!currentLaunch) {
      socket?.close();
      return;
    }

    void sessionsApi
      .close(currentLaunch.sessionId)
      .catch(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          const killMessage: PtyClientMessage = {
            type: 'kill',
            sessionId: currentLaunch.sessionId,
          };
          socket.send(JSON.stringify(killMessage));
        }
      })
      .finally(() => socket?.close());
  }, []);

  const start = useCallback(
    async (command: string) => {
      const normalizedCommand = command.trim();
      if (!normalizedCommand || phase === 'creating' || phase === 'connecting') return;

      socketRef.current?.close();
      endingRef.current = false;
      setOutput('');
      setError(null);
      setExitCode(null);
      setLaunch(null);
      setPhase('creating');
      setLastCommand(normalizedCommand);

      try {
        const response = await jobsApi.start(projectId, normalizedCommand);
        launchRef.current = response;
        setLaunch(response);
        setPhase('connecting');
        const socket = new WebSocket(normalizeWebSocketUrl(response.wsUrl));
        socketRef.current = socket;
        let initialCommandSent = false;
        const connectionTimer = setTimeout(() => {
          if (socketRef.current !== socket || endingRef.current) return;
          setError('The desktop terminal did not respond within 15 seconds.');
          setPhase('error');
          socket.close();
        }, CONNECTION_TIMEOUT_MS);

        socket.onopen = () => {
          if (socketRef.current !== socket) return;
          setPhase('waiting');
          const message = interactivePtyStart({
            sessionId: response.sessionId,
            projectId,
            token: response.wsToken,
            cols: sizeRef.current.cols,
            rows: sizeRef.current.rows,
          });
          socket.send(JSON.stringify(message));
        };

        socket.onmessage = (event) => {
          if (socketRef.current !== socket) return;
          let message: PtyServerMessage;
          try {
            message = JSON.parse(String(event.data)) as PtyServerMessage;
          } catch {
            return;
          }
          if (message.sessionId !== response.sessionId) return;
          if (message.type === 'ready') {
            clearTimeout(connectionTimer);
            setPhase('ready');
            if (!initialCommandSent) {
              initialCommandSent = true;
              const inputMessage: PtyClientMessage = {
                type: 'input',
                sessionId: response.sessionId,
                data: terminalCommandInput(normalizedCommand),
              };
              socket.send(JSON.stringify(inputMessage));
            }
          } else if (message.type === 'data') {
            clearTimeout(connectionTimer);
            append(message.data);
          } else if (message.type === 'exit') {
            clearTimeout(connectionTimer);
            launchRef.current = null;
            setExitCode(message.exitCode);
            setPhase('exited');
          } else if (message.type === 'error') {
            clearTimeout(connectionTimer);
            setError(message.message);
            setPhase('error');
          }
        };

        socket.onerror = () => {
          if (socketRef.current !== socket || endingRef.current) return;
          clearTimeout(connectionTimer);
          setError('The terminal WebSocket could not connect.');
          setPhase('error');
        };

        socket.onclose = () => {
          clearTimeout(connectionTimer);
          if (socketRef.current !== socket) return;
          socketRef.current = null;
          if (endingRef.current) {
            setPhase((current) => (current === 'exited' ? current : 'exited'));
            return;
          }
          if (launchRef.current?.sessionId === response.sessionId) {
            launchRef.current = null;
            void sessionsApi.close(response.sessionId).catch(() => undefined);
          }
          setPhase((current) => {
            if (current === 'exited' || current === 'error') return current;
            setError('Connection closed. PocketDev sessions cannot be reattached yet.');
            return 'disconnected';
          });
        };
      } catch (startError) {
        cancelInBackground();
        setError(getErrorMessage(startError, 'Could not start the terminal session.'));
        setPhase('error');
      }
    },
    [append, cancelInBackground, phase, projectId],
  );

  const sendInput = useCallback(
    (data: string) => {
      const currentLaunch = launchRef.current;
      if (!currentLaunch) return;
      if (data.endsWith('\r')) {
        const submittedCommand = data.slice(0, -1).trim();
        if (submittedCommand) setLastCommand(submittedCommand);
      }
      send({ type: 'input', sessionId: currentLaunch.sessionId, data });
    },
    [send],
  );

  const resize = useCallback(
    (cols: number, rows: number) => {
      const next = {
        cols: Math.max(20, Math.floor(cols)),
        rows: Math.max(5, Math.floor(rows)),
      };
      sizeRef.current = next;
      const currentLaunch = launchRef.current;
      if (!currentLaunch) return;
      send({
        type: 'resize',
        sessionId: currentLaunch.sessionId,
        cols: next.cols,
        rows: next.rows,
      });
    },
    [send],
  );

  const stop = useCallback(async () => {
    const currentLaunch = launchRef.current;
    if (!currentLaunch) return;
    const socket = socketRef.current;
    endingRef.current = true;
    launchRef.current = null;
    socketRef.current = null;
    setPhase('stopping');
    try {
      await sessionsApi.close(currentLaunch.sessionId);
    } catch {
      // Fall back to the live socket if the API could not close the session.
      if (socket?.readyState === WebSocket.OPEN) {
        const killMessage: PtyClientMessage = {
          type: 'kill',
          sessionId: currentLaunch.sessionId,
        };
        socket.send(JSON.stringify(killMessage));
      }
    } finally {
      socket?.close();
      setPhase('exited');
    }
  }, []);

  const reset = useCallback(() => {
    cancelInBackground();
    setLaunch(null);
    setOutput('');
    setError(null);
    setExitCode(null);
    setLastCommand('');
    setPhase('idle');
  }, [cancelInBackground]);

  useEffect(
    () => () => {
      cancelInBackground();
    },
    [cancelInBackground],
  );

  return {
    phase,
    output,
    error,
    exitCode,
    lastCommand,
    launch,
    start,
    sendInput,
    resize,
    stop,
    reset,
  };
}
