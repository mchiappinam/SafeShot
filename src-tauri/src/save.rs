use base64::Engine;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
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
    // Use Pictures directory on all platforms
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
        // Hide overlay first so the save dialog isn't obscured by the frozen screen
        if let Some(win) = app_handle.get_webview_window("overlay") {
            win.hide().ok();
        }
        // Brief pause to let the window fully hide before the blocking dialog opens
        std::thread::sleep(std::time::Duration::from_millis(100));

        let default_name = timestamp_filename();
        let dialog = rfd::FileDialog::new()
            .set_file_name(&default_name)
            .set_directory(&dir)
            .add_filter("PNG Image", &["png"]);
        match dialog.save_file() {
            Some(path) => {
                let result = match fs::write(&path, &png_bytes) {
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
                // Close overlay after dialog is done
                if let Some(win) = app_handle.get_webview_window("overlay") {
                    win.close().ok();
                }
                return result;
            }
            None => {
                // User cancelled - show overlay again
                if let Some(win) = app_handle.get_webview_window("overlay") {
                    win.show().ok();
                    win.set_focus().ok();
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
    }
}

#[tauri::command]
pub fn copy_to_clipboard(image_data_url: String) -> Result<(), String> {
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

    Ok(())
}
