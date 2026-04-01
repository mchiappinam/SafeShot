{
  "targets": [
    {
      "target_name": "safeshot_native",
      "sources": [
        "src/addon.cc",
        "src/dpi_query.cc",
        "src/monitor_geometry.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "sources": ["src/registry.cc"],
          "libraries": ["-luser32.lib", "-lshcore.lib"],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "OTHER_LDFLAGS": ["-framework AppKit"],
            "MACOSX_DEPLOYMENT_TARGET": "10.13"
          }
        }]
      ]
    }
  ]
}
