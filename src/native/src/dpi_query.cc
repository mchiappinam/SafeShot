#include <napi.h>
#include <string>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellscaling.h>
#pragma comment(lib, "shcore.lib")

static double GetScaleForDisplayId(const std::string& displayId) {
  // Parse the display index from the displayId string (e.g. "1", "2")
  // Fall back to enumerating monitors and matching by index
  int targetIndex = 0;
  try {
    targetIndex = std::stoi(displayId);
  } catch (...) {
    targetIndex = 0;
  }

  struct MonitorEnumData {
    int index;
    int target;
    double scaleFactor;
  };

  MonitorEnumData data = { 0, targetIndex, 1.0 };

  EnumDisplayMonitors(
    nullptr, nullptr,
    [](HMONITOR hMonitor, HDC, LPRECT, LPARAM lParam) -> BOOL {
      auto* d = reinterpret_cast<MonitorEnumData*>(lParam);
      if (d->index == d->target) {
        UINT dpiX = 96, dpiY = 96;
        if (SUCCEEDED(GetDpiForMonitor(hMonitor, MDT_EFFECTIVE_DPI, &dpiX, &dpiY))) {
          d->scaleFactor = static_cast<double>(dpiX) / 96.0;
        }
        return FALSE; // stop enumeration
      }
      d->index++;
      return TRUE;
    },
    reinterpret_cast<LPARAM>(&data)
  );

  return data.scaleFactor;
}

#elif __APPLE__
#import <AppKit/AppKit.h>

static double GetScaleForDisplayId(const std::string& displayId) {
  int targetIndex = 0;
  try {
    targetIndex = std::stoi(displayId);
  } catch (...) {
    targetIndex = 0;
  }

  NSArray<NSScreen*>* screens = [NSScreen screens];
  if (targetIndex >= 0 && targetIndex < (int)[screens count]) {
    NSScreen* screen = screens[targetIndex];
    return [screen backingScaleFactor];
  }
  return 1.0;
}

#else

static double GetScaleForDisplayId(const std::string& /*displayId*/) {
  return 1.0;
}

#endif

Napi::Value GetMonitorScaleFactor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "displayId (string) required").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string displayId = info[0].As<Napi::String>().Utf8Value();
  double scale = GetScaleForDisplayId(displayId);
  return Napi::Number::New(env, scale);
}
