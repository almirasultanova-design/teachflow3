import ytdl from '@distube/ytdl-core';

/**
 * Downloads up to ~`maxBytes` of an audio-only stream for the given video.
 * We pick the smallest audio-only format we can find to keep payload small —
 * Whisper accepts webm/m4a directly so no transcoding is required.
 *
 * Returns the raw bytes plus the container hint for OpenAI's file uploader.
 */
export async function downloadYouTubeAudioPreview(
  videoId: string,
  opts: { maxBytes?: number; maxMs?: number } = {},
): Promise<{ data: Buffer; mime: string; filename: string }> {
  const maxBytes = opts.maxBytes ?? 1_500_000; // ~90 sec of opus audio
  const maxMs = opts.maxMs ?? 30_000;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const info = await ytdl.getInfo(url);
  const audioFormats = ytdl
    .filterFormats(info.formats, 'audioonly')
    .filter((f) => Boolean(f.url));
  if (audioFormats.length === 0) {
    throw new Error('no audio-only formats available');
  }
  // Prefer the lowest-bitrate audio so we save bandwidth and Whisper time.
  audioFormats.sort((a, b) => (a.audioBitrate ?? 9999) - (b.audioBitrate ?? 9999));
  const fmt = audioFormats[0];

  const stream = ytdl.downloadFromInfo(info, { format: fmt });

  const chunks: Buffer[] = [];
  let total = 0;
  let timer: NodeJS.Timeout | null = null;

  await new Promise<void>((resolve, reject) => {
    timer = setTimeout(() => {
      stream.destroy();
      resolve();
    }, maxMs);

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total >= maxBytes) stream.destroy();
    });
    stream.on('end', () => resolve());
    stream.on('close', () => resolve());
    stream.on('error', (err: Error) => reject(err));
  }).finally(() => {
    if (timer) clearTimeout(timer);
  });

  const data = Buffer.concat(chunks);
  if (data.length === 0) throw new Error('downloaded 0 bytes');

  const container = (fmt.container ?? '').toLowerCase();
  const mime =
    container === 'webm'
      ? 'audio/webm'
      : container === 'mp4' || container === 'm4a'
        ? 'audio/mp4'
        : 'application/octet-stream';
  const filename = `audio.${container || 'webm'}`;

  return { data, mime, filename };
}
