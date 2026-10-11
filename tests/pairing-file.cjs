const fs=require('fs'),path=require('path'),cp=require('child_process');
const out=path.resolve('artifacts/pairing-test-'+Date.now());fs.mkdirSync(out,{recursive:true});
cp.execFileSync('javac',['-encoding','UTF-8','-d',out,'android/src/io/github/chankamman_dev/stardewds/PairingFile.java','tests/PairingFileTest.java'],{stdio:'inherit'});
cp.execFileSync('java',['-cp',out,'io.github.chankamman_dev.stardewds.PairingFileTest'],{stdio:'inherit'});
