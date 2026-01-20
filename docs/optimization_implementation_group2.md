# Tài Liệu Chi Tiết Triển Khai Optimization Group 2: Stateful Managers (Revised)

Tài liệu này cung cấp hướng dẫn kỹ thuật chi tiết, đầy đủ các properties và phương thức cần chuyển đổi cho nhóm Stateful Managers. Mục tiêu là loại bỏ hoàn toàn việc khởi tạo 4 object con (`EventManager`, `ReactiveManager`, `BindingManager`, `ResourceManager`) và thay thế bằng cấu trúc dữ liệu tập trung (Optimization) kết hợp với Static Helper Classes.

## 1. Cấu Trúc Dữ Liệu Tập Trung (`_internal`)

Trong `ViewController.js`, thay vì khởi tạo các manager `new Manager()`, ta sẽ khởi tạo một object `_internal` chứa toàn bộ state.

### Định nghĩa `ViewController.prototype.initializeInternalState`

```javascript
// ViewController.js

/**
 * Khởi tạo cấu trúc dữ liệu nội bộ tối ưu hóa bộ nhớ
 */
initializeInternalState() {
    this._internal = {
        // =========================================================================
        // 1. EVENT STATE (Thay thế EventManager)
        // =========================================================================
        events: {
            /**
             * Map lưu các hàm unsubscribe cho delegated events
             * Key: `${eventType}:${eventID}:${viewID}`
             * Value: Function unsubscribe()
             */
            unsubscribers: new Map()
        },

        // =========================================================================
        // 2. REACTIVE STATE (Thay thế ReactiveManager)
        // =========================================================================
        reactive: {
            /** Map<string, ReactiveComponent> lưu instance các component đang active */
            components: new Map(),

            /** Array<Object> cấu hình component từ việc scan DOM (SSR) */
            config: [],

            /** Index hiện tại khi render/scan component (dùng cho tuần tự) */
            index: 0,
            scanIndex: 0,

            /** Danh sách IDs của các component đã render */
            ids: [],
            prerenderIDs: [],
            renderIDs: [],

            /** Stack theo dõi dependency (Following IDs) */
            followingIDs: [],
            followingRenderIDs: [],
            followingPrerenderIDs: [],

            /** Reference tới component cha đang watch (nếu có context lồng nhau) */
            parentWatch: null
        },

        // =========================================================================
        // 3. BINDING STATE (Thay thế BindingManager)
        // =========================================================================
        binding: {
            // --- Input (Two-way) Binding ---
            listeners: [],            // Array lưu thông tin listener input để dọn dẹp
            isStarted: false,         // Flag đánh dấu đã start event listener chưa

            /** WeakMap tracking cờ update để tránh loop (pushing/syncing) */
            elementFlags: new WeakMap(),

            /** WeakMap tracking listener đã gắn vào element nào */
            elementMap: new WeakMap(),

            // --- Attribute Binding ---
            attrConfigs: [],          // Configs cho dynamic attributes
            attrListeners: [],        // Active listeners cho attributes
            attrIndex: 0,             // Index tracking

            // --- Class Binding ---
            classConfigs: [],         // Configs cho dynamic classes
            classListeners: [],       // Active listeners cho classes
            isClassReady: false       // Flag đánh dấu class binding đã sẵn sàng
        },

        // =========================================================================
        // 4. RESOURCE STATE (Thay thế ResourceManager)
        // =========================================================================
        resources: {
            /** Set<string> lưu các key của resources (css/js) đã insert bởi view này */
            insertedKeys: new Set()
        }
    };
}
```

## 2. Chi Tiết Chuyển Đổi Từng Module

### A. Event Helper (Thay thế `EventManager.js`)

#### Nhiệm vụ

Chuyển đổi toàn bộ logic xử lý sự kiện, parse handler, delegation sang static methods.

#### File: `core/helpers/EventHelper.js`

