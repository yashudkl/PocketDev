import type { PtyClientMessage, PtyServerMessage, StartSessionResponse } from '@pocketdev/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { jobsApi, sessionsApi } from '@/api/pocketdev';
import { getErrorMessage } from '@/utils/errors';

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

function normalizeWebSocketUrl(url: string): string {
  if (url.startsWith('https://')) return `wss://${url.slice(8)}`;
  if (url.startsWith('http://')) return `ws://${url.slice(7)}`;
  return url;
}

export function useTerminalSession(projectId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const launchRef = useRef<StartSessionResponse | null>(null);
  const commandRef = useRef('');
  const endingRef = useRef(false);
  const sizeRef = useRef({ cols: 80, rows: 24 });
  const [phase, setPhase] = useState<TerminalPhase>('idle');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [launch, setLaunch] = useState<StartSessionResponse | null>(null);

  const append = useCallback((chunk: string) => {
    setOutput((current) => {
      const next = current + chunk;
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
      commandRef.current = normalizedCommand;

      try {
        const response = await jobsApi.start(projectId, normalizedCommand);
        launchRef.current = response;
        setLaunch(response);
        setPhase('connecting');
        const socket = new WebSocket(normalizeWebSocketUrl(response.wsUrl));
        socketRef.current = socket;

        socket.onopen = () => {
          if (socketRef.current !== socket) return;
          setPhase('waiting');
          const message: PtyClientMessage = {
            type: 'start',
            sessionId: response.sessionId,
            projectId,
            command: normalizedCommand,
            token: response.wsToken,
            cols: sizeRef.current.cols,
            rows: sizeRef.current.rows,
          };
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
            setPhase('ready');
          } else if (message.type === 'data') {
            append(message.data);
          } else if (message.type === 'exit') {
            launchRef.current = null;
            setExitCode(message.exitCode);
            setPhase('exited');
          } else if (message.type === 'error') {
            setError(message.message);
            setPhase('error');
          }
        };

        socket.onerror = () => {
          if (socketRef.current !== socket || endingRef.current) return;
          setError('The terminal WebSocket could not connect.');
          setPhase('error');
        };

        socket.onclose = () => {
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
    commandRef.current = '';
    setLaunch(null);
    setOutput('');
    setError(null);
    setExitCode(null);
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
    launch,
    start,
    sendInput,
    resize,
    stop,
    reset,
  };
}
