using System;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

// QA fixture only. Ordinary WinMM rendered audio; no capture or product bypass.
internal static class ProcessAudioTone {
    [StructLayout(LayoutKind.Sequential, Pack=2)] struct Format {
        public ushort Tag, Channels;
        public uint Rate, BytesPerSecond;
        public ushort Alignment, Bits, Extra;
    }
    [StructLayout(LayoutKind.Sequential)] struct Header {
        public IntPtr Data;
        public uint Length, Recorded;
        public IntPtr User;
        public uint Flags, Loops;
        public IntPtr Next, Reserved;
    }
    [DllImport("winmm.dll")] static extern uint waveOutOpen(out IntPtr device,uint id,ref Format format,IntPtr callback,IntPtr instance,uint flags);
    [DllImport("winmm.dll")] static extern uint waveOutPrepareHeader(IntPtr device,IntPtr header,uint size);
    [DllImport("winmm.dll")] static extern uint waveOutWrite(IntPtr device,IntPtr header,uint size);
    [DllImport("winmm.dll")] static extern uint waveOutReset(IntPtr device);
    [DllImport("winmm.dll")] static extern uint waveOutUnprepareHeader(IntPtr device,IntPtr header,uint size);
    [DllImport("winmm.dll")] static extern uint waveOutClose(IntPtr device);
    static volatile bool stopped;
    static IntPtr device;
    static readonly IntPtr[] buffers=new IntPtr[4],headers=new IntPtr[4];
    static readonly uint headerSize=(uint)Marshal.SizeOf(typeof(Header));
    static void Check(uint result) { if(result!=0)throw new InvalidOperationException("waveout-error:"+result.ToString(CultureInfo.InvariantCulture)); }
    [STAThread] static int Main(string[] args) {
        try {
            int frequency;
            if(args.Length!=1 || !Int32.TryParse(args[0],out frequency) ||
                (frequency!=440 && frequency!=880 && frequency!=1320))return 2;
            Format format=new Format();format.Tag=1;format.Channels=2;format.Rate=48000;
            format.Bits=16;format.Alignment=4;format.BytesPerSecond=192000;
            Check(waveOutOpen(out device,UInt32.MaxValue,ref format,IntPtr.Zero,IntPtr.Zero,0));
            for(int b=0;b<4;b++) {
                short[] samples=new short[4800];
                for(int frame=0;frame<2400;frame++) {
                    short sample=(short)(2000*Math.Sin(2*Math.PI*frequency*(b*2400+frame)/48000));
                    samples[frame*2]=sample;samples[frame*2+1]=sample;
                }
                buffers[b]=Marshal.AllocHGlobal(samples.Length*2);Marshal.Copy(samples,0,buffers[b],samples.Length);
                Header header=new Header();header.Data=buffers[b];header.Length=(uint)(samples.Length*2);
                headers[b]=Marshal.AllocHGlobal((int)headerSize);Marshal.StructureToPtr(header,headers[b],false);
                Check(waveOutPrepareHeader(device,headers[b],headerSize));Check(waveOutWrite(device,headers[b],headerSize));
            }
            Thread pump=new Thread(delegate() {
                try {
                    while(!stopped) {
                        for(int i=0;i<headers.Length;i++) {
                            Header h=(Header)Marshal.PtrToStructure(headers[i],typeof(Header));
                            if((h.Flags&1)!=0)Check(waveOutWrite(device,headers[i],headerSize));
                        }
                        Thread.Sleep(5);
                    }
                } catch(Exception error) { Console.Error.WriteLine(error.Message);Environment.Exit(4); }
            });pump.IsBackground=true;pump.Start();
            using(Form window=new Form()) {
                window.Text="CastLink owned process-audio QA "+frequency.ToString(CultureInfo.InvariantCulture);
                window.Width=420;window.Height=150;window.ShowInTaskbar=true;
                window.Controls.Add(new Label { Text="Owned QA rendered tone: "+frequency.ToString(CultureInfo.InvariantCulture)+" Hz",Dock=DockStyle.Fill,TextAlign=System.Drawing.ContentAlignment.MiddleCenter });
                window.Shown+=delegate {
                    Console.WriteLine("{\"ready\":true,\"pid\":"+Process.GetCurrentProcess().Id.ToString(CultureInfo.InvariantCulture)+",\"hwnd\":\""+window.Handle.ToInt64().ToString(CultureInfo.InvariantCulture)+"\",\"frequency\":"+frequency.ToString(CultureInfo.InvariantCulture)+"}");
                    Console.Out.Flush();
                };
                Application.Run(window);
            }
            stopped=true;pump.Join(1000);return 0;
        } catch(Exception error) { Console.Error.WriteLine(error.Message);return 4; }
        finally {
            stopped=true;
            if(device!=IntPtr.Zero) {
                waveOutReset(device);
                for(int i=0;i<headers.Length;i++) {
                    if(headers[i]!=IntPtr.Zero){waveOutUnprepareHeader(device,headers[i],headerSize);Marshal.FreeHGlobal(headers[i]);}
                    if(buffers[i]!=IntPtr.Zero)Marshal.FreeHGlobal(buffers[i]);
                }
                waveOutClose(device);
            }
        }
    }
}
