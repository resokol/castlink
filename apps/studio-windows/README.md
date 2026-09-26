# StudioLink Studio — Windows 11 native

Native x64 studio client. No Electron and no embedded browser.

## Stack
- C++20 / Win32
- LiveKit C++ SDK
- WASAPI for native audio I/O and realtime PCM metering
- CMake + Visual Studio 2022

## Build on Windows 11
Install Visual Studio 2022 with Desktop development with C++ and CMake tools.
Then from Developer PowerShell:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
```

Current milestone boots a native Win32 application. Next milestone integrates LiveKit C++ room connection and WASAPI meter.
