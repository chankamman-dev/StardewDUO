package io.github.chankamman_dev.stardewds;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.*;

/** User-local content only. Packs cannot replace executable web assets or credentials. */
public final class AssetPackStore {
 private static final long TOTAL=128L*1024*1024,FILE=8L*1024*1024;
 private final File root; private volatile File active;
 public AssetPackStore(File root)throws IOException{this.root=root.getCanonicalFile();Files.createDirectories(this.root.toPath());File pointer=new File(this.root,"active");if(pointer.isFile()){String name=new String(Files.readAllBytes(pointer.toPath()),StandardCharsets.UTF_8);if(name.matches("pack-[a-f0-9-]{36}")){File candidate=new File(this.root,name);if(new File(candidate,"offline.json").isFile())active=candidate;}}}
 public boolean ready(){return active!=null;}
 /** Why an import failed, as a short code the page explains: format, incomplete, damaged, size or read. */
 public static String reason(Exception e){String m=String.valueOf(e.getMessage());if(e instanceof java.util.zip.ZipException)return "read";if(m.startsWith("Missing asset manifest")||m.startsWith("Unsupported")||m.startsWith("Invalid asset manifest"))return "format";if(m.startsWith("Incomplete")||m.startsWith("Missing asset entries")||m.startsWith("Unexpected"))return "incomplete";if(m.contains("checksum"))return "damaged";if(m.contains("budget")||m.contains("too large"))return "size";return "read";}
 /** Files in the active pack and when it was imported, or null without one. */
 public long[] summary()throws IOException{File dir=active;if(dir==null)return null;try(java.util.stream.Stream<Path> paths=Files.walk(dir.toPath())){return new long[]{paths.filter(Files::isRegularFile).count(),dir.lastModified()};}}
 public InputStream open(String path)throws IOException{File dir=active;if(dir==null||!allowed(path))throw new FileNotFoundException();return new FileInputStream(new File(dir,path));}
 static boolean allowed(String p){if(p.length()>180||p.contains("..")||!p.matches("[A-Za-z0-9_./-]+"))return false;return p.equals("offline.json")||p.matches("art/[A-Za-z0-9_/-]+\\.(png|json)")||p.matches("audio/[A-Za-z0-9_-]+\\.wav");}
 public synchronized int install(InputStream input)throws Exception{
  File stage=new File(root,"pack-"+UUID.randomUUID());Files.createDirectory(stage.toPath());boolean committed=false;
  try(ZipInputStream zip=new ZipInputStream(input)){
   ZipEntry first=zip.getNextEntry();if(first==null||!first.getName().equals("assets.tsv"))throw new IOException("Missing asset manifest");
   byte[] manifest=read(zip,1024*1024);String[] lines=new String(manifest,StandardCharsets.UTF_8).split("\\r?\\n");if(lines.length<2||!lines[0].equals("stardew-thor.assets.v1"))throw new IOException("Unsupported asset pack");
   Map<String,String> hashes=new HashMap<>();Map<String,Long> sizes=new HashMap<>();long total=0;
   for(int i=1;i<lines.length;i++){String[] v=lines[i].split("\\t",-1);if(v.length!=3||!v[0].matches("[a-f0-9]{64}")||!v[1].matches("[0-9]{1,8}")||!allowed(v[2])||hashes.put(v[2],v[0])!=null)throw new IOException("Invalid asset manifest");long n=Long.parseLong(v[1]);if(n<1||n>FILE||(total+=n)>TOTAL||hashes.size()>4000)throw new IOException("Asset budget exceeded");sizes.put(v[2],n);}
   for(String required:new String[]{"offline.json","art/objects.png","art/frame-main.png","art/icon-bag.png"})if(!hashes.containsKey(required))throw new IOException("Incomplete asset pack: "+required);
   Set<String> seen=new HashSet<>();ZipEntry e;while((e=zip.getNextEntry())!=null){String name=e.getName();if(!hashes.containsKey(name)||!seen.add(name)||e.isDirectory())throw new IOException("Unexpected asset entry");byte[] data=read(zip,sizes.get(name));if(data.length!=sizes.get(name)||!hex(MessageDigest.getInstance("SHA-256").digest(data)).equals(hashes.get(name)))throw new IOException("Asset checksum mismatch");File file=new File(stage,name);Files.createDirectories(file.getParentFile().toPath());Files.write(file.toPath(),data);}
   if(seen.size()!=hashes.size())throw new IOException("Missing asset entries");
   File next=new File(root,"active-next");Files.write(next.toPath(),stage.getName().getBytes(StandardCharsets.UTF_8));Files.move(next.toPath(),new File(root,"active").toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);File previous=active;active=stage;committed=true;if(previous!=null)remove(previous);return seen.size();
  }finally{if(!committed)remove(stage);}
 }
 private static byte[] read(InputStream in,long max)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if((long)out.size()+n>max)throw new IOException("Asset too large");out.write(b,0,n);}return out.toByteArray();}
 private static String hex(byte[] bytes){StringBuilder b=new StringBuilder();for(byte v:bytes)b.append(String.format(Locale.ROOT,"%02x",v&255));return b.toString();}
 private void remove(File dir)throws IOException{if(!dir.getCanonicalFile().getParentFile().equals(root)||!dir.getName().matches("pack-[a-f0-9-]{36}"))throw new IOException("Invalid cleanup path");try(java.util.stream.Stream<Path> paths=Files.walk(dir.toPath())){for(Path p:(Iterable<Path>)paths.sorted(Comparator.reverseOrder())::iterator)Files.deleteIfExists(p);}}
}
