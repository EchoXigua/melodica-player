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
 static readonly Dictionary<string,ushort> scans=new Dictionary<string,ushort>{{"Z",0x2c},{"X",0x2d},{"C",0x2e},{"V",0x2f},{"B",0x30},{"N",0x31},{"M",0x32},{",",0x33}};
 static readonly HashSet<string> held=new HashSet<string>();
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
  if(device=="key") { if(!scans.ContainsKey(code))throw new Exception("Invalid key");input.type=1;input.u.ki.scan=scans[code];input.u.ki.flags=(uint)(0x8|(down?0:0x2)); }
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
 static bool Focused(IntPtr hwnd,uint pid) {
  uint current;GetWindowThreadProcessId(hwnd,out current);
  return GetForegroundWindow()==hwnd && current==pid;
 }
 public static void Play(string plan,string target,int owner,string stop) {
  string terminal="DONE";
  try {
   string[] targetParts=target.Split(':');IntPtr hwnd=new IntPtr(long.Parse(targetParts[0]));uint pid=uint.Parse(targetParts[1]);
   string[] lines=File.ReadAllLines(plan);if(lines.Length>160002)throw new Exception("Plan too large");
   Console.WriteLine("COUNTDOWN 5");Stopwatch clock=Stopwatch.StartNew();
   while(clock.ElapsedMilliseconds<5000){if(Cancelled(owner,stop)){terminal="STOP Cancelled";return;}Thread.Sleep(5);}
   if(!Focused(hwnd,pid))throw new Exception("Selected target is not the foreground window");
   // Do not begin while the user is holding keys/buttons used by the instrument.
   foreach(int vk in new int[]{0x5a,0x58,0x43,0x56,0x42,0x4e,0x4d,0xbc,1,2,4})
    if((GetAsyncKeyState(vk)&0x8000)!=0)throw new Exception("Release instrument keys and mouse buttons before playback");
   clock.Restart();Console.WriteLine("PLAYING");long last=0;
   foreach(string line in lines) {
    string[] p=line.Split('\t');long at=long.Parse(p[0]);
    if(at<last||at>1800000)throw new Exception("Invalid event timing");last=at;
    while(clock.ElapsedMilliseconds<at) {
     if(Cancelled(owner,stop)){terminal="STOP Cancelled";return;}
     if(!Focused(hwnd,pid)){terminal="STOP Target lost focus";return;}
     Thread.Sleep(2);
    }
    if(Cancelled(owner,stop)){terminal="STOP Cancelled";return;}
    if(!Focused(hwnd,pid)){terminal="STOP Target lost focus";return;}
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
   Console.WriteLine(terminal);
  }
 }
}}
