import {defineConfig} from 'vite';
export default defineConfig({
 build:{
  outDir:'../legacy/classroom-assets',
  emptyOutDir:true,
  lib:{entry:'src/embed.tsx',name:'ProfiProfitClassroom',formats:['iife'],fileName:()=> 'classroom.js'},
  cssCodeSplit:false,
  rollupOptions:{output:{assetFileNames:'classroom.[ext]'}}
 }
});
