#include <napi.h>
#include <vector>
#include <string>

struct MonitorInfo {
  std::string id;
  int x;
  int y;
  int width;
  int height;
  double scaleFactor;
};

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellscaling.h>
#pragma comment(lib, "shcore.lib")
#pragma comment(lib, "user32.lib")

static std::vector<MonitorInfo> EnumerateMonitors() {
  std::vector<MonitorInfo> monitors;

  struct EnumData {
    std::vector<MonitorInfo>* monitors;
    int index;
  };

  EnumData data = { &monitors, 0 };

  EnumDisplayMonitors(
    nullptr, nullptr,
    [](HMONITOR hMonitor, HDC, LPRECT, LPARAM lParam) -> BOOL {
      auto* d = reinterpret_cast<EnumData*>(lParam);

      MONITORINFO mi = {};
      mi.cbSize = sizeof(MONITORINFO);
      if (!GetMonitorInfo(hMonitor, &mi)) {
        d->index++;
        return TRUE;
      }

      UINT dpiX = 96, dpiY = 96;
      GetDpiForMonitor(hMonitor, MDT_EFFECTIVE_DPI, &dpiX, &dpiY);
      double scale = static_cast<double>(dpiX) / 96.0;

      MonitorInfo info;
      info.id = std::to_string(d->index);
      info.x = mi.rcMonitor.left;
      info.y = mi.rcMonitor.top;
      info.width = mi.rcMonitor.right - mi.rcMonitor.left;
      info.height = mi.rcMonitor.bottom - mi.rcMonitor.top;
      info.scaleFactor = scale;

      d->monitors->push_back(info);
      d->index++;
      return TRUE;
    },
    reinterpret_cast<LPARAM>(&data)
  );

  return monitors;
}

#elif __APPLE__
#import <AppKit/AppKit.h>

static std::vector<MonitorInfo> EnumerateMonitors() {
  std::vector<MonitorInfo> monitors;

  NSArray<NSScreen*>* screens = [NSScreen screens];
  for (NSUInteger i = 0; i < [screens count]; i++) {
    NSScreen* screen = screens[i];
    NSRect frame = [screen frame];
    double scale = [screen backingScaleFactor];

    MonitorInfo info;
    info.id = std::to_string(static_cast<int>(i));
    info.x = static_cast<int>(frame.origin.x);
    info.y = static_cast<int>(frame.origin.y);
    info.width = static_cast<int>(frame.size.width);
    info.height = static_cast<int>(frame.size.height);
    info.scaleFactor = scale;

    monitors.push_back(info);
  }

  return monitors;
}

#else

static std::vector<MonitorInfo> EnumerateMonitors() {
  // Fallback: single monitor at origin
  MonitorInfo info;
  info.id = "0";
  info.x = 0;
  info.y = 0;
  info.width = 1920;
  info.height = 1080;
  info.scaleFactor = 1.0;
  return { info };
}

#endif

Napi::Value GetMonitorGeometry(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  std::vector<MonitorInfo> monitors = EnumerateMonitors();

  Napi::Array result = Napi::Array::New(env, monitors.size());
  for (size_t i = 0; i < monitors.size(); i++) {
    const MonitorInfo& m = monitors[i];
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("id", Napi::String::New(env, m.id));
    obj.Set("x", Napi::Number::New(env, m.x));
    obj.Set("y", Napi::Number::New(env, m.y));
    obj.Set("width", Napi::Number::New(env, m.width));
    obj.Set("height", Napi::Number::New(env, m.height));
    obj.Set("scaleFactor", Napi::Number::New(env, m.scaleFactor));
    result.Set(static_cast<uint32_t>(i), obj);
  }

  return result;
}
