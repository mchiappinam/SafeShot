use base64::Engine;
use screenshots::Screen;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

#[derive(Serialize, Clone)]
pub struct ScreenData {
    pub display_id: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub image_data_url: String,
}

/// Holds pre-captured screen data so the overlay window doesn't capture itself.
pub struct CaptureCache(pub Mutex<Vec<ScreenData>>);

/// Capture all screens right now (called from Rust before the overlay opens).
pub fn do_capture() -> Result<Vec<ScreenData>, String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    for screen in screens {
        let image = screen.capture().map_err(|e| e.to_string())?;
        let mut png_bytes = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
        image::ImageEncoder::write_image(
            encoder,
            image.as_raw(),
            image.width(),
            image.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| e.to_string())?;

        let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
        let data_url = format!("data:image/png;base64,{}", b64);

        let info = screen.display_info;
        results.push(ScreenData {
            display_id: info.id.to_string(),
            x: info.x,
            y: info.y,
            width: info.width,
            height: info.height,
            scale_factor: info.scale_factor as f64,
            image_data_url: data_url,
        });
    }

    results.sort_by(|a, b| a.x.cmp(&b.x).then(a.y.cmp(&b.y)));
    Ok(results)
}

/// Frontend calls this to get the pre-captured data.
#[tauri::command]
pub fn capture_screens(cache: State<'_, CaptureCache>) -> Result<Vec<ScreenData>, String> {
    let data = cache.0.lock().map_err(|e| e.to_string())?;
    if data.is_empty() {
        return Err("No capture data available".into());
    }
    Ok(data.clone())
}
