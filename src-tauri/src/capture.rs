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

/// Get the current system cursor as an RGBA bitmap with its hotspot offset.
/// Returns (rgba_pixels, width, height, hotspot_x, hotspot_y) or None.
#[cfg(target_os = "macos")]
fn get_system_cursor_bitmap() -> Option<(Vec<u8>, u32, u32, u32, u32)> {
    // NSCursor/NSBitmapImageRep live in AppKit, objc runtime functions in libobjc
    #[link(name = "AppKit", kind = "framework")]
    extern "C" {}
    extern "C" {
        fn objc_getClass(name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
        fn sel_registerName(name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
        fn objc_msgSend(receiver: *mut std::ffi::c_void, sel: *mut std::ffi::c_void, ...) -> *mut std::ffi::c_void;
    }
    #[repr(C)]
    #[derive(Copy, Clone)]
    struct NSSize { width: f64, height: f64 }
    #[repr(C)]
    #[derive(Copy, Clone)]
    struct NSPoint { x: f64, y: f64 }

    unsafe {
        // NSCursor *cursor = [NSCursor currentSystemCursor]
        let ns_cursor_class = objc_getClass(b"NSCursor\0".as_ptr() as *const _);
        if ns_cursor_class.is_null() { return None; }
        let sel_current = sel_registerName(b"currentSystemCursor\0".as_ptr() as *const _);
        let cursor = objc_msgSend(ns_cursor_class, sel_current);
        if cursor.is_null() { return None; }

        // NSImage *image = [cursor image]
        let sel_image = sel_registerName(b"image\0".as_ptr() as *const _);
        let ns_image = objc_msgSend(cursor, sel_image);
        if ns_image.is_null() { return None; }

        // NSPoint hotSpot = [cursor hotSpot]
        // hotSpot is a small struct returned in registers on arm64/x86_64
        extern "C" {
            #[link_name = "objc_msgSend"]
            fn objc_msgSend_point(receiver: *mut std::ffi::c_void, sel: *mut std::ffi::c_void) -> NSPoint;
            #[link_name = "objc_msgSend"]
            fn objc_msgSend_size(receiver: *mut std::ffi::c_void, sel: *mut std::ffi::c_void) -> NSSize;
        }
        let sel_hotspot = sel_registerName(b"hotSpot\0".as_ptr() as *const _);
        let hotspot = objc_msgSend_point(cursor, sel_hotspot);

        // NSSize size = [ns_image size]
        let sel_size = sel_registerName(b"size\0".as_ptr() as *const _);
        let size = objc_msgSend_size(ns_image, sel_size);
        let w = size.width as u32;
        let h = size.height as u32;
        if w == 0 || h == 0 { return None; }

        // Get the best representation for the cursor
        // NSBitmapImageRep *rep = [[NSBitmapImageRep alloc] initWithData:[ns_image TIFFRepresentation]]
        let sel_tiff = sel_registerName(b"TIFFRepresentation\0".as_ptr() as *const _);
        let tiff_data = objc_msgSend(ns_image, sel_tiff);
        if tiff_data.is_null() { return None; }

        let bmp_class = objc_getClass(b"NSBitmapImageRep\0".as_ptr() as *const _);
        if bmp_class.is_null() { return None; }
        let sel_alloc = sel_registerName(b"alloc\0".as_ptr() as *const _);
        let sel_init_data = sel_registerName(b"initWithData:\0".as_ptr() as *const _);
        let bmp_alloc = objc_msgSend(bmp_class, sel_alloc);
        let bmp_rep = objc_msgSend(bmp_alloc, sel_init_data, tiff_data);
        if bmp_rep.is_null() { return None; }

        // Get pixel dimensions (may differ from logical size on Retina)
        let sel_pw = sel_registerName(b"pixelsWide\0".as_ptr() as *const _);
        let sel_ph = sel_registerName(b"pixelsHigh\0".as_ptr() as *const _);
        let sel_bdata = sel_registerName(b"bitmapData\0".as_ptr() as *const _);
        let sel_bpr = sel_registerName(b"bytesPerRow\0".as_ptr() as *const _);
        let sel_spp = sel_registerName(b"samplesPerPixel\0".as_ptr() as *const _);

        extern "C" {
            #[link_name = "objc_msgSend"]
            fn objc_msgSend_isize(receiver: *mut std::ffi::c_void, sel: *mut std::ffi::c_void) -> isize;
        }

        let pw = objc_msgSend_isize(bmp_rep, sel_pw) as u32;
        let ph = objc_msgSend_isize(bmp_rep, sel_ph) as u32;
        let bpr = objc_msgSend_isize(bmp_rep, sel_bpr) as u32;
        let spp = objc_msgSend_isize(bmp_rep, sel_spp) as u32;
        let bdata = objc_msgSend(bmp_rep, sel_bdata) as *const u8;
        if bdata.is_null() || pw == 0 || ph == 0 { return None; }

        // Copy pixel data to RGBA
        let mut rgba = vec![0u8; (pw * ph * 4) as usize];
        for row in 0..ph {
            for col in 0..pw {
                let src = (row * bpr + col * spp) as usize;
                let dst = ((row * pw + col) * 4) as usize;
                if spp >= 4 {
                    rgba[dst] = *bdata.add(src);
                    rgba[dst + 1] = *bdata.add(src + 1);
                    rgba[dst + 2] = *bdata.add(src + 2);
                    rgba[dst + 3] = *bdata.add(src + 3);
                } else if spp >= 3 {
                    rgba[dst] = *bdata.add(src);
                    rgba[dst + 1] = *bdata.add(src + 1);
                    rgba[dst + 2] = *bdata.add(src + 2);
                    rgba[dst + 3] = 255;
                }
            }
        }

        // Scale hotspot from logical to pixel coords
        let scale_x = pw as f64 / w as f64;
        let scale_y = ph as f64 / h as f64;
        let hotx = (hotspot.x * scale_x).round() as u32;
        let hoty = (hotspot.y * scale_y).round() as u32;

        // Release the bitmap rep
        let sel_release = sel_registerName(b"release\0".as_ptr() as *const _);
        objc_msgSend(bmp_rep, sel_release);

        Some((rgba, pw, ph, hotx, hoty))
    }
}

/// Get the current system cursor as an RGBA bitmap with its hotspot offset.
/// Uses XFixesGetCursorImage which returns the cursor pixels directly.
#[cfg(target_os = "linux")]
fn get_system_cursor_bitmap() -> Option<(Vec<u8>, u32, u32, u32, u32)> {
    #[repr(C)]
    struct XFixesCursorImage {
        x: i16,
        y: i16,
        width: u16,
        height: u16,
        xhot: u16,
        yhot: u16,
        cursor_serial: u64,
        pixels: *const u64, // actually unsigned long (ARGB per pixel)
        atom: u64,
        name: *const std::ffi::c_char,
    }
    #[link(name = "X11")]
    extern "C" {
        fn XOpenDisplay(name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
        fn XCloseDisplay(display: *mut std::ffi::c_void) -> i32;
        fn XFree(data: *mut std::ffi::c_void) -> i32;
    }
    #[link(name = "Xfixes")]
    extern "C" {
        fn XFixesQueryExtension(display: *mut std::ffi::c_void, event_base: *mut i32, error_base: *mut i32) -> i32;
        fn XFixesGetCursorImage(display: *mut std::ffi::c_void) -> *mut XFixesCursorImage;
    }
    unsafe {
        let display = XOpenDisplay(std::ptr::null());
        if display.is_null() { return None; }

        let mut event_base = 0i32;
        let mut error_base = 0i32;
        if XFixesQueryExtension(display, &mut event_base, &mut error_base) == 0 {
            XCloseDisplay(display);
            return None;
        }

        let img = XFixesGetCursorImage(display);
        if img.is_null() {
            XCloseDisplay(display);
            return None;
        }

        let w = (*img).width as u32;
        let h = (*img).height as u32;
        let hotx = (*img).xhot as u32;
        let hoty = (*img).yhot as u32;

        // XFixesCursorImage pixels are unsigned long (8 bytes on 64-bit) with ARGB format
        let mut rgba = vec![0u8; (w * h * 4) as usize];
        for i in 0..(w * h) as usize {
            let pixel = *(*img).pixels.add(i) as u32;
            let a = ((pixel >> 24) & 0xFF) as u8;
            let r = ((pixel >> 16) & 0xFF) as u8;
            let g = ((pixel >> 8) & 0xFF) as u8;
            let b = (pixel & 0xFF) as u8;
            let dst = i * 4;
            rgba[dst] = r;
            rgba[dst + 1] = g;
            rgba[dst + 2] = b;
            rgba[dst + 3] = a;
        }

        XFree(img as *mut _);
        XCloseDisplay(display);

        Some((rgba, w, h, hotx, hoty))
    }
}

/// Composite an RGBA cursor bitmap onto the screenshot image with alpha blending.
fn blit_cursor(image: &mut image::RgbaImage, pixels: &[u8], cw: u32, ch: u32, cx: u32, cy: u32, hotx: u32, hoty: u32) {
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
            if px >= iw || py >= ih { continue; }
            let r = pixels[idx];
            let g = pixels[idx + 1];
            let b = pixels[idx + 2];
            if a == 255 {
                image.put_pixel(px, py, image::Rgba([r, g, b, 255]));
            } else {
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

/// Draw the system cursor onto the captured image at the given pixel position.
/// Uses the real cursor bitmap from the OS on all platforms.
/// Falls back to a simple arrow if the native API fails.
fn draw_cursor_on_image(image: &mut image::RgbaImage, cx: u32, cy: u32, _scale: f64) {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        if let Some((pixels, cw, ch, hotx, hoty)) = get_system_cursor_bitmap() {
            blit_cursor(image, &pixels, cw, ch, cx, cy, hotx, hoty);
            return;
        }
    }

    // Fallback if native API fails
    draw_cursor_fallback(image, cx, cy, _scale);
}

/// Simple arrow cursor fallback
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
