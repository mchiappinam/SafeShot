#include <napi.h>

// Forward declarations from other translation units
Napi::Value GetMonitorScaleFactor(const Napi::CallbackInfo& info);
Napi::Value GetMonitorGeometry(const Napi::CallbackInfo& info);

#ifdef _WIN32
Napi::Value ReadRegistryDwordJs(const Napi::CallbackInfo& info);
Napi::Value WriteRegistryDwordJs(const Napi::CallbackInfo& info);
#endif

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(
    Napi::String::New(env, "getMonitorScaleFactor"),
    Napi::Function::New(env, GetMonitorScaleFactor)
  );
  exports.Set(
    Napi::String::New(env, "getMonitorGeometry"),
    Napi::Function::New(env, GetMonitorGeometry)
  );

#ifdef _WIN32
  exports.Set(
    Napi::String::New(env, "readRegistryDword"),
    Napi::Function::New(env, ReadRegistryDwordJs)
  );
  exports.Set(
    Napi::String::New(env, "writeRegistryDword"),
    Napi::Function::New(env, WriteRegistryDwordJs)
  );
#endif

  return exports;
}

NODE_API_MODULE(safeshot_native, Init)