```javascript
import EventDelegator from "../EventDelegator.js";
import logger from "../services/LoggerService.js";

export default class EventHelper {
  /**
   * Start event listeners using delegation
   * @param {ViewController} controller
   */
  static startEventListener(controller) {
    const state = controller._internal.events; // Truy cập state mới
    const needDeleted = [];

    // Logic cũ nhưng thay this.delegatedUnsubscribers bằng state.unsubscribers
    Object.entries(controller.events).forEach(([eventType, eventMap]) => {
      Object.entries(eventMap).forEach(([eventID, handlers]) => {
        const selector = `[data-${eventType}-id="${eventID}"]`;
        const delegateKey = `${eventType}:${eventID}:${controller.id}`;

        // Parse Handlers (Gọi hàm static nội bộ)
        const parsedHandlers = EventHelper.parseEventHandlerFunctions(
          controller,
          handlers
        );

        if (parsedHandlers.length > 0) {
          // Cleanup old if exists
          if (state.unsubscribers.has(delegateKey)) {
            state.unsubscribers.get(delegateKey)();
          }

          // Attach via Delegator
          const unsubscribe = EventDelegator.on(
            eventType,
            selector,
            (event) => {
              // ... logic thực thi handlers (giữ nguyên logic cũ) ...
              // Lưu ý: bind this context cho handler là controller.view
            }
          );

          state.unsubscribers.set(delegateKey, unsubscribe);
        } else {
          needDeleted.push({ eventType, eventID });
        }
      });
    });

    // ... cleanup needDeleted logic ...
    controller.eventListenerStatus = true;
  }

  /**
   * Stop all listeners
   * @param {ViewController} controller
   */
  static stopEventListener(controller) {
    const state = controller._internal.events;

    // Clear delegated listeners
    state.unsubscribers.forEach((unsubscribe) => unsubscribe());
    state.unsubscribers.clear();

    // Clear legacy listeners if any
    if (controller.eventListeners && controller.eventListeners.length > 0) {
      controller.eventListeners.forEach(({ element, eventType, handler }) => {
        element.removeEventListener(eventType, handler);
      });
      controller.eventListeners = [];
    }

    controller.eventListenerStatus = false;
  }

  /**
   * Parse array of handler definitions
   */
  static parseEventHandlerFunctions(controller, handlers) {
    // Logic cũ chuyển sang context static
    // Thay this.view bằng controller.view
    // Gọi EventHelper.parseHandlerFunction(controller, ...)
    // ...
  }
}
```

### B. Reactive Helper (Thay thế `ReactiveManager.js`)

#### Nhiệm vụ

Đây là phần phức tạp nhất. Cần xử lý việc tạo `ReactiveComponent` và quản lý lifecycle của chúng thông qua `_internal.reactive`.

#### File: `core/helpers/ReactiveHelper.js`

```javascript
import { ReactiveComponent } from "../reactive/ReactiveComponent.js";

export default class ReactiveHelper {
  /**
   * Render Output Component (Thay thế renderOutputComponent)
   */
  static renderOutputComponent(
    controller,
    stateKeys = [],
    renderBlock = () => ""
  ) {
    const state = controller._internal.reactive;

    // Logic Virtual Rendering
    if (controller.isVirtualRendering) {
      controller.isVirtualRendering = false;
      let result = ReactiveHelper.renderOutputComponentScan(
        controller,
        stateKeys,
        renderBlock
      ); // Gọi hàm static scan
      controller.isVirtualRendering = true;
      if (result !== false) return result;
    }

    // Tạo instance ReactiveComponent
    // Lưu ý: ReactiveComponent vẫn cần refer ngược lại controller để access App/State
    const rc = new ReactiveComponent({
      stateKeys,
      renderBlock,
      controller: controller, // Truyền controller vào
      App: controller.App,
      type: "output",
      escapeHTML: false,
    });

    // Store active component vào state mới
    state.ids.push(rc.id);
    state.components.set(rc.id, rc);

    return rc.render();
  }

  static renderOutputComponentScan(
    controller,
    stateKeys,
    renderBlock,
    escapeHTML = false
  ) {
    const state = controller._internal.reactive;

    // Truy cập state.scanIndex thay vì this.reactiveComponentScanIndex
    let reactiveComponentIndex = state.scanIndex;
    let reactiveComponentConfig = state.config[reactiveComponentIndex];

    // ... logic validate config ...

    const { id: renderID } = reactiveComponentConfig;
    const rc = new ReactiveComponent({
      renderID,
      stateKeys,
      renderBlock,
      controller: controller,
      App: controller.App,
      type: "output",
      escapeHTML,
    });

    state.ids.push(rc.id);
    state.components.set(rc.id, rc);
    state.scanIndex++; // Tăng index

    return rc.render();
  }

  static clearForRefresh(controller) {
    const state = controller._internal.reactive;
    if (state.components.size > 0) {
      state.components.forEach((c) => c.destroy());
      state.components.clear();
    }
    state.ids = [];
    state.scanIndex = 0;
    state.followingIDs = [];
    // ... reset other arrays ...
  }

  // Các hàm renderWatchComponent, renderBindingAttribute chuyển tương tự...
}
```

### C. Binding Helper (Thay thế `BindingManager.js`)

#### Nhiệm vụ

Quản lý Two-way binding và Attribute/Class binding. Chú ý sử dụng `WeakMap` từ `_internal.binding`.

#### File: `core/helpers/BindingHelper.js`

