import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssistantService } from '../server/src/assistant/assistant.service';

function service(values: Record<string, unknown>): AssistantService {
  return new AssistantService({
    get: (name: string) => values[name],
  } as never);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AssistantService', () => {
  it('returns an explanation from an OpenAI-compatible provider', async () => {
    const provider = vi.fn(async () =>
      Response.json({
        model: 'meta-llama/llama-3.3-70b-instruct',
        choices: [{ message: { content: 'The package has no build script.' } }],
      }),
    );
    vi.stubGlobal('fetch', provider);
    const assistant = service({
      'assistant.apiKey': 'test-key',
      'assistant.baseUrl': 'https://provider.example/v1',
      'assistant.model': 'meta-llama/llama-3.3-70b-instruct',
      'assistant.timeoutMs': 10_000,
    });

    await expect(
      assistant.explainTerminalFailure({
        command: 'npm run build',
        output: 'npm error Missing script: "build"',
        exitCode: 1,
      }),
    ).resolves.toEqual({
      explanation: 'The package has no build script.',
      model: 'meta-llama/llama-3.3-70b-instruct',
    });
    expect(provider).toHaveBeenCalledWith(
      'https://provider.example/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('reports a clear configuration error when the backend has no key', async () => {
    const assistant = service({
      'assistant.baseUrl': 'https://provider.example/v1',
      'assistant.model': 'model',
    });
    await expect(
      assistant.explainTerminalFailure({
        command: 'npm test',
        output: 'failed',
        exitCode: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('explains ordinary terminal output without requiring an exit code', async () => {
    const provider = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(request.messages[1]?.content).toContain('Exit code: not available');
      return Response.json({
        model: 'test-model',
        choices: [{ message: { content: 'The command listed the available scripts.' } }],
      });
    });
    vi.stubGlobal('fetch', provider);
    const assistant = service({
      'assistant.apiKey': 'test-key',
      'assistant.baseUrl': 'https://provider.example/v1',
      'assistant.model': 'test-model',
      'assistant.timeoutMs': 10_000,
    });

    await expect(
      assistant.explainTerminalFailure({
        command: 'npm run',
        output: 'Scripts available in package.json',
      }),
    ).resolves.toMatchObject({
      explanation: 'The command listed the available scripts.',
    });
  });
});
