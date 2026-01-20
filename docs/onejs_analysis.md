# Phân Tích Framework OneJS

Tài liệu này tổng hợp phân tích về cấu trúc và cơ chế hoạt động của **OneJS**, một framework frontend custom được thiết kế để hoạt động chặt chẽ với Laravel Blade (dựa trên cấu trúc file và cách sinh code).

## 1. Tổng Quan

OneJS là một Single Page Application (SPA) framework tự xây dựng, có khả năng:

- **Client-side Rendering (CSR)**: Render giao diện động tại phía client.
- **Server-side Rendering (SSR) Hydration**: Có khả năng "scan" và "hydrate" HTML được render sẵn từ server (Laravel Blade) để gắn logic Javascript vào.
- **Component-based**: Tổ chức code theo các View/Component độc lập.
- **Reactivity**: Hệ thống state management reactive tự xây dựng.

## 2. Cấu Trúc Thư Mục (`resources/js/onejs`)

- **`core/`**: Chứa mã nguồn cốt lõi của framework.
  - `ViewManager.js`: Quản lý toàn bộ hệ thống view, routing và điều phối.
  - `ViewController.js`: Controller cho từng instance của view, quản lý lifecycle, state, và events.
  - `managers/`: Các module con hỗ trợ `ViewController` (như `RenderEngine`, `EventManager`, `ReactiveManager`).
  - `OneMarkup.js`: Công cụ thao tác DOM và parse cấu trúc markup.
  - `Router.js`: Xử lý điều hướng client-side.
- **`views/`**: Chứa các file Javascript được biên dịch (compiled) từ các file gốc (có thể là Blade component). Đây là nơi chứa logic cụ thể của từng view.
- **`app.js` & `init.js`**: Điểm khởi chạy của ứng dụng.

## 3. Kiến Trúc Cốt Lõi

### A. ViewManager (`core/ViewManager.js`)

Đây là "bộ não" của ứng dụng:

- **Quản lý View**: Lưu trữ cache các view template (`templates`, `cachedViews`).
- **Loading**: Hỗ trợ Dynamic Import view thông qua `ViewLoader`.
- **Routing**: Tích hợp với `Router` để load view dựa trên URL.
- **Render & Scan**: Cung cấp 2 phương thức chính:
  - `loadView()`: Load và render mới một view (CSR).
  - `scanView()`: Scan DOM hiện tại (được server render) để gắn logic JS vào (SSR Hydration).
- **Super View**: Hỗ trợ khái niệm "Layout" (Super View) cho phép lồng các view con vào view cha.

### B. ViewController (`core/ViewController.js`)

Mỗi view instance sẽ có một `ViewController` riêng biệt:

- **Lifecycle Management**: Quản lý các hooks như `created`, `mounted`, `destroyed` thông qua `LifecycleManager`.
- **Managers**: Nó ủy quyền các tác vụ cụ thể cho các manager con:
  - `RenderEngine`: Xử lý render HTML.
  - `EventManager`: Đăng ký và xử lý sự kiện DOM.
  - `ReactiveManager`: Theo dõi thay đổi state và cập nhật UI.
  - `ResourceManager`: Quản lý CSS/JS assets riêng của view.

### C. RenderEngine (`core/managers/RenderEngine.js`)

Chịu trách nhiệm sinh ra HTML hoặc cập nhật DOM:

- **Render**: Chạy hàm `render()` của view để tạo ra chuỗi HTML.
- **Scan**: Duyệt qua cấu trúc DOM thực tế để tìm các element tương ứng với logic của view (`scanDOMElements`).
- **Virtual Render**: Chế độ render ảo để tính toán cấu trúc mà không update DOM ngay lập tức.
- **Wrapper**: Hỗ trợ bọc view trong các thẻ container (wrapper) để quản lý phạm vi.

### D. Hệ Thống Reactivity (`core/ViewState.js` & `views/...js`)

Logic reactive hoạt động như sau:

1. **Khai báo State**: Trong file view biên dịch, các state được đăng ký qua `__STATE__.__.register()`.
2. **Setters**: Tạo ra các hàm setter (ví dụ `setDebtData`).
3. **Binding**: Trong hàm `render`, các cấu trúc như `this.__reactive` hoặc `this.__classBinding` được sử dụng để gắn kết dữ liệu với DOM.
4. **Update**: Khi state thay đổi qua setter, `ReactiveManager` sẽ kích hoạt cập nhật lại các phần DOM bị ảnh hưởng (fine-grained updates).

## 4. Luồng Hoạt Động (Data Flow)

### Khởi tạo App

1. `init.js` kiểm tra config `window.APP_CONFIGS`.
2. Khởi tạo `OneMarkup`, `Router`, `ViewManager`.
3. Nếu là SSR, gọi `Router.start(true)` và hệ thống sẽ thực hiện `scanView` thay vì render mới.

### Quy trình Render một View (CSR)

1. `ViewManager.loadView(name)` được gọi.
2. Load module view từ `views/`.
3. Tạo instance `ViewEngine` (wrapper của `ViewController`).
4. Chạy `RenderEngine.render` -> Sinh HTML string.
5. Insert HTML vào container (`#app-root`).
6. Gọi hook `mounted`.

### Quy trình Hydrate một View (SSR)

1. `ViewManager.scanView(name)` được gọi.
2. Tìm kiếm dữ liệu `ssrData` đã được server inject.
3. Tạo instance View.
4. `RenderEngine.scan` -> Tìm các element trong DOM tương ứng với View ID.
5. Gắn các event handlers và binding mà không render lại HTML.

## 5. Phân Tích File View (`views/WebTemplatesExamplesSectionsDebtItem.js`)

File view được biên dịch chứa:

- **Hàm khởi tạo**: Nhận `App`, `systemData`, `$$$DATA$$$` (props).
- **State Setup**: `useState`, `setDebtData`...
- **Methods**: Các hàm xử lý logic (ví dụ `togglePaidStatus`, `handleUpdateDebt`).
- **Render Function**: Trả về chuỗi HTML template string, sử dụng các helper:
  - `${this.__classBinding(...)}`: Binding class động.
  - `${this.__addEventConfig(...)}`: Gắn sự kiện (click, submit...).
  - `${this.__reactive(...)}`: Hiển thị dữ liệu text động.
  - `${this.__watch(...)}`: Render lại khối HTML khi state phụ thuộc thay đổi.

## Kết luận

OneJS là một framework khá phức tạp và mạnh mẽ, được thiết kế tối ưu cho việc kết hợp giữa Server-side Rendering của Laravel và tính năng động của SPA. Nó tự quản lý DOM, Event và State mà không phụ thuộc vào các thư viện lớn như React hay Vue, giúp tối ưu hóa tải trọng và kiểm soát chi tiết quá trình render.
