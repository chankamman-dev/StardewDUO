const {execFileSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stardew-read-only-routes-'));
try{execFileSync(process.env.JAVAC||'javac',['-encoding','UTF-8','-d',dir,'android/src/io/github/chankamman_dev/stardewds/ReadOnlyDataRoutes.java','tests/ReadOnlyDataRoutesTest.java'],{stdio:'inherit'});execFileSync(process.env.JAVA||'java',['-cp',dir,'ReadOnlyDataRoutesTest'],{stdio:'inherit'});}
finally{fs.rmSync(dir,{recursive:true,force:true});}
