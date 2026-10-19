using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

// Dedicated PowerPoint process-tree rendering capture. There is deliberately no
// IMMDeviceEnumerator, endpoint selection, microphone, or exclusion-mode path.
namespace CastLink.ProcessAudio {
    [StructLayout(LayoutKind.Sequential)] public struct ActivationParameters {
        public uint ActivationType;
        public uint TargetProcessId;
        public uint ProcessLoopbackMode;
    }
    [StructLayout(LayoutKind.Sequential)] public struct BlobVariant {
        public ushort Type, Reserved1, Reserved2, Reserved3;
        public uint Size;
        public IntPtr Data;
    }
    [StructLayout(LayoutKind.Sequential, Pack=2)] public struct WaveFormat {
        public ushort Tag, Channels;
        public uint SamplesPerSecond, AverageBytesPerSecond;
        public ushort BlockAlign, BitsPerSample, ExtraSize;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct OsVersion {
        public uint Size, Major, Minor, Build, Platform;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string ServicePack;
    }
    [ComVisible(true), Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAgileObject {}
    [ComVisible(true), Guid("41D949AB-9862-444A-80F6-C261334DA5EB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IActivateAudioInterfaceCompletionHandler {
        [PreserveSig] int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation);
    }
    [ComImport, Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IActivateAudioInterfaceAsyncOperation {
        [PreserveSig] int GetActivateResult(out int result, [MarshalAs(UnmanagedType.IUnknown)] out object audioInterface);
    }
    [ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioClient {
        [PreserveSig] int Initialize(int mode, uint flags, long duration, long period, ref WaveFormat format, IntPtr session);
        [PreserveSig] int GetBufferSize(out uint frames);
        [PreserveSig] int GetStreamLatency(out long latency);
        [PreserveSig] int GetCurrentPadding(out uint frames);
        [PreserveSig] int IsFormatSupported(int mode, ref WaveFormat format, out IntPtr closest);
        [PreserveSig] int GetMixFormat(out IntPtr format);
        [PreserveSig] int GetDevicePeriod(out long normal, out long minimum);
        [PreserveSig] int Start();
        [PreserveSig] int Stop();
        [PreserveSig] int Reset();
        [PreserveSig] int SetEventHandle(IntPtr handle);
        [PreserveSig] int GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object service);
    }
    [ComImport, Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioCaptureClient {
        [PreserveSig] int GetBuffer(out IntPtr data, out uint frames, out uint flags, out ulong devicePosition, out ulong performanceCounter);
        [PreserveSig] int ReleaseBuffer(uint frames);
        [PreserveSig] int GetNextPacketSize(out uint frames);
    }
    [ComVisible(true), ClassInterface(ClassInterfaceType.None)]
    public sealed class Completion : IActivateAudioInterfaceCompletionHandler, IAgileObject {
        public readonly ManualResetEvent Done = new ManualResetEvent(false);
        public int Result = unchecked((int)0x80004005);
        public IAudioClient Client;
        public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation) {
            try {
                object value;
                int hr = operation.GetActivateResult(out Result, out value);
                if (hr < 0) Result = hr;
                if (Result >= 0) Client = (IAudioClient)value;
            } catch { Result = unchecked((int)0x80004005); }
            finally { Done.Set(); }
            return 0;
        }
    }
    internal static class Program {
        const uint ActivationTypeProcessLoopback=1;
        const uint IncludeTargetProcessTree=0;
        const uint StreamFlags=0x00020000U | 0x00040000U | 0x80000000U;
        const uint Silent=2;
        const int MaximumFrames=4800;
        static volatile bool stopping;
        static volatile bool finished;
        static string stage="validation";
        [DllImport("Mmdevapi.dll", ExactSpelling=true, CharSet=CharSet.Unicode)]
        static extern int ActivateAudioInterfaceAsync(string path, ref Guid iid, ref BlobVariant parameters,
            [MarshalAs(UnmanagedType.Interface)] IActivateAudioInterfaceCompletionHandler completion,
            out IActivateAudioInterfaceAsyncOperation operation);
        [DllImport("user32.dll")] [return:MarshalAs(UnmanagedType.Bool)] static extern bool IsWindow(IntPtr window);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
        [DllImport("ntdll.dll", CharSet=CharSet.Unicode)] static extern int RtlGetVersion(ref OsVersion version);

        static void Check(int hr) { if (hr < 0) Marshal.ThrowExceptionForHR(hr); }
        static bool BoundWindow(IntPtr window, uint pid, Process process) {
            uint current;
            return !process.HasExited && IsWindow(window) && GetWindowThreadProcessId(window, out current)!=0 && current==pid;
        }
        static uint SupportedBuild() {
            OsVersion version=new OsVersion(); version.Size=(uint)Marshal.SizeOf(typeof(OsVersion));
            if (RtlGetVersion(ref version)!=0 || version.Major<10 || version.Build<20348) throw new NotSupportedException();
            return version.Build;
        }
        static Process BindPowerPoint(IntPtr window, out uint pid) {
            pid=0;
            if (!IsWindow(window) || GetWindowThreadProcessId(window,out pid)==0 || pid==0) throw new InvalidOperationException();
            Process process=Process.GetProcessById(checked((int)pid));
            try {
                // Opening Handle retains the original process identity across PID reuse.
                if (process.Handle==IntPtr.Zero || process.HasExited ||
                    !String.Equals(process.ProcessName,"POWERPNT",StringComparison.OrdinalIgnoreCase) ||
                    !String.Equals(Path.GetFileName(process.MainModule.FileName),"POWERPNT.EXE",StringComparison.OrdinalIgnoreCase) ||
                    !BoundWindow(window,pid,process)) throw new InvalidOperationException();
                return process;
            } catch { process.Dispose(); throw; }
        }
        static void CheckLayout() {
            if (IntPtr.Size!=8 || Marshal.SizeOf(typeof(ActivationParameters))!=12 ||
                Marshal.SizeOf(typeof(BlobVariant))!=24 || Marshal.OffsetOf(typeof(BlobVariant),"Data").ToInt32()!=16 ||
                Marshal.SizeOf(typeof(WaveFormat))!=18) throw new InvalidOperationException();
        }
        [MTAThread] static int Main(string[] args) {
            try {
                CheckLayout();stage="platform";uint build=SupportedBuild();
                if (args.Length==1 && args[0]=="--self-test") {
                    Console.WriteLine("{\"layout\":true,\"supportedBuild\":"+build.ToString(CultureInfo.InvariantCulture)+"}");return 0;
                }
                long raw;
                if (args.Length!=2 || (args[0]!="--window" && args[0]!="--probe") ||
                    args[1].Length>19 || !Int64.TryParse(args[1],NumberStyles.None,CultureInfo.InvariantCulture,out raw) || raw<=0)
                    throw new ArgumentException();
                stage="source";IntPtr window=new IntPtr(raw);uint pid;
                using (Process process=BindPowerPoint(window,out pid)) {
                    if (args[0]=="--probe") {
                        Console.WriteLine("{\"supported\":true,\"build\":"+build.ToString(CultureInfo.InvariantCulture)+",\"pid\":"+pid.ToString(CultureInfo.InvariantCulture)+",\"process\":\"POWERPNT\"}");return 0;
                    }
                    Thread owner=new Thread(delegate() {
                        try { Console.OpenStandardInput().ReadByte(); } catch {}
                        stopping=true;
                    });owner.IsBackground=true;owner.Start();
                    Capture(window,pid,process);
                }
                return 0;
            } catch (NotSupportedException) { Console.Error.WriteLine("unsupported-windows");return 3; }
            catch(Exception error) {
                // Fixed stage plus numeric HRESULT only: no exception messages,
                // source paths, window titles or document names cross stderr.
                Console.Error.WriteLine("process-audio-refused:"+stage+":"+unchecked((uint)Marshal.GetHRForException(error)).ToString("X8",CultureInfo.InvariantCulture));return 4;
            }
        }
        static void Capture(IntPtr window, uint pid, Process process) {
            Completion completion=new Completion();IActivateAudioInterfaceAsyncOperation operation=null;
            IAudioClient client=null;IAudioCaptureClient capture=null;bool started=false;
            IntPtr blob=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(ActivationParameters)));
            try {
                ActivationParameters parameters=new ActivationParameters();
                parameters.ActivationType=ActivationTypeProcessLoopback;
                parameters.TargetProcessId=pid;parameters.ProcessLoopbackMode=IncludeTargetProcessTree;
                Marshal.StructureToPtr(parameters,blob,false);
                BlobVariant variant=new BlobVariant();variant.Type=65;variant.Size=12;variant.Data=blob;
                Guid audioClientId=typeof(IAudioClient).GUID;
                stage="activation";Check(ActivateAudioInterfaceAsync("VAD\\Process_Loopback",ref audioClientId,ref variant,completion,out operation));
                // The CCW is agile and all activation/capture work occurs in MTA.
                // Keep callback and its event alive until native completion.
                if (!completion.Done.WaitOne(8000)) {
                    // Exiting releases all process resources; do not dispose a
                    // callback event that Windows may still signal asynchronously.
                    Console.Error.WriteLine("process-audio-refused:activation-timeout");Environment.Exit(4);
                }
                Check(completion.Result);client=completion.Client;
                if (client==null || !BoundWindow(window,pid,process) || stopping) throw new InvalidOperationException();
                // A blocked stdout consumer must not keep capturing a vanished
                // source. This background watcher terminates only this helper;
                // OS teardown releases its WASAPI objects even during a pipe write.
                Thread lifetime=new Thread(delegate() {
                    try {
                        while (!finished) {
                            if (stopping || !BoundWindow(window,pid,process)) Environment.Exit(0);
                            Thread.Sleep(50);
                        }
                    } catch {}
                });lifetime.IsBackground=true;lifetime.Start();
                WaveFormat format=new WaveFormat();format.Tag=3;format.Channels=2;format.SamplesPerSecond=48000;
                format.BitsPerSample=32;format.BlockAlign=8;format.AverageBytesPerSecond=384000;
                stage="initialize";Check(client.Initialize(0,StreamFlags,0,0,ref format,IntPtr.Zero));
                using (AutoResetEvent sampleReady=new AutoResetEvent(false)) {
                    Check(client.SetEventHandle(sampleReady.SafeWaitHandle.DangerousGetHandle()));
                    Guid captureId=typeof(IAudioCaptureClient).GUID;object service;
                    Check(client.GetService(ref captureId,out service));capture=(IAudioCaptureClient)service;
                    stage="start";Check(client.Start());started=true;
                    using (BinaryWriter output=new BinaryWriter(Console.OpenStandardOutput())) {
                        output.Write(new byte[]{67,76,80,65,48,48,48,49});
                        output.Write((uint)48000);output.Write((ushort)2);output.Write((ushort)32);output.Write(pid);output.Write((uint)0);output.Flush();
                        stage="capture";byte[] pcm=new byte[MaximumFrames*8];
                        while (!stopping && BoundWindow(window,pid,process)) {
                            sampleReady.WaitOne(50);
                            if (stopping || !BoundWindow(window,pid,process)) break;
                            uint next;Check(capture.GetNextPacketSize(out next));
                            while (next>0 && !stopping && BoundWindow(window,pid,process)) {
                                IntPtr data;uint frames,flags;ulong devicePosition,counter;
                                Check(capture.GetBuffer(out data,out frames,out flags,out devicePosition,out counter));
                                try {
                                    if (frames<1 || frames>MaximumFrames) throw new InvalidOperationException();
                                    int count=checked((int)frames*8);
                                    if ((flags & Silent)!=0) Array.Clear(pcm,0,count);
                                    else { if (data==IntPtr.Zero) throw new InvalidOperationException();Marshal.Copy(data,pcm,0,count); }
                                    if (stopping || !BoundWindow(window,pid,process)) break;
                                    output.Write(frames);output.Write(pcm,0,count);output.Flush();
                                } finally { Check(capture.ReleaseBuffer(frames)); }
                                Check(capture.GetNextPacketSize(out next));
                            }
                        }
                    }
                }
            } finally {
                finished=true;
                if (started && client!=null) client.Stop();
                if (capture!=null) Marshal.ReleaseComObject(capture);
                if (client!=null) Marshal.ReleaseComObject(client);
                if (operation!=null) Marshal.ReleaseComObject(operation);
                Marshal.FreeHGlobal(blob);GC.KeepAlive(completion);
            }
        }
    }
}
