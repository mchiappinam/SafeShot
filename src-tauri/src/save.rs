use base64::Engine;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_notification::NotificationExt;
use chrono;

#[derive(Serialize)]
pub struct SaveResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub error: Option<String>,
}

pub fn config_path() -> PathBuf {
    let mut dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("SafeShot");
    fs::create_dir_all(&dir).ok();
    dir.push("config.json");
    dir
}

fn should_notify() -> bool {
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            return json.get("showNotifications")
                .and_then(|v| v.as_bool().or_else(|| v.as_str().map(|s| s == "true")))
                .unwrap_or(true);
        }
    }
    true
}

fn send_notification(app: &tauri::AppHandle, title: &str, body: &str) {
    if !should_notify() { return; }
    app.notification()
        .builder()
        .id(1)
        .title(title)
        .body(body)
        .auto_cancel()
        .show()
        .ok();
    // Auto-dismiss after 3 seconds by replacing with a silent empty notification
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        dismiss_notification(&handle);
    });
}

pub fn dismiss_notification(app: &tauri::AppHandle) {
    // Skip on Linux — empty replacement notification may flash as a visible bubble
    if cfg!(target_os = "linux") { return; }
    app.notification()
        .builder()
        .id(1)
        .title("")
        .body("")
        .silent()
        .show()
        .ok();
}

#[tauri::command]
pub fn get_last_color() -> String {
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(color) = json.get("lastColor").and_then(|v| v.as_str()) {
                return color.to_string();
            }
        }
    }
    String::new()
}

#[tauri::command]
pub fn set_last_color(color: String) {
    let path = config_path();
    let mut json = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    json["lastColor"] = serde_json::json!(color);
    fs::write(
        &path,
        serde_json::to_string_pretty(&json).unwrap_or_default(),
    )
    .ok();
}

#[tauri::command]
pub fn get_last_thickness() -> u32 {
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(t) = json.get("lastThickness").and_then(|v| v.as_u64()) {
                return t as u32;
            }
        }
    }
    4
}

#[tauri::command]
pub fn set_last_thickness(thickness: u32) {
    let path = config_path();
    let mut json = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    json["lastThickness"] = serde_json::json!(thickness);
    fs::write(
        &path,
        serde_json::to_string_pretty(&json).unwrap_or_default(),
    )
    .ok();
}

#[tauri::command]
pub fn get_fill_mode() -> String {
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(mode) = json.get("fillMode").and_then(|v| v.as_str()) {
                return mode.to_string();
            }
        }
    }
    "hollow".to_string()
}

#[tauri::command]
pub fn set_fill_mode(mode: String) {
    let path = config_path();
    let mut json = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    json["fillMode"] = serde_json::json!(mode);
    fs::write(&path, serde_json::to_string_pretty(&json).unwrap_or_default()).ok();
}

#[tauri::command]
pub fn get_last_tool() -> String {
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(tool) = json.get("lastTool").and_then(|v| v.as_str()) {
                return tool.to_string();
            }
        }
    }
    String::new()
}

#[tauri::command]
pub fn set_last_tool(tool: String) {
    let path = config_path();
    let mut json = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    json["lastTool"] = serde_json::json!(tool);
    fs::write(&path, serde_json::to_string_pretty(&json).unwrap_or_default()).ok();
}

#[tauri::command]
pub fn get_text_settings() -> serde_json::Value {
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(ts) = json.get("textSettings") {
                return ts.clone();
            }
        }
    }
    serde_json::json!({})
}

#[tauri::command]
pub fn set_text_settings(settings: serde_json::Value) {
    let path = config_path();
    let mut json = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    json["textSettings"] = settings;
    fs::write(&path, serde_json::to_string_pretty(&json).unwrap_or_default()).ok();
}

pub fn get_save_directory() -> String {
    // Check if user set a custom quick save directory
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(dir) = json.get("quickSaveDir").and_then(|v| v.as_str()) {
                if std::path::Path::new(dir).exists() {
                    return dir.to_string();
                }
            }
        }
    }
    // Default: Pictures/SafeShot
    let base = dirs::picture_dir().unwrap_or_else(|| {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Pictures")
    });
    base.join("SafeShot").to_string_lossy().to_string()
}

fn timestamp_filename() -> String {
    let now = chrono::Local::now();
    format!("SafeShot_{}.png", now.format("%Y-%m-%d_%H-%M-%S"))
}

#[tauri::command]
pub fn get_next_filename() -> String {
    timestamp_filename()
}

fn decode_data_url(image_data_url: &str) -> Result<Vec<u8>, String> {
    let b64 = image_data_url
        .strip_prefix("data:image/png;base64,")
        .unwrap_or(image_data_url);
    base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| e.to_string())
}

fn get_last_save_dir() -> String {
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(dir) = json.get("lastSaveDir").and_then(|v| v.as_str()) {
                if std::path::Path::new(dir).exists() {
                    return dir.to_string();
                }
            }
        }
    }
    get_save_directory()
}

fn set_last_save_dir(dir: &str) {
    let path = config_path();
    let mut json = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    json["lastSaveDir"] = serde_json::json!(dir);
    fs::write(&path, serde_json::to_string_pretty(&json).unwrap_or_default()).ok();
}

