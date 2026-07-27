import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { initLlama, type LlamaContext } from 'llama.rn';

import { plainTerminalText } from '@/utils/terminal';

const MODEL_KEY = 'pocketdev.local-model.v1';
const modelDirectory = new Directory(Paths.document, 'models');

export interface LocalModel {
  uri: string;
  name: string;
  size: number;
}

let activeContext: LlamaContext | null = null;
let activeModelUri: string | null = null;
let releasePromise: Promise<void> | null = null;

export async function getLocalModel(): Promise<LocalModel | null> {
  const raw = await AsyncStorage.getItem(MODEL_KEY);
  if (!raw) return null;
  try {
    const model = JSON.parse(raw) as LocalModel;
    const file = new File(model.uri);
    if (!file.exists) {
      await AsyncStorage.removeItem(MODEL_KEY);
      return null;
    }
    return { ...model, size: file.size };
  } catch {
    await AsyncStorage.removeItem(MODEL_KEY);
    return null;
  }
}

export async function importLocalModel(): Promise<LocalModel | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/octet-stream',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.name.toLowerCase().endsWith('.gguf')) {
    throw new Error('Choose a GGUF model file.');
  }

  const previousModel = await getLocalModel();
  modelDirectory.create({ idempotent: true, intermediates: true });
  const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destinationName = `${Date.now().toString(36)}-${safeName}`;
  const destination = new File(modelDirectory, destinationName);

  try {
    await new File(asset.uri).copy(destination);
    const model: LocalModel = {
      uri: destination.uri,
      name: safeName,
      size: destination.size,
    };

    await releaseLocalAssistant();
    await AsyncStorage.setItem(MODEL_KEY, JSON.stringify(model));

    if (previousModel?.uri !== model.uri) {
      try {
        const previousFile = previousModel ? new File(previousModel.uri) : null;
        if (previousFile?.exists) previousFile.delete();
      } catch {
        // The new model is already active; stale-file cleanup is best effort.
      }
    }
    return model;
  } catch (error) {
    if (destination.exists) {
      try {
        destination.delete();
      } catch {
        // Preserve the original import error.
      }
    }
    throw error;
  }
}

export async function removeLocalModel(): Promise<void> {
  const model = await getLocalModel();
  await releaseLocalAssistant();
  if (model) {
    const file = new File(model.uri);
    if (file.exists) file.delete();
  }
  await AsyncStorage.removeItem(MODEL_KEY);
}

async function contextForModel(model: LocalModel): Promise<LlamaContext> {
  if (activeContext && activeModelUri === model.uri) return activeContext;
  await releaseLocalAssistant();
  activeContext = await initLlama({
    model: model.uri,
    n_ctx: 2048,
    n_batch: 256,
    n_gpu_layers: 99,
    use_mlock: true,
  });
  activeModelUri = model.uri;
  return activeContext;
}

export async function explainTerminalFailure({
  command,
  output,
  exitCode,
  onToken,
}: {
  command: string;
  output: string;
  exitCode?: number;
  onToken?: (text: string) => void;
}): Promise<string> {
  const model = await getLocalModel();
  if (!model) {
    throw new Error('Import a GGUF model in Local Assistant settings first.');
  }
  const context = await contextForModel(model);
  const tail = plainTerminalText(output).slice(-8_000);
  const result = await context.completion(
    {
      messages: [
        {
          role: 'system',
          content:
            'You are PocketDev, a concise offline terminal assistant. Explain what the output means. If it failed, identify the likely cause and give specific fixes. If it succeeded, summarize it and call out useful warnings or next steps. Never invent output that is not present.',
        },
        {
          role: 'user',
          content: `Command: ${command}\nExit code: ${
            exitCode === undefined ? 'not available' : exitCode
          }\nTerminal output:\n${tail}`,
        },
      ],
      n_predict: 320,
      temperature: 0.2,
      stop: ['</s>', '<|eot_id|>', '<|end|>'],
    },
    (token) => {
      const text = token.content ?? token.token;
      if (text) onToken?.(text);
    },
  );
  return result.content || result.text;
}

export async function releaseLocalAssistant(): Promise<void> {
  if (releasePromise) {
    await releasePromise;
    return;
  }

  const context = activeContext;
  activeContext = null;
  activeModelUri = null;
  if (!context) return;

  const pendingRelease = (async () => {
    await context.stopCompletion().catch(() => undefined);
    await context.release().catch(() => undefined);
  })();
  releasePromise = pendingRelease;
  try {
    await pendingRelease;
  } finally {
    if (releasePromise === pendingRelease) releasePromise = null;
  }
}
