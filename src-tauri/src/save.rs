use base64::Engine;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct SaveResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub error: Option<String>,
}

pub fn get_save_directory() -> String {
    let base = if cfg!(target_os = "macos") {
        dirs::picture_dir().unwrap_or_else(|| PathBuf::from("."))
    } else {
        dirs::home_dir()
            .map(|h| h.join("Images"))
            .unwrap_or_else(|| PathBuf::from("."))
    };
    base.join("SafeShot").to_string_lossy().to_string()
}

fn get_next_n(directory: &str) -> u32 {
    let mut max_n = 0u32;
    if let Ok(entries) = fs::read_dir(directory) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if let Some(rest) = name.strip_prefix("Screenshot_") {
                if let Some(num_str) = rest.strip_suffix(".png") {
                    if let Ok(n) = num_str.parse::<u32>() {
                        max_n = max_n.max(n);
                    }
                }
            }
        }
    }
    max_n + 1
}

#[tauri::command]
pub fn get_next_filename() -> String {
    let dir = get_save_directory();
    format!("Screenshot_{}.png", get_next_n(&dir))
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
pub fn save_screenshot(image_data_url: String, show_dialog: bool) -> SaveResult {
    let dir = get_save_directory();
    if let Err(e) = fs::create_dir_all(&dir) {
        return SaveResult { success: false, file_path: None, error: Some(e.to_string()) };
    }

    let png_bytes = match decode_data_url(&image_data_url) {
        Ok(bytes) => bytes,
        Err(e) => return SaveResult { success: false, file_path: None, error: Some(e) },
    };

    if show_dialog {
        // Use rfd for native save-as dialog
        let default_name = format!("Screenshot_{}.png", get_next_n(&dir));
        let dialog = rfd::FileDialog::new()
            .set_file_name(&default_name)
            .set_directory(&dir)
            .add_filter("PNG Image", &["png"]);
        match dialog.save_file() {
            Some(path) => {
                return match fs::write(&path, &png_bytes) {
                    Ok(_) => SaveResult { success: true, file_path: Some(path.to_string_lossy().to_string()), error: None },
                    Err(e) => SaveResult { success: false, file_path: None, error: Some(e.to_string()) },
                };
            }
            None => return SaveResult { success: false, file_path: None, error: Some("Cancelled".into()) },
        }
    }

    let filename = format!("Screenshot_{}.png", get_next_n(&dir));
    let path = PathBuf::from(&dir).join(&filename);

    match fs::write(&path, &png_bytes) {
        Ok(_) => SaveResult { success: true, file_path: Some(path.to_string_lossy().to_string()), error: None },
        Err(e) => SaveResult { success: false, file_path: None, error: Some(e.to_string()) },
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
    clipboard.set_image(img_data).map_err(|e| e.to_string())
}
