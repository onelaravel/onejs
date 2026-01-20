# Scripts Directory

Thư mục này chứa các script Python để build và compile Blade templates.

## Cấu trúc

```
scripts/
├── build.py              # Script chính để build Blade templates
├── compile.py            # Wrapper cho Blade compiler
├── dev.js               # Development server với hot reload
└── compiler/            # Thư mục chứa compiler modules
    ├── __init__.py
    ├── config.py        # Configuration cho compiler
    ├── compiler.config.json  # File config JSON
    └── ...              # Các module compiler khác
```

## Sử dụng

### Từ thư mục gốc:
```bash
npm run build:templates  # Build Blade templates
npm run compile         # Build templates + webpack
npm run dev:blade       # Development server
```

### Từ thư mục scripts:
```bash
cd scripts
python3 build.py        # Build Blade templates
```

## Configuration

File `compiler/compiler.config.json` chứa cấu hình đường dẫn:

- `views_input`: Thư mục chứa Blade templates (`resources/views`)
- `js_input`: Thư mục chứa JavaScript modules (`resources/js/app`)
- `build_output`: Thư mục build tạm thời (`resources/js/build`)
- `app_output`: Thư mục output cuối cùng (`public/static/app`)

## Development

Script `dev.js` cung cấp development server với:
- Hot reload khi file Blade templates thay đổi
- Auto-rebuild khi có thay đổi
- Vite dev server cho frontend

## Notes

- Tất cả đường dẫn được tính từ project root
- Compiler tự động detect và build tất cả `.blade.php` files
- Output được copy vào `resources/js/app/views/templates.js`







