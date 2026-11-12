/**
 * videoOptimizer.js — server-side video compression with ffmpeg.
 *
 * Self-hosted MP4s are the heaviest assets a site serves. A 3-minute 720p clip
 * straight from a camera or editor can be 80+ MB, which is minutes of waiting
 * on cellular. This module re-encodes to a target file size using two-pass
 * bitrate targeting — the only reliable way to hit a size budget, since
 * quality-based (CRF) encoding ignores size entirely.
 *
 * Design rules:
 *   • Never fail an upload because optimization failed — keep the original.
 *   • Never store a result that is larger than the original.
 *   • Skip videos already under the target size.
 *   • Default to H.264: H.265 is ~20% smaller at equal quality but Firefox
 *     cannot decode it in MP4, so it would break for those visitors.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Lazy-require so a deployment without the binary still boots.
let _ffmpeg = null;
function getFfmpeg() {
  if (_ffmpeg) return _ffmpeg;
  _ffmpeg = require('ffmpeg-static');
  return _ffmpeg;
}

const DEFAULTS = {
  enabled: true,
  targetMB: 7,
  maxWidth: 1280,
  audioKbps: 48,
  codec: 'h264', // 'h264' | 'h265'
};

const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const EXT_FOR_TYPE = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const MB = 1048576;

/**
 * Merge a site's `video` settings over the defaults.
 * @param {object} site site object from sites.json
 * @returns {{enabled: boolean, targetMB: number, maxWidth: number, audioKbps: number, codec: string}}
 */
function resolveVideoSettings(site = {}) {
  const s = (site && site.video) || {};
  const targetMB = Number(s.targetMB);
  const maxWidth = Number(s.maxWidth);
  const audioKbps = Number(s.audioKbps);
  return {
    enabled: s.enabled !== false,
    targetMB: Number.isFinite(targetMB) && targetMB > 0 ? targetMB : DEFAULTS.targetMB,
    maxWidth: Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : DEFAULTS.maxWidth,
    audioKbps: Number.isFinite(audioKbps) && audioKbps > 0 ? audioKbps : DEFAULTS.audioKbps,
    codec: s.codec === 'h265' ? 'h265' : DEFAULTS.codec,
  };
}

/**
 * Run ffmpeg and resolve with its stderr (ffmpeg reports metadata there).
 *
 * `allowFailure` is for probe calls: `ffmpeg -i file` with no output exits 1
 * by design, but still prints the duration and stream info we need.
 */
function runFfmpeg(ffmpeg, args, { timeoutMs = 900000, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = '';
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('ffmpeg timed out'));
    }, timeoutMs);

    child.stderr.on('data', (d) => {
      stderr += d.toString();
      // Keep memory bounded on long encodes.
      if (stderr.length > 200000) stderr = stderr.slice(-100000);
    });
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || allowFailure) resolve({ stderr, stdout, code });
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

/** Read duration and audio presence from ffmpeg's stderr. */
function parseProbe(stderr) {
  const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const duration = dur
    ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3])
    : null;
  const hasAudio = /Stream #\d+:\d+.*: Audio:/.test(stderr);
  const dim = /Video:.*?,\s*(\d{2,5})x(\d{2,5})/.exec(stderr);
  return {
    duration,
    hasAudio,
    width: dim ? Number(dim[1]) : null,
    height: dim ? Number(dim[2]) : null,
  };
}

/**
 * Compress a video buffer to approximately `targetMB`.
 *
 * Returns the original buffer untouched when the video is skipped, already
 * within target, or when re-encoding would not save bytes. Callers should
 * check `changed` before using the returned buffer.
 *
 * @param {Buffer} buffer raw video bytes
 * @param {string} contentType e.g. "video/mp4"
 * @param {object} settings from resolveVideoSettings()
 * @returns {Promise<{
 *   buffer: Buffer, contentType: string, originalBytes: number, bytes: number,
 *   saved: number, changed: boolean, reason?: string, duration?: number,
 *   width?: number, height?: number, videoKbps?: number, codec?: string,
 *   error?: string
 * }>}
 */
async function optimizeVideo(buffer, contentType, settings = {}) {
  const opts = { ...DEFAULTS, ...settings };
  const originalBytes = buffer.length;

  const unchanged = (reason, extra = {}) => ({
    buffer,
    contentType,
    originalBytes,
    bytes: originalBytes,
    saved: 0,
    changed: false,
    reason,
    ...extra,
  });

  if (!opts.enabled) return unchanged('disabled');
  if (!VIDEO_TYPES.has(contentType)) return unchanged('skipped-type');

  const targetBytes = opts.targetMB * MB;
  if (originalBytes <= targetBytes) return unchanged('already-within-target');

  let dir = null;
  try {
    const ffmpeg = getFfmpeg();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodelx-video-'));

    const input = path.join(dir, 'input' + (EXT_FOR_TYPE[contentType] || '.mp4'));
    const output = path.join(dir, 'output.mp4');
    const passLog = path.join(dir, 'pass');
    fs.writeFileSync(input, buffer);

    const probe = await runFfmpeg(ffmpeg, ['-i', input], { allowFailure: true });
    const info = parseProbe(probe.stderr);

    if (!info.duration || info.duration <= 0) return unchanged('no-duration');

    // Two-pass targeting: total budget minus audio, with 3% headroom for the
    // container. Floor at 100 kbps so a very long video still produces output.
    const audioKbps = info.hasAudio ? opts.audioKbps : 0;
    const totalKbps = (targetBytes * 8 * 0.97) / info.duration / 1000;
    const videoKbps = Math.max(Math.floor(totalKbps - audioKbps), 100);

    const codec = opts.codec === 'h265' ? 'libx265' : 'libx264';
    const preset = opts.codec === 'h265' ? 'medium' : 'slow';
    const scale = `scale=${opts.maxWidth}:-2`;

    // Pass 1 — analysis only, discard output.
    await runFfmpeg(ffmpeg, [
      '-y', '-i', input,
      '-c:v', codec, '-b:v', `${videoKbps}k`, '-preset', preset,
      '-vf', scale, '-pass', '1', '-passlogfile', passLog,
      '-an', '-f', 'mp4', os.devNull,
    ]);

    // Pass 2 — real encode.
    const args = [
      '-y', '-i', input,
      '-c:v', codec, '-b:v', `${videoKbps}k`, '-preset', preset,
      '-vf', scale, '-pass', '2', '-passlogfile', passLog,
    ];
    if (info.hasAudio) args.push('-c:a', 'aac', '-b:a', `${audioKbps}k`);
    else args.push('-an');
    if (opts.codec === 'h265') args.push('-tag:v', 'hvc1');
    args.push('-movflags', '+faststart', output);

    await runFfmpeg(ffmpeg, args);

    const out = fs.readFileSync(output);

    // Re-encoding occasionally inflates an already-compressed file — keep the original.
    if (out.length >= originalBytes) return unchanged('no-gain');

    return {
      buffer: out,
      contentType: 'video/mp4',
      originalBytes,
      bytes: out.length,
      saved: originalBytes - out.length,
      changed: true,
      duration: Math.round(info.duration * 10) / 10,
      width: info.width,
      height: info.height,
      videoKbps,
      codec: opts.codec,
    };
  } catch (err) {
    // Optimization is best-effort: a corrupt or unsupported file still uploads.
    return unchanged('error', { error: err.message });
  } finally {
    if (dir) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

module.exports = {
  optimizeVideo,
  resolveVideoSettings,
  DEFAULTS,
  VIDEO_TYPES,
};
