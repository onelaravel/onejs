# Tương Tác Giữa ViewManager, View và ViewControllerOptimized

Tài liệu này giải thích cách `ViewControllerOptimized` sẽ thay thế `ViewController` hiện tại mà không làm gãy cấu trúc `View` và `ViewManager` của OneJS.

## 1. Mối Quan Hệ Hiện Tại

```mermaid
graph TD
    ViewManager --> |quản lý| View
    View --> |sở hữu (composition)| ViewController
    ViewController --> |sở hữu| Managers(EventManager, ReactiveManager...)
```

- **ViewManager**: Gọi `new View(name, data)` để tạo view mới.
- **View**: Trong `constructor()`, nó khởi tạo `this.__ = new ViewController(path, this, null)`.
- **ViewController**: Là "bộ não" xử lý mọi logic render, state, event.

## 2. Chiến Lược Thay Thế Trong Suốt (Transparent Replacement)

Chúng ta sẽ thay thế class `ViewController` cũ bằng `ViewControllerOptimized` (được đổi tên thành `ViewController` khi release) sao cho `View` và `ViewManager` **không hề hay biết** về sự thay đổi này.

### Điều Kiện Cần

`ViewControllerOptimized` phải implement (hoặc bridge) toàn bộ **Public API** mà `View` đang gọi đến.

### Các "Điểm Chạm" (Touch Points) Chính

#### A. Khởi Tạo (Trong `View.js`)

```javascript
// core/View.js
import { ViewController } from "./ViewController.js"; // <-- Sau này sẽ trỏ tới file mới

export class View {
  constructor(path, config) {
    // ...
    // Logic này giữ nguyên, chỉ cần đảm bảo ViewController mới nhận đúng tham số
    const controller = new ViewController(path, this, null);
    // ...
  }
}
```

#### B. Setup & Config (Trong `ViewManager.js` & `View.js`)

`View` gọi `this.__.setup(config)`.

- **Cũ**: `ViewController.setup()` gọi `InitializationManager` (hoặc logic hỗn hợp).
- **Mới**: `ViewControllerOptimized.setup()` sẽ gọi `ConfigHelper.process(this, config)`.

#### C. Rendering (Trong `ViewManager.js`)

`ViewManager` gọi `view.__.render()` hoặc `virtualRender()`.

- **Cũ**: `this._renderEngine.render()`.
- **Mới**: `RenderHelper.render(this)`.

#### D. Hydration (SSR) (Trong `ViewManager.js`)

`ViewManager` gọi `view.__.__scan(ssrData)`.

- **Cũ**: Logic scan nằm trong `RenderEngine` hoặc inline.
- **Mới**: `scanRenderedView` gọi `RenderHelper.scan(this, ssrData)`.

#### E. State & Props Access (Trong Compiled View Files)

Các file view đã compile (như `WebTemplatesExamplesSectionsDebtItem.js`) truy cập `this` (là instance của `View`), và `View` proxy sang `ViewController`.

```javascript
// Ví dụ compiled code
render() {
    return `... ${this.__reactive(id, keys, ...)} ...`;
}
```

- **Yêu cầu**: `ViewControllerOptimized` **BẮT BUỘC** phải có phương thức `__reactive`.
- **Implementation**:
  ```javascript
  __reactive(id, keys, renderFn) {
      // Forward sang Helper
      return ReactiveHelper.renderOutputComponent(this, keys, renderFn);
  }
  ```

## 3. Bản Đồ API (API Mapping)

Dưới đây là mapping chi tiết các method mà `View` gọi sang `ViewController`:

| View Method (Caller) | ViewController (Old)        | ViewControllerOptimized (New) | Helper                                  |
| :------------------- | :-------------------------- | :---------------------------- | :-------------------------------------- |
| `setup(config)`      | `setup(config)`             | `setup(config)`               | `ConfigHelper`                          |
| `render()`           | `_renderEngine.render()`    | `render()`                    | `RenderHelper`                          |
| `prerender()`        | `_renderEngine.prerender()` | `prerender()`                 | `RenderHelper`                          |
| `destroy()`          | `destroy()`                 | `destroy()`                   | Gọi `LifecycleHelper`, `EventHelper`... |
| `.states` (Getter)   | `this.states`               | `this.states`                 | _Giữ nguyên (ViewState)_                |
| `.id` (Getter)       | `this.id`                   | `this.id`                     | _Property trực tiếp_                    |
| `__reactive()`       | _(via RenderEngine/Mixin)_  | `__reactive()`                | `ReactiveHelper`                        |
| `addEventConfig()`   | Use `_eventManager`         | `addEventConfig()`            | `EventHelper` / `this.events` (data)    |

## 4. Kế Hoạch Thay Thế (Release Plan)

1.  **Giai đoạn 1 (Hiện tại)**:
    - Hoàn thiện `ViewControllerOptimized` và các `Helper`.
    - Đảm bảo `ViewControllerOptimized` chạy song song và pass unit test/manual test.
2.  **Giai đoạn 2 (Switch)**:

    - Đổi tên `ViewController.js` -> `ViewControllerLegacy.js`.
    - Đổi tên `ViewControllerOptimized.js` -> `ViewController.js`.

3.  **Giai đoạn 3 (Integration Test)**:
    - Chạy thử `ViewManager` với Controller mới.
    - Vì `ViewManager` và `View` chỉ import `ViewController` theo đường dẫn file `core/ViewController.js`, việc đổi tên file là đủ để tích hợp.

## 5. Kết Luận

`ViewManager` và `View` **không cần sửa đổi code**. Chúng tương tác với Controller thông qua một Interface ngầm định (duck typing). Miễn là `ViewControllerOptimized` implement đủ các method public (như `render`, `setup`, `destroy`, `__reactive`), hệ thống sẽ hoạt động bình thường với hiệu suất cao hơn.
