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

/// Get the current system cursor as an RGBA bitmap with its hotspot offset.
/// Returns (rgba_pixels, width, height, hotspot_x, hotspot_y) or None.
#[cfg(target_os = "windows")]
fn get_system_cursor_bitmap() -> Option<(Vec<u8>, u32, u32, u32, u32)> {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;
    use windows_sys::Win32::Graphics::Gdi::*;
    unsafe {
        let mut ci: CURSORINFO = std::mem::zeroed();
        ci.cbSize = std::mem::size_of::<CURSORINFO>() as u32;
        if GetCursorInfo(&mut ci) == 0 || ci.hCursor == 0 { return None; }

        let mut ii: ICONINFO = std::mem::zeroed();
        if GetIconInfo(ci.hCursor, &mut ii) == 0 { return None; }

        let hotx = ii.xHotspot;
        let hoty = ii.yHotspot;

        // Get bitmap dimensions from the mask (always present)
        let mut bm: BITMAP = std::mem::zeroed();
        if GetObjectW(ii.hbmMask as isize, std::mem::size_of::<BITMAP>() as i32, &mut bm as *mut _ as *mut _) == 0 {
            if ii.hbmMask != 0 { DeleteObject(ii.hbmMask as isize); }
            if ii.hbmColor != 0 { DeleteObject(ii.hbmColor as isize); }
            return None;
        }

        let w = bm.bmWidth as u32;
        // If no color bitmap, mask is double-height (AND mask + XOR mask)
        let h = if ii.hbmColor != 0 { bm.bmHeight as u32 } else { bm.bmHeight as u32 / 2 };

        let hdc_screen = GetDC(0);
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbmp = CreateCompatibleBitmap(hdc_screen, w as i32, h as i32);
        let old = SelectObject(hdc_mem, hbmp as isize);

        // Clear to transparent black
        let brush = CreateSolidBrush(0x00000000);
        let rc = windows_sys::Win32::Foundation::RECT { left: 0, top: 0, right: w as i32, bottom: h as i32 };
        FillRect(hdc_mem, &rc, brush);
        DeleteObject(brush as isize);

        // Draw the cursor icon onto our DC
        DrawIconEx(hdc_mem, 0, 0, ci.hCursor, w as i32, h as i32, 0, 0, DI_NORMAL);

        // Read pixels back
        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = w as i32;
        bmi.bmiHeader.biHeight = -(h as i32); // top-down
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut pixels = vec![0u8; (w * h * 4) as usize];
        GetDIBits(hdc_mem, hbmp, 0, h, pixels.as_mut_ptr() as *mut _, &mut bmi, DIB_RGB_COLORS);

        SelectObject(hdc_mem, old);
        DeleteObject(hbmp as isize);
        DeleteDC(hdc_mem);
        ReleaseDC(0, hdc_screen);
        if ii.hbmMask != 0 { DeleteObject(ii.hbmMask as isize); }
        if ii.hbmColor != 0 { DeleteObject(ii.hbmColor as isize); }

        // Windows gives us BGRA, convert to RGBA and fix alpha
        // DrawIconEx on a 0-alpha surface leaves alpha=0 for cursor pixels on some drivers,
        // so we set alpha=255 for any pixel that has color data
        for i in (0..pixels.len()).step_by(4) {
            let b = pixels[i];
            let r = pixels[i + 2];
            pixels[i] = r;       // R
            pixels[i + 2] = b;   // B
            // If any color channel is non-zero, pixel is opaque
            if pixels[i] != 0 || pixels[i + 1] != 0 || pixels[i + 2] != 0 {
                pixels[i + 3] = 255;
            }
        }

        Some((pixels, w, h, hotx, hoty))
    }
}