```javascript
import OneDOM from "../OneDOM.js";
import DOMBatcher from "../DOMBatcher.js";

export default class BindingHelper {
  static startBindingEventListener(controller) {
    const state = controller._internal.binding;
    const selector = `[data-binding][data-view-id="${controller.id}"]`;
    const inputs = document.querySelectorAll(selector);

    inputs.forEach((input) => {
      if (!input.isConnected) return;

      // Check WeakMap from state
      if (state.elementMap.has(input)) return;

      const stateKey = input.getAttribute("data-binding");
      // ... logic validate ...

      // Sync initial state
      BindingHelper.syncStateToElement(controller, input, stateKey);

      const handler = (event) =>
        BindingHelper.pushElementToState(controller, input, stateKey);

      // Attach event
      const eventType =
        input.tagName.toLowerCase() === "select" ? "change" : "input";
      input.addEventListener(eventType, handler);

      // Store in WeakMap
      state.elementMap.set(input, { eventType, handler, stateKey });

      // Store in array for destroy cleanup
      state.listeners.push({ element: input, eventType, handler /* ... */ });
    });

    state.isStarted = true;
  }

  static pushElementToState(controller, element, stateKey) {
    const state = controller._internal.binding;

    // Get flags from WeakMap
    let flags = state.elementFlags.get(element);
    if (!flags) {
      flags = { pushing: false, syncing: false };
      state.elementFlags.set(element, flags);
    }

    if (flags.syncing || flags.pushing) return;
    flags.pushing = true;

    try {
      const value = OneDOM.getInputValue(element);
      // Call updateStateAddressKey on controller
      controller.states.__.updateStateAddressKey(stateKey, value);
    } finally {
      Promise.resolve().then(() => {
        const currentFlags = state.elementFlags.get(element);
        if (currentFlags) currentFlags.pushing = false;
      });
    }
  }

  // Các hàm syncStateToElement, notifyStateChanges... thực hiện tương tự.
  // Lưu ý thay this.* bằng thao tác trên state.*
}
```

### D. Resource Helper (Thay thế `ResourceManager.js`)

#### Nhiệm vụ

Đơn giản hóa việc quản lý resource, trạng thái lưu tại `_internal.resources.insertedKeys`.

#### File: `core/helpers/ResourceHelper.js`

```javascript
export default class ResourceHelper {
  static insertResources(controller) {
    ResourceHelper.insertStyles(controller);
    ResourceHelper.insertScripts(controller);
  }

  static insertStyles(controller) {
    if (!controller.styles || controller.styles.length === 0) return;

    const state = controller._internal.resources;

    controller.styles.forEach((style) => {
      // ... logic gen key ...
      // controller.insertedResourceKeys.add(...) -> state.insertedKeys.add(...)
      // Logic check Registry toàn cục (App.View.Engine.resourceRegistry) vẫn giữ nguyên
      // vì Helper không lưu registry này, nó là static của View Engine.
    });
  }

  // ... removeStyles, insertScripts ...
}
```

## 3. Tích Hợp Vào `ViewController`

Sau khi tạo các Helpers, ta sửa `ViewController.js` để gọi chúng.

```javascript
/* ViewController.js */

import EventHelper from './helpers/EventHelper.js';
import ReactiveHelper from './helpers/ReactiveHelper.js';
import BindingHelper from './helpers/BindingHelper.js';
import ResourceHelper from './helpers/ResourceHelper.js';

export class ViewController {
    constructor(...) {
        // ...
        // Thay vì new Manager(), khởi tạo state rỗng
        this.initializeInternalState();

        // KHÔNG còn this._eventManager = ...
    }

    // Wrapper method cho View gọi (Backward Compatibility)
    __reactive(id, keys, renderFn) {
        // Forward sang Helper
        return ReactiveHelper.renderOutputComponent(this, keys, renderFn);
    }

    // Lifecycle hooks
    mounted() {
        // Thay thế this._eventManager.startEventListener()
        EventHelper.startEventListener(this);
        BindingHelper.startBindingEventListener(this);
    }

    destroy() {
        EventHelper.stopEventListener(this);
        BindingHelper.destroy(this);
        ReactiveHelper.destroy(this);
        ResourceHelper.removeResources(this);

        // Clear internal state
        this._internal = null;
        super.destroy(); // nếu có
    }
}
```

## 4. Các Vấn Đề Cần Lưu Ý (Edge Cases)

1.  **Scope của `this`**: Trong các Helper, `this` không còn là instance controller. Luôn phải dùng biến `controller` được truyền vào.
2.  **Circular References trong ReactiveComponent**:
    - `ReactiveComponent` hiện đang giữ tham chiếu `this.controller`. Điều này vẫn ổn, nhưng khi destroy `controller`, ta phải chắc chắn gọi `ReactiveHelper.destroy(this)` để loop qua tất cả components và gọi `component.destroy()`, setup `component.controller = null`.
3.  **WeakMap GC**: Trong `BindingHelper`, vì `_internal` là property của `controller`, khi `controller` bị GC thì `_internal` cũng bị GC theo -> `WeakMap` cũng đi theo. Đây là hành vi đúng và an toàn bộ nhớ.
4.  **Legacy Proxy**: Nếu có code cũ truy cập trực tiếp `this._eventManager`, code đó sẽ gãy. Cần search toàn project để đảm bảo không có chỗ nào chọc trực tiếp vào manager property. Nếu cần thiết, có thể tạo getter `get _eventManager()` trả về object giả lập (proxy) để warn deprecation.

---

**Kết luận**: Việc chuyển đổi này tuy tốn công sức ban đầu (refactor copy-paste logic) nhưng cấu trúc dữ liệu `_internal` rất rõ ràng, minh bạch, và loại bỏ hoàn toàn overhead của các class wrapper.
