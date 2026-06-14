// build-mp4.mjs — 把 Playwright 录的 webm 转成兼容性好的 mp4（H.264）
// 用法：node scripts/record/build-mp4.mjs
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'out');
const webms = fs.readdirSync(OUT).filter(f => f.endsWith('.webm'))
  .map(f => ({ f, t: fs.statSync(path.join(OUT, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
if (!webms.length) { console.error('没有 webm 文件，先跑 record-demo.mjs'); process.exit(1); }

const inp = path.join(OUT, webms[0].f);
const outMp4 = path.join(__dirname, '一家食光_功能演示.mp4');
console.log('输入:', inp);
console.log('转码中（H.264 / yuv420p / faststart）…');
execFileSync(ffmpegPath, [
  '-y', '-i', inp,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
  '-pix_fmt', 'yuv420p',           // 兼容所有播放器/微信
  '-movflags', '+faststart',       // 可边下边播
  '-r', '30',
  outMp4
], { stdio: ['ignore', 'inherit', 'inherit'] });

const mb = (fs.statSync(outMp4).size / 1048576).toFixed(1);
console.log(`\n✅ 已生成 ${outMp4}（${mb} MB）`);