/// Draw the system cursor onto the captured image at the given pixel position.
/// On Windows, uses the real cursor bitmap from the OS.
/// On other platforms, draws a simple arrow fallback.
fn draw_cursor_on_image(image: &mut image::RgbaImage, cx: u32, cy: u32, _scale: f64) {
    #[cfg(target_os = "windows")]
    {
        if let Some((pixels, cw, ch, hotx, hoty)) = get_system_cursor_bitmap() {
            let (iw, ih) = (image.width(), image.height());
            let ox = cx.saturating_sub(hotx);
            let oy = cy.saturating_sub(hoty);
            for row in 0..ch {
                for col in 0..cw {
                    let idx = ((row * cw + col) * 4) as usize;
                    let a = pixels[idx + 3];
                    if a == 0 { continue; }
                    let px = ox + col;
                    let py = oy + row;
                    if px < iw && py < ih {
                        let r = pixels[idx];
                        let g = pixels[idx + 1];
                        let b = pixels[idx + 2];
                        if a == 255 {
                            image.put_pixel(px, py, image::Rgba([r, g, b, 255]));
                        } else {
                            // Alpha blend
                            let dst = image.get_pixel(px, py);
                            let af = a as f32 / 255.0;
                            let inv = 1.0 - af;
                            image.put_pixel(px, py, image::Rgba([
                                (r as f32 * af + dst[0] as f32 * inv) as u8,
                                (g as f32 * af + dst[1] as f32 * inv) as u8,
                                (b as f32 * af + dst[2] as f32 * inv) as u8,
                                255,
                            ]));
                        }
                    }
                }
            }
            return;
        }
    }

    // Fallback for macOS/Linux or if Windows API fails
    draw_cursor_fallback(image, cx, cy, _scale);
}

/// Simple arrow cursor fallback for non-Windows platforms
fn draw_cursor_fallback(image: &mut image::RgbaImage, cx: u32, cy: u32, scale: f64) {
    let cursor: &[&[u8]] = &[
        &[2,0,0,0,0,0,0,0,0,0,0,0],
        &[2,2,0,0,0,0,0,0,0,0,0,0],
        &[2,1,2,0,0,0,0,0,0,0,0,0],
        &[2,1,1,2,0,0,0,0,0,0,0,0],
        &[2,1,1,1,2,0,0,0,0,0,0,0],
        &[2,1,1,1,1,2,0,0,0,0,0,0],
        &[2,1,1,1,1,1,2,0,0,0,0,0],
        &[2,1,1,1,1,1,1,2,0,0,0,0],
        &[2,1,1,1,1,1,1,1,2,0,0,0],
        &[2,1,1,1,1,1,1,1,1,2,0,0],
        &[2,1,1,1,1,1,1,1,1,1,2,0],
        &[2,1,1,1,1,1,1,2,2,2,2,0],
        &[2,1,1,1,2,1,1,2,0,0,0,0],
        &[2,1,1,2,0,2,1,1,2,0,0,0],
        &[2,1,2,0,0,2,1,1,2,0,0,0],
        &[2,2,0,0,0,0,2,1,1,2,0,0],
        &[0,0,0,0,0,0,2,1,1,2,0,0],
        &[0,0,0,0,0,0,0,2,2,0,0,0],
    ];
    let (w, h) = (image.width(), image.height());
    let cursor_h = cursor.len();
    let cursor_w = cursor[0].len();
    let scaled_w = (cursor_w as f64 * scale).round() as u32;
    let scaled_h = (cursor_h as f64 * scale).round() as u32;
    for py_out in 0..scaled_h {
        for px_out in 0..scaled_w {
            let src_row = (py_out as f64 / scale) as usize;
            let src_col = (px_out as f64 / scale) as usize;
            if src_row >= cursor_h || src_col >= cursor_w { continue; }
            let pixel = cursor[src_row][src_col];
            if pixel == 0 { continue; }
            let color = if pixel == 1 {
                image::Rgba([255, 255, 255, 255])
            } else {
                image::Rgba([0, 0, 0, 255])
            };
            let ix = cx + px_out;
            let iy = cy + py_out;
            if ix < w && iy < h {
                image.put_pixel(ix, iy, color);
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
