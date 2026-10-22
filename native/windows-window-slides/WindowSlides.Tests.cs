using System;
class WindowSlidesTests {
 class Fake : IWindowSlidesPlatform {
  public WindowSnapshot Current=new WindowSnapshot(123,"binding","Report.pdf");
  public long Foreground=123; public bool Safe=true,Keys=true; public int Inserted=2,Taps,Releases,Activations; public bool ChangeAfterTap;
  public WindowSnapshot Read(long hwnd){return Current;}
  public long ForegroundHandle(){return Foreground;}
  public bool SafeInputDesktop(){return Safe;}
  public bool KeysClear(){return Keys;}
  public void Activate(long hwnd){Activations++;Foreground=hwnd;}
  public uint Tap(long hwnd,string binding,bool next,long expiresAt){Taps++;if(ChangeAfterTap)Foreground=999;return(uint)Inserted;}
  public void Release(bool next){Releases++;}
 }
 static void Assert(bool v,string message){if(!v)throw new Exception(message);}
 static void Refuses(Fake p,string code,long expires=2000){
  try{WindowSlidesCore.Step(p,123,"binding",true,expires,delegate{return 1000;});throw new Exception("unsafe input accepted");}
  catch(WindowSlidesFailure e){Assert(e.Code==code,"wrong refusal: "+e.Code);}
 }
 static void Main(){
  var p=new Fake();WindowSlidesCore.Step(p,123,"binding",true,2000,delegate{return 1000;});
  Assert(p.Taps==1&&p.Activations==0&&p.Releases==0,"single tap without remote activation");
  p=new Fake();p.Foreground=456;Refuses(p,"WINDOW_SLIDES_FOREGROUND");Assert(p.Taps==0,"background input");
  p=new Fake();p.Current=new WindowSnapshot(123,"changed","Same label.pdf");Refuses(p,"WINDOW_SLIDES_STALE");Assert(p.Taps==0,"changed target");
  p=new Fake();Refuses(p,"WINDOW_SLIDES_COMMAND",999);Assert(p.Taps==0,"expired input");
  p=new Fake();p.Safe=false;Refuses(p,"WINDOW_SLIDES_UNAVAILABLE");Assert(p.Taps==0,"secure desktop");
  p=new Fake();p.Keys=false;Refuses(p,"WINDOW_SLIDES_UNAVAILABLE");Assert(p.Taps==0&&p.Releases==0,"physical modifier untouched");
  p=new Fake();p.Inserted=1;Refuses(p,"WINDOW_SLIDES_AMBIGUOUS");Assert(p.Releases==1,"partial press released");
  p=new Fake();p.ChangeAfterTap=true;Refuses(p,"WINDOW_SLIDES_AMBIGUOUS");Assert(p.Taps==1,"ambiguous result not retried");
  p=new Fake();p.Foreground=456;WindowSlidesCore.Status(p,123,"binding");Assert(p.Taps==0&&p.Activations==0,"background status observes only");
  p=new Fake();p.Foreground=456;WindowSlidesCore.Activate(p,123,"binding");Assert(p.Activations==1&&p.Taps==0,"explicit local start only activation");
  Assert(WindowSlidesCore.Bind(123,5,6,"Report: Q4.pdf","cls")!=WindowSlidesCore.Bind(123,5,6,"Report/ Q4.pdf","cls"),"raw title binding");
  Assert(WindowSlidesCore.Bind(123,5,6,"A.pdf","cls")!=WindowSlidesCore.Bind(123,5,7,"A.pdf","cls"),"process start binding");
  Assert(WindowSlidesCore.Label("Report: Q4.pdf")=="Report  Q4.pdf","safe exported label");
  Console.WriteLine("PASS native window binding, foreground/expiry/desktop guards, tap pair and partial release");
 }
}
