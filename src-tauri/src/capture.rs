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
    pub native_width: u32,
    pub native_height: u32,
    pub image_data_url: String,
}

/// Holds pre-captured screen data so the overlay window doesn't capture itself.
pub struct CaptureCache(pub Mutex<Vec<ScreenData>>);

/// Get the current mouse cursor position (screen coordinates)
fn get_cursor_position() -> Option<(i32, i32)> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;
        use windows_sys::Win32::Foundation::POINT;
        let mut point = POINT { x: 0, y: 0 };
        unsafe {
            if GetCursorPos(&mut point) != 0 {
                return Some((point.x, point.y));
            }
        }
        None
    }
    #[cfg(target_os = "macos")]
    {
        #[link(name = "CoreGraphics", kind = "framework")]
        extern "C" {
            fn CGEventCreate(source: *const std::ffi::c_void) -> *const std::ffi::c_void;
            fn CGEventGetLocation(event: *const std::ffi::c_void) -> CGPoint;
        }
        #[link(name = "CoreFoundation", kind = "framework")]
        extern "C" {
            fn CFRelease(cf: *const std::ffi::c_void);
        }
        #[repr(C)]
        #[derive(Copy, Clone)]
        struct CGPoint { x: f64, y: f64 }
        unsafe {
            let event = CGEventCreate(std::ptr::null());
            if event.is_null() { return None; }
            let point = CGEventGetLocation(event);
            CFRelease(event);
            Some((point.x as i32, point.y as i32))
        }
    }
    #[cfg(target_os = "linux")]
    {
        #[link(name = "X11")]
        extern "C" {
            fn XOpenDisplay(name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
            fn XDefaultRootWindow(display: *mut std::ffi::c_void) -> u64;
            fn XQueryPointer(
                display: *mut std::ffi::c_void, window: u64,
                root_return: *mut u64, child_return: *mut u64,
                root_x: *mut i32, root_y: *mut i32,
                win_x: *mut i32, win_y: *mut i32,
                mask: *mut u32,
            ) -> i32;
            fn XCloseDisplay(display: *mut std::ffi::c_void) -> i32;
        }
        unsafe {
            let display = XOpenDisplay(std::ptr::null());
            if display.is_null() { return None; }
            let root = XDefaultRootWindow(display);
            let (mut root_ret, mut child_ret) = (0u64, 0u64);
            let (mut rx, mut ry, mut wx, mut wy) = (0i32, 0i32, 0i32, 0i32);
            let mut mask = 0u32;
            let ok = XQueryPointer(display, root, &mut root_ret, &mut child_ret, &mut rx, &mut ry, &mut wx, &mut wy, &mut mask);
            XCloseDisplay(display);
            if ok != 0 { Some((rx, ry)) } else { None }
        }
    }
}