#[tauri::command]
pub fn get_settings() -> serde_json::Value {
    let path = config_path();
    let json = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    let default_dir = get_save_directory();
    let default_hotkey = if cfg!(target_os = "macos") { "Meta+Shift+KeyS" } else { "PrintScreen" };
    serde_json::json!({
        "quickSaveDir": json.get("quickSaveDir").and_then(|v| v.as_str()).unwrap_or(&default_dir),
        "lastSaveDir": json.get("lastSaveDir").and_then(|v| v.as_str()).unwrap_or(&default_dir),
        "hotkey": json.get("hotkey").and_then(|v| v.as_str()).unwrap_or(default_hotkey),
        "captureCursor": json.get("captureCursor").and_then(|v| v.as_bool().or_else(|| v.as_str().map(|s| s == "true"))).unwrap_or(false),
        "selectionPreset": json.get("selectionPreset").and_then(|v| v.as_str()).unwrap_or("custom"),
        "showNotifications": json.get("showNotifications").and_then(|v| v.as_bool().or_else(|| v.as_str().map(|s| s == "true"))).unwrap_or(true),
    })
}

#[tauri::command]
pub fn set_setting(key: String, value: String) {
    let allowed = ["quickSaveDir", "lastSaveDir", "hotkey", "captureCursor", "selectionPreset", "showNotifications"];
    if !allowed.contains(&key.as_str()) { return; }
    let path = config_path();
    let mut json = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    json[&key] = serde_json::json!(value);
    fs::write(&path, serde_json::to_string_pretty(&json).unwrap_or_default()).ok();
}

#[tauri::command]
pub fn get_last_selection() -> serde_json::Value {
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(sel) = json.get("lastSelection") {
                return sel.clone();
            }
        }
    }
    serde_json::json!(null)
}

#[tauri::command]
pub fn set_last_selection(x: f64, y: f64, width: f64, height: f64) {
    let path = config_path();
    let mut json = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    json["lastSelection"] = serde_json::json!({ "x": x, "y": y, "width": width, "height": height });
    fs::write(&path, serde_json::to_string_pretty(&json).unwrap_or_default()).ok();
}

#[tauri::command]
pub fn pick_folder(app_handle: tauri::AppHandle) -> Option<String> {
    {
        let flag = app_handle.state::<crate::DialogActive>();
        *flag.0.lock().unwrap() = true;
    }
    let result = rfd::FileDialog::new().pick_folder().map(|p| p.to_string_lossy().to_string());
    {
        let flag = app_handle.state::<crate::DialogActive>();
        *flag.0.lock().unwrap() = false;
    }
    result
}

#[tauri::command]
pub fn save_screenshot(
    image_data_url: String,
    show_dialog: bool,
    app_handle: tauri::AppHandle,
) -> SaveResult {
    let dir = get_save_directory();
    if let Err(e) = fs::create_dir_all(&dir) {
        return SaveResult {
            success: false,
            file_path: None,
            error: Some(e.to_string()),
        };
    }

    let png_bytes = match decode_data_url(&image_data_url) {
        Ok(bytes) => bytes,
        Err(e) => {
            return SaveResult {
                success: false,
                file_path: None,
                error: Some(e),
            }
        }
    };

    if show_dialog {
        // Close overlay before opening the dialog so it can't obscure it
        if let Some(win) = app_handle.get_webview_window("overlay") {
            win.close().ok();
        }

        {
            let flag = app_handle.state::<crate::DialogActive>();
            *flag.0.lock().unwrap() = true;
        }

        let default_name = timestamp_filename();
        let save_dir = get_last_save_dir();
        let dialog = rfd::FileDialog::new()
            .set_file_name(&default_name)
            .set_directory(&save_dir)
            .add_filter("PNG Image", &["png"]);
        match dialog.save_file() {
            Some(path) => {
                if let Some(parent) = path.parent() {
                    set_last_save_dir(&parent.to_string_lossy());
                }
                {
                    let flag = app_handle.state::<crate::DialogActive>();
                    *flag.0.lock().unwrap() = false;
                }
                return match fs::write(&path, &png_bytes) {
                    Ok(_) => SaveResult {
                        success: true,
                        file_path: Some(path.to_string_lossy().to_string()),
                        error: None,
                    },
                    Err(e) => SaveResult {
                        success: false,
                        file_path: None,
                        error: Some(e.to_string()),
                    },
                };
            }
            None => {
                {
                    let flag = app_handle.state::<crate::DialogActive>();
                    *flag.0.lock().unwrap() = false;
                }
                return SaveResult {
                    success: false,
                    file_path: None,
                    error: Some("Cancelled".into()),
                };
            }
        }
    }

    let filename = timestamp_filename();
    let path = PathBuf::from(&dir).join(&filename);

    match fs::write(&path, &png_bytes) {
        Ok(_) => {
            let short_dir = std::path::Path::new(&dir)
                .components()
                .rev()
                .take(2)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<PathBuf>()
                .to_string_lossy()
                .to_string();
            send_notification(&app_handle, "Screenshot saved ✓", &format!("Saved to {}", short_dir));
            SaveResult {
                success: true,
                file_path: Some(path.to_string_lossy().to_string()),
                error: None,
            }
        }
        Err(e) => SaveResult {
            success: false,
            file_path: None,
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn copy_to_clipboard(image_data_url: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let png_bytes = decode_data_url(&image_data_url)?;
    let img = image::load_from_memory(&png_bytes).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    use arboard::Clipboard;
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    let img_data = arboard::ImageData {
        width: w as usize,
        height: h as usize,
        bytes: std::borrow::Cow::Borrowed(rgba.as_raw()),
    };
    clipboard.set_image(img_data).map_err(|e| e.to_string())?;
    let paste_hint = if cfg!(target_os = "macos") {
        "Paste it anywhere with ⌘V."
    } else {
        "Paste it anywhere with Ctrl+V."
    };
    send_notification(&app_handle, "Screenshot copied ✓", paste_hint);

    Ok(())
}
