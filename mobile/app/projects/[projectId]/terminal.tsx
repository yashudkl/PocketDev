import { useKeepAwake } from 'expo-keep-awake';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { jobsApi, projectsApi } from '@/api/pocketdev';
import { ExplanationModal } from '@/components/assistant/ExplanationModal';
import { TerminalInput } from '@/components/terminal/TerminalInput';
import { TerminalOutput } from '@/components/terminal/TerminalOutput';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useTerminalSession, type TerminalPhase } from '@/hooks/useTerminalSession';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

const phaseLabel: Record<TerminalPhase, string> = {
  idle: 'Ready',
  creating: 'Creating',
  connecting: 'Connecting',
  waiting: 'Waiting for worker',
  ready: 'Live',
  stopping: 'Stopping',
  exited: 'Exited',
  error: 'Error',
  disconnected: 'Disconnected',
};

const phaseTone: Record<TerminalPhase, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  idle: 'neutral',
  creating: 'primary',
  connecting: 'primary',
  waiting: 'warning',
  ready: 'success',
  stopping: 'warning',
  exited: 'neutral',
  error: 'danger',
  disconnected: 'danger',
};

export default function TerminalScreen() {
  useKeepAwake();
  const params = useLocalSearchParams<{
    projectId: string;
    command?: string;
    autorun?: string;
  }>();
  const projectId = param(params.projectId);
  const initialCommand = param(params.command) || 'npm run';
  const [command, setCommand] = useState(initialCommand);
  const [explanationRequest, setExplanationRequest] = useState<{
    command: string;
    output: string;
    exitCode?: number;
  } | null>(null);
  const autoStarted = useRef(false);
  const outputRef = useRef<ScrollView>(null);
  const terminal = useTerminalSession(projectId);
  const active = ['creating', 'connecting', 'waiting', 'ready', 'stopping'].includes(
    terminal.phase,
  );

  const projectQuery = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const jobQuery = useQuery({
    queryKey: ['jobs', terminal.launch?.jobId],
    queryFn: () => jobsApi.get(terminal.launch!.jobId),
    enabled: Boolean(terminal.launch?.jobId),
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return active || status === 'QUEUED' || status === 'RUNNING' ? 2_000 : false;
    },
  });

  useEffect(() => {
    if (param(params.autorun) === '1' && !autoStarted.current && initialCommand.trim()) {
      autoStarted.current = true;
      void terminal.start(initialCommand);
    }
  }, [initialCommand, params.autorun, terminal]);

  useEffect(() => {
    if (terminal.output) {
      requestAnimationFrame(() => outputRef.current?.scrollToEnd({ animated: false }));
    }
  }, [terminal.output]);

  const displayedJobStatus =
    terminal.phase === 'exited'
      ? terminal.exitCode === null
        ? 'CANCELED'
        : terminal.exitCode === 0
          ? 'SUCCEEDED'
          : 'FAILED'
      : jobQuery.data?.status;
  const sessionDirectory = terminal.launch
    ? terminal.launch.target === 'DESKTOP'
      ? (projectQuery.data?.desktopPath ?? 'Connected desktop project')
      : '/workspace'
    : null;
  const explainCurrentOutput = () => {
    if (!terminal.output.trim()) return;
    setExplanationRequest({
      command: terminal.lastCommand || command,
      output: terminal.output,
      exitCode: terminal.exitCode ?? undefined,
    });
  };

  return (
    <Screen keyboard edges={['top', 'left', 'right', 'bottom']}>
      <AppHeader
        title="Terminal"
        subtitle={projectQuery.data?.name}
        back
        right={<Badge label={phaseLabel[terminal.phase]} tone={phaseTone[terminal.phase]} dot />}
      />

      {terminal.phase === 'idle' ? (
        <View className="gap-4 px-5 py-5">
          <View>
            <AppText variant="title">Run anything</AppText>
            <AppText variant="caption" className="mt-1 leading-5">
              Starts an interactive shell on your desktop or the cloud, runs this first command, and
              keeps the terminal open for the next command.
            </AppText>
          </View>
          <Input
            label="Command"
            value={command}
            onChangeText={setCommand}
            autoCapitalize="none"
            autoCorrect={false}
            className="font-mono"
            returnKeyType="go"
            onSubmitEditing={() => void terminal.start(command)}
          />
          <View className="flex-row flex-wrap gap-2">
            {['npm run', 'npm test', 'git status', 'node --version'].map((preset) => (
              <AppText
                key={preset}
                onPress={() => setCommand(preset)}
                variant="mono"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300"
              >
                {preset}
              </AppText>
            ))}
          </View>
          <Button
            label="Start session"
            icon="play"
            size="lg"
            fullWidth
            disabled={!command.trim()}
            onPress={() => void terminal.start(command)}
          />
        </View>
      ) : (
        <>
          <View className="flex-row items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2">
            <View className="min-w-0 flex-1">
              <AppText className="text-[11px] text-slate-500">Session starts in</AppText>
              <AppText variant="mono" className="text-xs text-cyan-300" numberOfLines={2}>
                {sessionDirectory ?? 'Resolving workspace…'}
              </AppText>
              {displayedJobStatus ? (
                <AppText className="mt-0.5 text-[11px] text-slate-600">
                  {displayedJobStatus} · {terminal.launch?.target} · last: {terminal.lastCommand}
                </AppText>
              ) : null}
            </View>
            <View className="flex-row gap-2">
              {terminal.output.trim() ? (
                <Button
                  label="Ask AI"
                  variant="secondary"
                  size="sm"
                  icon="sparkles-outline"
                  onPress={explainCurrentOutput}
                />
              ) : null}
              {active ? (
                <Button
                  label="End"
                  variant="danger"
                  size="sm"
                  loading={terminal.phase === 'stopping'}
                  onPress={() => void terminal.stop()}
                />
              ) : (
                <Button label="New" variant="secondary" size="sm" onPress={terminal.reset} />
              )}
            </View>
          </View>

          {terminal.error ? (
            <View className="border-b border-red-500/30 bg-red-500/10 px-4 py-3">
              <AppText className="text-sm text-red-300">{terminal.error}</AppText>
            </View>
          ) : null}
          {terminal.phase === 'waiting' ? (
            <View className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <AppText className="text-sm text-amber-200">
                Waiting for a worker. Free-tier jobs share the queue; keep this screen open.
              </AppText>
            </View>
          ) : null}
          {terminal.exitCode !== null ? (
            <View className="border-b border-slate-800 bg-slate-950 px-4 py-2">
              <View className="flex-row items-center justify-between gap-3">
                <AppText
                  className={
                    terminal.exitCode === 0 ? 'text-sm text-green-300' : 'text-sm text-red-300'
                  }
                >
                  Terminal exited with code {terminal.exitCode}
                </AppText>
                {terminal.exitCode !== 0 ? (
                  <AppText variant="caption">Use Ask AI above for help.</AppText>
                ) : null}
              </View>
            </View>
          ) : null}

          <TerminalOutput
            ref={outputRef}
            output={terminal.output}
            placeholder={
              terminal.phase === 'waiting'
                ? 'Waiting for the PTY to become ready…'
                : 'Connecting to terminal…'
            }
          />
          {active ? (
            <TerminalInput disabled={terminal.phase !== 'ready'} onSend={terminal.sendInput} />
          ) : null}
          {explanationRequest ? (
            <ExplanationModal
              visible
              command={explanationRequest.command}
              output={explanationRequest.output}
              exitCode={explanationRequest.exitCode}
              onClose={() => setExplanationRequest(null)}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}
