#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <string>
#include <napi.h>

// Reads a DWORD registry value. Returns -1 on failure.
static DWORD ReadRegistryDword(HKEY hive, const std::wstring& subKey, const std::wstring& valueName) {
  HKEY hKey = nullptr;
  if (RegOpenKeyExW(hive, subKey.c_str(), 0, KEY_READ, &hKey) != ERROR_SUCCESS) {
    return static_cast<DWORD>(-1);
  }

  DWORD data = 0;
  DWORD dataSize = sizeof(DWORD);
  DWORD type = REG_DWORD;
  LSTATUS status = RegQueryValueExW(hKey, valueName.c_str(), nullptr, &type,
                                    reinterpret_cast<LPBYTE>(&data), &dataSize);
  RegCloseKey(hKey);

  return (status == ERROR_SUCCESS) ? data : static_cast<DWORD>(-1);
}

// Writes a DWORD registry value. Returns true on success.
static bool WriteRegistryDword(HKEY hive, const std::wstring& subKey,
                                const std::wstring& valueName, DWORD value) {
  HKEY hKey = nullptr;
  LSTATUS status = RegCreateKeyExW(hive, subKey.c_str(), 0, nullptr,
                                   REG_OPTION_NON_VOLATILE, KEY_WRITE, nullptr,
                                   &hKey, nullptr);
  if (status != ERROR_SUCCESS) return false;

  status = RegSetValueExW(hKey, valueName.c_str(), 0, REG_DWORD,
                          reinterpret_cast<const BYTE*>(&value), sizeof(DWORD));
  RegCloseKey(hKey);
  return status == ERROR_SUCCESS;
}

// Exported: readRegistryDword(hive: 'HKCU'|'HKLM', subKey: string, valueName: string): number
Napi::Value ReadRegistryDwordJs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Expected (hive, subKey, valueName)").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string hiveStr = info[0].As<Napi::String>().Utf8Value();
  std::wstring subKey(info[1].As<Napi::String>().Utf16Value().begin(),
                      info[1].As<Napi::String>().Utf16Value().end());
  std::wstring valueName(info[2].As<Napi::String>().Utf16Value().begin(),
                         info[2].As<Napi::String>().Utf16Value().end());

  HKEY hive = (hiveStr == "HKLM") ? HKEY_LOCAL_MACHINE : HKEY_CURRENT_USER;
  DWORD result = ReadRegistryDword(hive, subKey, valueName);
  return Napi::Number::New(env, static_cast<double>(static_cast<int32_t>(result)));
}

// Exported: writeRegistryDword(hive: 'HKCU'|'HKLM', subKey: string, valueName: string, value: number): boolean
Napi::Value WriteRegistryDwordJs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 4) {
    Napi::TypeError::New(env, "Expected (hive, subKey, valueName, value)").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string hiveStr = info[0].As<Napi::String>().Utf8Value();
  std::wstring subKey(info[1].As<Napi::String>().Utf16Value().begin(),
                      info[1].As<Napi::String>().Utf16Value().end());
  std::wstring valueName(info[2].As<Napi::String>().Utf16Value().begin(),
                         info[2].As<Napi::String>().Utf16Value().end());
  DWORD value = static_cast<DWORD>(info[3].As<Napi::Number>().Int32Value());

  HKEY hive = (hiveStr == "HKLM") ? HKEY_LOCAL_MACHINE : HKEY_CURRENT_USER;
  bool ok = WriteRegistryDword(hive, subKey, valueName, value);
  return Napi::Boolean::New(env, ok);
}

#endif // _WIN32
