#include <windows.h>
#include <string>
#include <audioclient.h>
#include <mmdeviceapi.h>

static LRESULT CALLBACK WindowProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  if (msg == WM_DESTROY) { PostQuitMessage(0); return 0; }
  return DefWindowProc(hwnd, msg, wp, lp);
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int show) {
  CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const wchar_t CLASS_NAME[] = L"StudioLinkStudioWindow";
  WNDCLASS wc{};
  wc.lpfnWndProc = WindowProc;
  wc.hInstance = instance;
  wc.lpszClassName = CLASS_NAME;
  wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
  RegisterClass(&wc);
  HWND hwnd = CreateWindowEx(0, CLASS_NAME, L"StudioLink Studio — Native Windows",
    WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, 1500, 900,
    nullptr, nullptr, instance, nullptr);
  if (!hwnd) return 1;
  ShowWindow(hwnd, show);
  MSG msg{};
  while (GetMessage(&msg, nullptr, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessage(&msg);
  }
  CoUninitialize();
  return 0;
}
