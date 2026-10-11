const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),cp=require('child_process'),zip=require('./zip-entries.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(source,dist,sdk){
 const pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json'))),mod=JSON.parse(fs.readFileSync(path.join(source,'mod/manifest.json'))),manifest=JSON.parse(fs.readFileSync(path.join(source,'SOURCE-MANIFEST.json'))),exporter=JSON.parse(fs.readFileSync(path.join(source,'tools/AssetExporter/manifest.json'))).Version,versionCode=fs.readFileSync(path.join(source,'android/AndroidManifest.xml'),'utf8').match(/versionCode="(\d+)"/)[1];
 for(const e of manifest.files){assert(!/(^|\/)(\.git|\.deps|sandbox|evidence|control-key\.json)(\/|$)|\.(dll|exe|apk|wav|keystore|jks)$/i.test(e.path),e.path);assert(!e.path.startsWith('android/assets/art/')||e.path.endsWith('.svg'),e.path);assert.notEqual(e.path,'android/assets/offline.json');assert.equal(sha(fs.readFileSync(path.join(source,e.path))),e.sha256,e.path);}
 const apk=path.join(dist,'StardewDS-'+pkg.version+'.apk'),apkFiles=zip(apk),expected=manifest.files.filter(e=>e.path.startsWith('android/assets/'));
 for(const e of expected)assert.equal(sha(apkFiles.get(e.path.slice(8))||Buffer.alloc(0)),e.sha256,'APK '+e.path);
 assert.equal([...apkFiles.keys()].filter(p=>p.startsWith('assets/')).length,expected.length,'no undeclared APK content');assert(apkFiles.has('classes.dex'));
 const bt=path.join(sdk,'build-tools/35.0.0'),badging=cp.execFileSync(path.join(bt,'aapt2.exe'),['dump','badging',apk],{encoding:'utf8'});
 assert(badging.includes("name='io.github.chankamman_dev.stardewds'"));assert(badging.includes("versionCode='"+versionCode+"'"));assert(badging.includes("versionName='"+pkg.version+"'"));
 const cert=cp.execFileSync('java',['-jar',path.join(bt,'lib/apksigner.jar'),'verify','--print-certs',apk],{encoding:'utf8'}),signer=cert.match(/certificate SHA-256 digest: ([a-f0-9]{64})/)[1];
 const files=zip(path.join(dist,'StardewDS-Mod-'+mod.Version+'.zip'));assert.deepEqual([...files.keys()].sort(),['StardewThor.ReadOnly/StardewThor.Bridge.dll','StardewThor.ReadOnly/StardewThor.ReadOnly.dll','StardewThor.ReadOnly/manifest.json']);assert.equal(sha(files.get('StardewThor.ReadOnly/manifest.json')),sha(fs.readFileSync(path.join(source,'mod/manifest.json'))));
 const helper=zip(path.join(dist,'StardewDS-AssetExporter-'+exporter+'.zip'));assert.deepEqual([...helper.keys()].sort(),['AssetExporter/AssetExporter.dll','AssetExporter/manifest.json']);
 return {passed:true,version:pkg.version,modVersion:mod.Version,publicSourceFiles:manifest.files.length,publicApkAssetFiles:expected.length,signerSha256:signer,apkSha256:sha(fs.readFileSync(apk)),containsGameAssets:false,containsPlayerData:false,containsPrivateKeys:false};
}
module.exports=check;
if(require.main===module){const [source,dist,sdk]=process.argv.slice(2);if(!sdk)throw Error('Supply clean-source directory, distribution directory, Android SDK');console.log(JSON.stringify(check(path.resolve(source),path.resolve(dist),path.resolve(sdk)),null,2));}