/// Draw a simple arrow cursor onto an RGBA image buffer at the given pixel position.
/// The cursor is scaled to match HiDPI displays.
fn draw_cursor_on_image(image: &mut image::RgbaImage, cx: u32, cy: u32, scale: f64) {
    // Standard arrow cursor shape (16x24 logical pixels, matches real cursor proportions)
    // 1 = white fill, 2 = black border, 0 = transparent
    let cursor: &[&[u8]] = &[
        &[2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        &[2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        &[2,1,2,0,0,0,0,0,0,0,0,0,0,0,0,0],
        &[2,1,1,2,0,0,0,0,0,0,0,0,0,0,0,0],
        &[2,1,1,1,2,0,0,0,0,0,0,0,0,0,0,0],
        &[2,1,1,1,1,2,0,0,0,0,0,0,0,0,0,0],
        &[2,1,1,1,1,1,2,0,0,0,0,0,0,0,0,0],
        &[2,1,1,1,1,1,1,2,0,0,0,0,0,0,0,0],
        &[2,1,1,1,1,1,1,1,2,0,0,0,0,0,0,0],
        &[2,1,1,1,1,1,1,1,1,2,0,0,0,0,0,0],
        &[2,1,1,1,1,1,1,1,1,1,2,0,0,0,0,0],
        &[2,1,1,1,1,1,1,1,1,1,1,2,0,0,0,0],
        &[2,1,1,1,1,1,1,1,1,1,1,1,2,0,0,0],
        &[2,1,1,1,1,1,1,1,1,2,2,2,2,2,0,0],
        &[2,1,1,1,1,1,2,1,1,2,0,0,0,0,0,0],
        &[2,1,1,1,1,2,0,2,1,1,2,0,0,0,0,0],
        &[2,1,1,1,2,0,0,2,1,1,2,0,0,0,0,0],
        &[2,1,1,2,0,0,0,0,2,1,1,2,0,0,0,0],
        &[2,1,2,0,0,0,0,0,2,1,1,2,0,0,0,0],
        &[2,2,0,0,0,0,0,0,0,2,1,1,2,0,0,0],
        &[2,0,0,0,0,0,0,0,0,2,1,1,2,0,0,0],
        &[0,0,0,0,0,0,0,0,0,0,2,1,2,0,0,0],
        &[0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0],
    ];
    let s = scale.ceil().max(2.0) as u32;
    let (w, h) = (image.width(), image.height());
    for (row, line) in cursor.iter().enumerate() {
        for (col, &pixel) in line.iter().enumerate() {
            if pixel == 0 { continue; }
            let color = if pixel == 1 {
                image::Rgba([255, 255, 255, 255])
            } else {
                image::Rgba([0, 0, 0, 255])
            };
            // Draw a scaled block for each cursor pixel
            for dy in 0..s {
                for dx in 0..s {
                    let px = cx + col as u32 * s + dx;
                    let py = cy + row as u32 * s + dy;
                    if px < w && py < h {
                        image.put_pixel(px, py, color);
                    }
                }
            }
        }
    }
}

/// Capture all screens right now (called from Rust before the overlay opens).
pub fn do_capture() -> Result<Vec<ScreenData>, String> {
    // Check if cursor capture is enabled
    let capture_cursor = {
        let path = crate::save::config_path();
        if let Ok(data) = std::fs::read_to_string(&path) {
            serde_json::from_str::<serde_json::Value>(&data)
                .ok()
                .and_then(|j| j.get("captureCursor").and_then(|v| v.as_bool().or_else(|| v.as_str().map(|s| s == "true"))))
                .unwrap_or(false)
        } else {
            false
        }
    };
    let cursor_pos = if capture_cursor { get_cursor_position() } else { None };

    let screens = Screen::all().map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    for screen in screens {
        let captured = screen.capture().map_err(|e| e.to_string())?;
        let info = screen.display_info;
        let (cw, ch) = (captured.width(), captured.height());
        // Convert from screenshots' image type to our image crate version
        let mut image = image::RgbaImage::from_raw(cw, ch, captured.into_raw())
            .ok_or_else(|| "Failed to convert captured image".to_string())?;

        // Draw cursor if it's on this screen
        if let Some((cx, cy)) = cursor_pos {
            let sx = info.x;
            let sy = info.y;
            let sw = info.width as i32;
            let sh = info.height as i32;
            if cx >= sx && cx < sx + sw && cy >= sy && cy < sy + sh {
                let scale = image.width() as f64 / info.width as f64;
                let px = ((cx - sx) as f64 * scale) as u32;
                let py = ((cy - sy) as f64 * scale) as u32;
                draw_cursor_on_image(&mut image, px, py, scale);
            }
        }

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

        results.push(ScreenData {
            display_id: info.id.to_string(),
            x: info.x,
            y: info.y,
            width: info.width,
            height: info.height,
            scale_factor: info.scale_factor as f64,
            native_width: image.width(),
            native_height: image.height(),
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
