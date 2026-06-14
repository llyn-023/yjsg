// build-mp4-fast.mjs — 把完整版 mp4 加速成精简版
// 用法：node scripts/record/build-mp4-fast.mjs [speed]   speed 默认 2（2倍速）
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const speed = Number(process.argv[2] || 2);
const src = path.join(__dirname, '一家食光_功能演示.mp4');
if (!fs.existsSync(src)) { console.error('找不到完整版 mp4，先跑 build-mp4.mjs'); process.exit(1); }
const out = path.join(__dirname, `一家食光_功能演示_加速版.mp4`);

console.log(`输入: ${src}\n加速 ${speed}x 转码中…`);
execFileSync(ffmpegPath, [
  '-y', '-i', src,
  '-filter:v', `setpts=PTS/${speed}`,   // 视频提速（无音轨，静默）
  '-r', '30',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  out
], { stdio: ['ignore', 'inherit', 'inherit'] });

const mb = (fs.statSync(out).size / 1048576).toFixed(1);
console.log(`\n✅ 已生成 ${out}（${mb} MB，${speed}x）`);
