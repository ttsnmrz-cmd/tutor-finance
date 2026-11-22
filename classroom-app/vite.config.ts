import {defineConfig} from 'vite';
export default defineConfig({
 define:{'process.env.NODE_ENV':JSON.stringify('production'),'process.env':JSON.stringify({})},
 build:{
  outDir:'../legacy/classroom-assets',
  emptyOutDir:true,
  lib:{entry:'src/embed.tsx',name:'ProfiProfitClassroom',formats:['iife'],fileName:()=> 'classroom.js'},
  cssCodeSplit:false,
  rollupOptions:{output:{assetFileNames:'classroom.[ext]'}}
 }
});
