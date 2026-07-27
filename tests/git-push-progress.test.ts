import { describe, expect, it } from 'vitest';
import { parseGitPushProgressLine } from '../packages/shared/src/git-protocol';

describe('Git push progress parsing', () => {
  it('maps Git phases into monotonic whole-push percentages', () => {
    const counting = parseGitPushProgressLine('Counting objects: 100% (12/12), done.');
    const compressing = parseGitPushProgressLine('Compressing objects: 40% (4/10)');
    const uploading = parseGitPushProgressLine(
      'Writing objects: 60% (6/10), 1.25 MiB | 625.00 KiB/s',
    );
    const resolving = parseGitPushProgressLine('remote: Resolving deltas: 50% (2/4)');

    expect(counting).toMatchObject({ stage: 'COUNTING', percent: 20 });
    expect(compressing).toMatchObject({ stage: 'COMPRESSING', percent: 30 });
    expect(uploading).toMatchObject({
      stage: 'UPLOADING',
      percent: 72,
      message: 'Uploading objects · 60% · 1.25 MiB | 625.00 KiB/s',
    });
    expect(resolving).toMatchObject({ stage: 'FINALIZING', percent: 94 });
  });

  it('recognizes an already-synchronized branch', () => {
    expect(parseGitPushProgressLine('Everything up-to-date')).toEqual({
      stage: 'FINALIZING',
      percent: 99,
      message: 'Everything is already up to date',
    });
  });
});
