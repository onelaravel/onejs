# OneLaravelJS Framework

**OneLaravelJS** là thư viện lõi JavaScript dành cho các ứng dụng OneLaravel. Nó cung cấp nền tảng runtime, quản lý view, routing và khả năng tương tác hai chiều mạnh mẽ giữa Laravel Blade và JavaScript.

Thư viện này đóng vai trò là "Engine", trong khi ứng dụng Laravel của bạn cung cấp "Map" (Views và Cấu hình).

---

## 🏗 Cài đặt

Cài đặt thư viện thông qua npm:

```bash
npm install onelaraveljs
```

Sau khi cài đặt, bạn sẽ có quyền truy cập vào:
- **Runtime Library**: Các file JS để chạy ứng dụng.
- **CLI Tools**: Công cụ `onejs-build` để biên dịch Blade template thành JavaScript modules.

---

## 📂 Cấu trúc dự án khuyến nghị

Để OneLaravelJS hoạt động hiệu quả, dự án của bạn nên tuân thủ cấu trúc sau:

```
my-laravel-project/
├── build.config.json           # File cấu hình build (BẮT BUỘC)
├── package.json
├── resources/
│   ├── js/
│   │   ├── app.js              # Entry point chính
│   │   ├── build/              # Output của Webpack (Bundle)
│   │   ├── config/             # Output của Compiler (Registry maps)
│   │   ├── core/               # Output của Compiler (Proxy files)
│   │   └── views/              # Output của Compiler (Compiled View Components)
│   └── views/
│       ├── _system/            # System views required by Framework
│       └── web/                # User views
```

---

## ⚙️ Cấu hình (`build.config.json`)

Tạo file `build.config.json` tại thư mục gốc dự án để định nghĩa các ngữ cảnh (contexts) build:

```json
{
    "contexts": {
        "web": {
            "sources": [
                "resources/views/_system",
                "resources/views/web"
            ],
            "output": {
                "views": "resources/js/views/web",
                "register": "resources/js/config/templates.web.js",
                "bundle": "resources/js/build/web.bundle.js"
            },
            "dist": {
                "bundle": "public/static/web/js/main.bundle.js",
                "css": "public/static/web/css",
                "assets": "public/static/web/assets"
            }
        }
    }
}
```

---

## 🛠 Công cụ CLI (`onejs-build`)

OneLaravelJS đi kèm với trình biên dịch mạnh mẽ để chuyển đổi Blade Templates thành JavaScript Components.

### Các lệnh phổ biến:

Thêm vào `package.json` của bạn:

```json
"scripts": {
    "build:templates": "onejs-build all",
    "build:templates:web": "onejs-build web",
    "dev:blade": "onejs-build"
}
```

- **`onejs-build all`**: Biên dịch tất cả các context được định nghĩa trong `build.config.json`.
- **`onejs-build web`**: Chỉ biên dịch context `web`.
- **`onejs-build`**: Chạy chế độ Interactive (Menu chọn).

### Cơ chế hoạt động:
1.  Đọc `build.config.json`.
2.  Quét các file `.blade.php` trong thư mục `sources`.
3.  Phân tích cú pháp Blade, Directives (@if, @foreach), và OneJS directives (x-data, x-bind).
4.  Sinh ra các file ES6 Module tại thư mục `output.views`.
5.  Tạo file Registry (`templates.web.js`) để map tên view sang file JS.

---

## 🚀 Sử dụng trong ứng dụng (`app.js`)

Tại `resources/js/app.js`, bạn cần kết nối Core Framework với Registry views đã được biên dịch:

```javascript
import { App, viewLoader } from 'onelaraveljs';

// Import Registry đã được CLI sinh ra (thông qua Proxy hoặc trực tiếp)
// Lưu ý: ViewTemplates thường được export từ file generated resources/js/core/ViewTemplate.js
import { ViewTemplates } from './core/ViewTemplate.js'; 

// 1. Dependency Injection: Nạp danh sách views vào Core
viewLoader.setRegistry(ViewTemplates);

// 2. Khởi tạo App
// App sẽ tự động đọc window.APP_CONFIGS từ Blade để cấu hình Env, Routes...
if (window.APP_CONFIGS) {
    App.init();
}

// 3. Export global (Tùy chọn, dùng cho debug hoặc legacy scripts)
window.App = App;
```

---

## 🧠 Core Concepts

### 1. View System
OneJS coi mỗi file Blade là một Component.
- **Server**: Render HTML tĩnh (SEO).
- **Client**: Hydrate HTML đó thành Interactive Component.

### 2. ViewLoader & Registry
- **ViewLoader**: Là "bộ não" tải view lười (lazy-load). Nó không biết gì về ứng dụng của bạn cho đến khi được cung cấp Registry.
- **ViewRegistry**: Là "cuốn danh bạ" map tên view (`web.home`) tới file code (`WebHome.js`). File này được sinh tự động.

### 3. Event Service
Hệ thống Event Bus tích hợp sẵn:

```javascript
import { App } from 'onelaraveljs';

// Lắng nghe
App.Event.on('cart:updated', (data) => {
    console.log('Cart count:', data.count);
});

// Phát sự kiện
App.Event.emit('cart:updated', { count: 5 });
```

---

## 🤝 Đóng góp & Phát triển (Development)

Nếu bạn muốn chỉnh sửa source code của chính thư viện `onelaraveljs`:

### Cấu trúc Source:
- `bin/`: Chứa file thực thi CLI.
- `scripts/`: Chứa logic biên dịch (Python/Node).
  - `build.py`: Script chính điều phối build.
  - `compiler/`: Bộ biên dịch Blade sang JS (Python).
- `src/`: Source code JS runtime.
  - `core/`: Logic cốt lõi (Router, ViewEngine...).

### Quy trình phát triển:
1.  Clone repo về máy.
2.  Chạy `npm install`.
3.  Symlink sang dự án test (`npm link` hoặc chỉnh sửa trực tiếp trong `node_modules` để debug nhanh).
4.  Đảm bảo biến môi trường `ONEJS_PROJECT_ROOT` được xử lý đúng trong các script build nếu chạy thủ công.

### Testing:
Kiểm tra các thay đổi bằng cách chạy build trên một dự án Laravel thực tế sử dụng thư viện này (ví dụ `onelaravel`).

---

## License

MIT License.
