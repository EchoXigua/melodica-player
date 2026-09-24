using System;
using System.Text;
using System.IO;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
namespace Melodica {
public class InputEngine {
 [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
 [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSE mi; [FieldOffset(0)] public KEY ki; }
 [StructLayout(LayoutKind.Sequential)] struct MOUSE { public int dx,dy; public uint data,flags,time; public UIntPtr extra; }
 [StructLayout(LayoutKind.Sequential)] struct KEY { public ushort vk,scan; public uint flags,time; public UIntPtr extra; }
 delegate bool EnumProc(IntPtr hwnd,IntPtr param);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback,IntPtr param);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int max);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count,INPUT[] input,int size);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int cls,out int elevation,int len,out int ret);
 static readonly Dictionary<string,ushort> scans=new Dictionary<string,ushort>{{"Z",0x2c},{"X",0x2d},{"C",0x2e},{"V",0x2f},{"B",0x30},{"N",0x31},{"M",0x32},{",",0x33}};
 static readonly Dictionary<string,ushort> vks=new Dictionary<string,ushort>{{"Z",0x5a},{"X",0x58},{"C",0x43},{"V",0x56},{"B",0x42},{"N",0x4e},{"M",0x4d},{",",0xbc}};
 static readonly HashSet<string> held=new HashSet<string>();
 public static void Release() {
  foreach(string code in new string[]{"Z","X","C","V","B","N","M",","}) try{Send("key",code,false);}catch{}
  foreach(string code in new string[]{"left","right","middle"}) try{Send("mouse",code,false);}catch{}
 }
 public static void List() {
  EnumWindows(delegate(IntPtr h,IntPtr unused) {
   if(!IsWindowVisible(h))return true;
   StringBuilder title=new StringBuilder(1024);GetWindowText(h,title,1024);
   if(title.Length==0)return true;
   uint pid;GetWindowThreadProcessId(h,out pid);
   string name="";try{name=Process.GetProcessById((int)pid).ProcessName;}catch{}
   Console.WriteLine(h.ToInt64()+":"+pid+"\t"+Convert.ToBase64String(Encoding.UTF8.GetBytes(name+" — "+title.ToString())));
   return true;
  },IntPtr.Zero);
 }
 static void Send(string device,string code,bool down) {
  INPUT input=new INPUT();
  if(device=="key") { if(!scans.ContainsKey(code))throw new Exception("Invalid key");input.type=1;input.u.ki.vk=vks[code];input.u.ki.scan=scans[code];input.u.ki.flags=(uint)(0x8|(down?0:0x2)); }
  else if(device=="mouse") {input.type=0;uint flag=code=="left"?2u:code=="right"?8u:code=="middle"?32u:0u;if(flag==0)throw new Exception("Invalid mouse button");input.u.mi.flags=down?flag:flag*2;}
  else throw new Exception("Invalid device");
  string id=device+":"+code;
  if(down)held.Add(id);
  if(SendInput(1,new INPUT[]{input},Marshal.SizeOf(typeof(INPUT)))!=1)throw new Exception("SendInput failed ("+Marshal.GetLastWin32Error()+"). Check target permissions.");
  if(!down)held.Remove(id);
 }
 static bool Cancelled(int owner,string stop) {
  if(File.Exists(stop)||(GetAsyncKeyState(0x77)&0x8000)!=0)return true;
  try{return Process.GetProcessById(owner).HasExited;}catch{return true;}
 }
 static bool Elevated(uint pid) {
  IntPtr process=pid==0?GetCurrentProcess():OpenProcess(0x1000,false,pid);
  if(process==IntPtr.Zero)return false;
  try {
   IntPtr token;
   if(!OpenProcessToken(process,0x8,out token))return false;
   try { int elevation,ret; if(!GetTokenInformation(token,20,out elevation,4,out ret))return false; return elevation!=0; }
   finally { CloseHandle(token); }
  } catch { return false; }
  finally { if(pid!=0)CloseHandle(process); }
 }
 static bool Focused(IntPtr hwnd,uint pid) {
  IntPtr foreground=GetForegroundWindow();
  if(foreground==IntPtr.Zero)return false;
  uint foregroundPid;GetWindowThreadProcessId(foreground,out foregroundPid);
  uint selectedPid;GetWindowThreadProcessId(hwnd,out selectedPid);
  return foregroundPid==pid && selectedPid==pid;
 }
 public static void Play(string plan,string target,int owner,string stop) {
  string terminal="DONE";
  try {
   bool loose=string.IsNullOrEmpty(target)||target=="foreground";
   IntPtr hwnd=IntPtr.Zero;uint pid=0;
   if(!loose){string[] targetParts=target.Split(':');hwnd=new IntPtr(long.Parse(targetParts[0]));pid=uint.Parse(targetParts[1]);
    if(Elevated(pid)&&!Elevated(0))throw new Exception("目标窗口以管理员身份运行，当前程序权限更低，系统会丢掉发往它的按键。请关闭本程序后右键“以管理员身份运行”再试。");}
   string[] lines=File.ReadAllLines(plan);if(lines.Length>160002)throw new Exception("Plan too large");
   Console.WriteLine("COUNTDOWN 5");Stopwatch clock=Stopwatch.StartNew();
   while(clock.ElapsedMilliseconds<5000){if(Cancelled(owner,stop)){terminal="STOP Cancelled";return;}Thread.Sleep(5);}
   if(loose){uint foregroundPid;GetWindowThreadProcessId(GetForegroundWindow(),out foregroundPid);
    if(foregroundPid!=0&&Elevated(foregroundPid)&&!Elevated(0))throw new Exception("前台程序以管理员身份运行，当前程序权限更低，系统会丢掉发往它的按键。请关闭本程序后右键“以管理员身份运行”再试。");}
   else if(!Focused(hwnd,pid))throw new Exception("请先点进所选程序，让它处于前台。游戏若同时开着启动器，请选择正在前台的那个窗口。");
   // A click into a fullscreen game leaves a mouse button down and used to abort playback.
   if(!loose)
    foreach(int vk in new int[]{0x5a,0x58,0x43,0x56,0x42,0x4e,0x4d,0xbc})
     if((GetAsyncKeyState(vk)&0x8000)!=0)throw new Exception("请先松开 Z X C V B N M 和逗号键，再开始演奏");
   clock.Restart();Console.WriteLine("PLAYING");long last=0;
   foreach(string line in lines) {
    string[] p=line.Split('\t');long at=long.Parse(p[0]);
    if(at<last||at>1800000)throw new Exception("Invalid event timing");last=at;
    while(clock.ElapsedMilliseconds<at) {
     if(Cancelled(owner,stop)){terminal="STOP Cancelled";return;}
     if(!loose&&!Focused(hwnd,pid)){terminal="STOP 目标失去前台，已停止";return;}
     Thread.Sleep(2);
    }
    if(Cancelled(owner,stop)){terminal="STOP Cancelled";return;}
    if(!loose&&!Focused(hwnd,pid)){terminal="STOP 目标失去前台，已停止";return;}
    if(clock.ElapsedMilliseconds-at>250)throw new Exception("Playback timing fell behind; stopped to avoid an input burst");
    if(p[1]=="end")continue;
    Send(p[1],p[2],p[3]=="1");
    if(p.Length>4&&p[4]!="")Console.WriteLine("NOTE "+p[4]);
   }
   terminal="DONE";
  } catch(Exception e){terminal="ERROR "+e.Message;}
  finally {
   bool failed=false;
   foreach(string id in new List<string>(held)) {string[] p=id.Split(':');try{Send(p[0],p[1],false);}catch{failed=true;}}
   if(failed)terminal="ERROR Could not release all inputs; manually release instrument keys/buttons";
   int space=terminal.IndexOf(' ');
   Console.WriteLine(space<0?terminal:terminal.Substring(0,space)+" "+Convert.ToBase64String(Encoding.UTF8.GetBytes(terminal.Substring(space+1))));
  }
 }
}}
