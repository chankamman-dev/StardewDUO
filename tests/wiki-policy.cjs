// Compiles WikiUrlPolicy.java (the native reader's boundary) with its test and runs it on the JVM.
const {execFileSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wiki-policy-'));
try{execFileSync('javac',['-encoding','UTF-8','-d',dir,'android/src/io/github/chankamman_dev/stardewds/WikiUrlPolicy.java','tests/WikiUrlPolicyTest.java'],{stdio:'inherit'});
 execFileSync('java',['-cp',dir,'WikiUrlPolicyTest'],{stdio:'inherit'});}
finally{fs.rmSync(dir,{recursive:true,force:true});}
