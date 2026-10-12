// Renomeia dist-single/index.html -> dist-single/MotionCut.html
import { renameSync, existsSync } from 'node:fs';
if (existsSync('dist-single/index.html')) renameSync('dist-single/index.html', 'dist-single/MotionCut.html');
console.log('✔ dist-single/MotionCut.html');
