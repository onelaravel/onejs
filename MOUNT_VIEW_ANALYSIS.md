# 📋 Phân Tích Chi Tiết: Luồng & Logic Hoạt Động của mountView

## 🎯 Tổng Quan

**mountView** là hàm chính dùng để **mount/render một view** vào DOM. Nó xử lý:
- Cache layout (tránh destroy layout không cần thiết)
- Destroy layout cũ nếu cần
- Render HTML mới
- Mount lifecycle hooks
- Scroll position handling

---

## 📊 Luồng Hoạt Động Chính

### **PHASE 1: Lưu thông tin layout cũ (TRƯỚC loadView)**

```javascript
const oldSuperViewPath = this.CURRENT_SUPER_VIEW_PATH;
const oldSuperView = this.CURRENT_SUPER_VIEW;
const oldPageView = this.PAGE_VIEW;

if (oldSuperView && oldSuperView instanceof ViewEngine) {
    oldSuperView.__._lifecycleManager.unmounted();
}
```

**Mục đích:**
- Lưu lại path của layout cũ trước khi `loadView()` thay đổi nó
- Gọi `unmounted()` cleanup CSS/scripts của layout cũ

**Tại sao cần?**
- Nếu không lưu, sẽ mất thông tin khi check cache ở bước 2
- `loadView()` sẽ reset `CURRENT_SUPER_VIEW` → không thể so sánh

---

### **PHASE 2: Gọi loadView() - Render view mới**

```javascript
const viewResult = this.loadView(viewName, params, route?.$urlPath || '');
if (viewResult.error) {
    console.error('View rendering error:', viewResult.error);
    return;
}
```

**Có 2 trường hợp:**

#### **2A. Normal Rendering (Client-Side)**
```
loadView() 
  ↓
  ├─ 1. Tạo view instance: view(name, data)
  ├─ 2. Check view.__.hasSuperView (có layout không?)
  ├─ 3. Nếu có → Tìm super view → Render layout
  ├─ 4. Store trong PAGE_VIEW, CURRENT_SUPER_VIEW
  └─ 5. Return {html, superView, ultraView, needInsert}
```

#### **2B. SSR Scanning (Server-Side)**
```
scanView()
  ↓
  ├─ 1. Lấy SSR data từ HTML comments
  ├─ 2. Tạo view instances từ SSR data
  ├─ 3. Call virtualRender() (chỉ setup relationships, không render HTML)
  ├─ 4. Scan DOM + attach event handlers
  └─ 5. Return {html từ SSR, superView, ultraView}
```

---

### **PHASE 3: Kiểm tra Cache Layout**

```javascript
const newSuperViewPath = viewResult.superView?.__.path;
const isSameLayout = newSuperViewPath === oldSuperViewPath;

if (!isSameLayout) {
    if (oldSuperView && oldSuperView instanceof ViewEngine) {
        oldSuperView.__._lifecycleManager.unmounted();
    }
}
```

**Logic:**
| Kịch bản | isSameLayout | Hành động |
|---------|-------------|----------|
| Home → User List | `true` | ❌ KHÔNG destroy layout → Reuse |
| Home (bảng) → Home (kảnh) | `true` | ❌ KHÔNG destroy layout → Reuse |
| Home (bảng) → Admin | `false` | ✅ Destroy layout cũ |
| Home → Login | `false` | ✅ Destroy layout cũ |

**Ưu điểm:**
- Tránh destroy/recreate layout không cần thiết
- CSS/JS chỉ load 1 lần nếu layout không đổi
- Performance tốt hơn

---

### **PHASE 4: Render HTML & Insert DOM**

```javascript
if (viewResult.needInsert && viewResult.html) {
    const container = this.container || 
                      document.querySelector('#app-root') || 
                      document.querySelector('#app') || 
                      document.body;
    if (container) {
        OneDOM.setHTML(container, html);
    }
}
```

**Trường hợp `needInsert = false`:**
- SSR mode: HTML từ server, DOM đã có → chỉ attach events
- Layout cache: Content view đổi, layout cũ → chỉ update content

**Trường hợp `needInsert = true`:**
- CSR mode: Render HTML từ client
- Layout khác: Phải render lại toàn bộ

---

### **PHASE 5: Emit & Mount Lifecycle**

```javascript
if (this.emitChangedSections) {
    this.emitChangedSections();
}

if (viewResult.ultraView && viewResult.ultraView instanceof ViewEngine) {
    viewResult.ultraView.__._lifecycleManager.mounted();
}

this.CURRENT_SUPER_VIEW_MOUNTED = true;
this.PAGE_VIEW?.__.scrollToOldPosition() || this.scrollToTop();
```

**Chi tiết:**

| Bước | Hành động | Mục đích |
|------|----------|---------|
| 1 | `emitChangedSections()` | Notify UI sections thay đổi |
| 2 | `mounted()` lifecycle | Chạy hook mounted của views |
| 3 | Set flag `CURRENT_SUPER_VIEW_MOUNTED = true` | Đánh dấu layout đã mount |
| 4 | `scrollToOldPosition()` hoặc `scrollToTop()` | Xử lý scroll position |

---

## 🔄 Luồng Tổng Quát (Visual)

```
mountView(viewName)
    ↓
    ├─ PHASE 1: Lưu layout cũ
    │   └─ oldSuperView, oldSuperViewPath
    │
    ├─ PHASE 2: loadView() → Render view mới
    │   ├─ CSR: render() → HTML
    │   └─ SSR: virtualRender() → relationships only
    │   └─ Store: viewResult
    │
    ├─ PHASE 3: Cache check
    │   ├─ isSameLayout = newPath === oldPath?
    │   └─ Nếu khác → Destroy oldSuperView
    │
    ├─ PHASE 4: Insert DOM
    │   └─ OneDOM.setHTML(container, html)
    │
    └─ PHASE 5: Mount lifecycle
        ├─ emitChangedSections()
        ├─ viewResult.ultraView.mounted()
        ├─ Set CURRENT_SUPER_VIEW_MOUNTED = true
        └─ Handle scroll position
```

---

## 🎯 Hàm Liên Quan

### **1. loadView(name, data, urlPath)**

**Input:** View name, data, URL path
**Output:** `{ html, superView, ultraView, needInsert, error }`

**Logic:**
```
loadView()
  ├─ Check cache: viewStoreKey
  ├─ Nếu cached → return cached HTML
  ├─ Nếu không:
  │   ├─ Create view: this.view(name, data)
  │   ├─ Check super view: view.__.hasSuperView?
  │   ├─ Nếu có → renderOrScanView(superView, mode='csr')
  │   ├─ Store PAGE_VIEW, CURRENT_SUPER_VIEW
  │   └─ Return { html, superView, ultraView, needInsert }
  └─ Catch error → Return { error }
```

**Cache strategy:**
```javascript
const viewStoreKey = name.replace('.', '_') + '_' + urlPath?.replace(/[\/\:]/g, '_');
const cachedPageView = this.cachedPageViews.get(viewStoreKey);
if (cachedPageView instanceof ViewEngine) {
    return cachedHTML; // Reuse!
}
```

---

### **2. scanView(name)**

**Input:** View name (SSR mode)
**Output:** `{ html, superView, ultraView, needInsert, error }`

**Logic:**
```
scanView()
  ├─ Get SSR data from server
  ├─ this.ssrViewManager.scan(name)
  ├─ Create view instance from SSR data
  ├─ Loop through super views:
  │   ├─ While view.__.hasSuperView:
  │   │   ├─ Get super view path
  │   │   ├─ Call scanRenderedView(view)
  │   │   ├─ Scan SSR data for super view
  │   │   └─ Call view.__.__scan(ssrData)
  │   └─ Attach event handlers via DOM scan
  ├─ Build ALL_VIEW_STACK (all views in hierarchy)
  └─ Return { html, superView, ultraView, needInsert }
```

**Vòng lặp super views:**
```
PAGE_VIEW → LAYOUT1 → LAYOUT2 → ROOT_LAYOUT
  ↑                                    ↓
  └────────── ALL_VIEW_STACK ──────────┘
```

---

### **3. renderOrScanView(view, variableData, mode)**

**Input:** View, data, mode ('csr' or 'ssr')
**Output:** Rendered HTML (CSR) or Nothing (SSR)

**Logic:**
```
renderOrScanView()
  ├─ Determine mode:
  │   ├─ CSR → use render(), prerender()
  │   └─ SSR → use virtualRender(), virtualPrerender()
  │
  ├─ CASE 1: No async data
  │   └─ view.render() → return HTML
  │
  ├─ CASE 2: Has @await directive
  │   ├─ CSR: Load data from current URL
  │   │   ├─ getURIData() → fetch from API
  │   │   ├─ Store in this.store
  │   │   └─ view.refresh(data)
  │   └─ SSR: Just setup relationships
  │
  └─ CASE 3: Has @fetch directive
      ├─ CSR: Fetch data using config
      │   ├─ this.App.Http.request(config)
      │   └─ view.refresh(response.data)
      └─ SSR: Just setup relationships
```

---

### **4. clearOldRendering()**

**Mục đích:** Reset state giữa renders

**Logic:**
```
clearOldRendering()
  ├─ 1. Clear templates cache
  │    └─ Object.keys(templates).forEach(clear)
  │
  ├─ 2. Clear cachedViews
  │    └─ Delete old view instances
  │
  ├─ 3. Clear stacks (GỮ LẠI cache info!)
  │    ├─ ALL_VIEW_STACK = []
  │    ├─ SUPER_VIEW_STACK = []
  │    ├─ PAGE_VIEW = null
  │    ├─ ⚠️ KHÔNG xóa: CURRENT_SUPER_VIEW_PATH
  │    └─ ⚠️ KHÔNG xóa: CURRENT_SUPER_VIEW
  │
  └─ 4. Clear orphaned event data
       └─ Prevent memory leaks
```

**Tại sao giữ cache info?**
- Để check layout cache ở `mountView()` PHASE 3
- Nếu xóa → sẽ luôn destroy layout (inefficient)

---

### **5. unmountView(view)**

**Mục đích:** Cleanup một view hoàn toàn

**Logic (5 bước):**
```
unmountView(view)
  ├─ 1. Call beforeUnmount() lifecycle
  ├─ 2. Call removeEvents() - remove listeners
  ├─ 3. Remove from viewMap
  ├─ 4. Call unmounted() lifecycle
  └─ 5. Call destroy() if defined
```

**Khi nào gọi?**
- Layout thay đổi (PHASE 3)
- Navigation away from view
- Component cleanup

---

## 🔑 Key Concepts

### **1. View Hierarchy (Super Views)**

```
ROOT_LAYOUT (Master page)
    ↓
ADMIN_LAYOUT (Admin section)
    ↓
USER_LIST (Page view)
```

**Scan order:** Bottom-up (USER_LIST → ADMIN_LAYOUT → ROOT_LAYOUT)
**Mount order:** Top-down (ROOT_LAYOUT → ADMIN_LAYOUT → USER_LIST)

---

### **2. Cache Strategy**

| Type | Key | TTL | Reuse |
|------|-----|-----|-------|
| Layout | `CURRENT_SUPER_VIEW_PATH` | Session | ✅ Reuse nếu giống |
| Page | `viewStoreKey` | 10 min | ✅ Reuse nếu không expired |
| Sections | `_sections[name]` | Session | ✅ Reuse |

---

### **3. CSR vs SSR Flow**

#### **CSR (Client-Side Rendering)**
```
mountView()
  ↓
loadView()
  ├─ render() → HTML
  └─ Return { html, needInsert: true }
  ↓
OneDOM.setHTML(container, html)
  ↓
mounted() lifecycle
```

#### **SSR (Server-Side Rendering)**
```
mountViewScan()
  ↓
scanView()
  ├─ Get SSR HTML from server
  ├─ virtualRender() → setup relationships only
  └─ Return { html, needInsert: false }
  ↓
OneDOM.setHTML(container, html) [optional]
  ↓
Scan DOM + attach events
  ↓
mounted() lifecycle
```

---

### **4. Data Flow: @await & @fetch**

#### **@await Directive**
```
View có @await
  ↓
renderOrScanView()
  ├─ CSR:
  │   ├─ Check this.store[apiDataKey]
  │   ├─ Nếu cache hit: view.refresh(cachedData)
  │   └─ Nếu miss: this.App.Api.getURIData() → fetch → refresh
  └─ SSR:
      └─ Skip (data từ server)
```

#### **@fetch Directive**
```
View có @fetch
  ↓
renderOrScanView()
  ├─ CSR:
  │   ├─ Parse fetch config: { url, method, headers, ... }
  │   ├─ this.App.Http.request(config)
  │   └─ view.refresh(response.data)
  └─ SSR:
      └─ Skip (data từ server)
```

---

## ⚡ Performance Optimizations

### **1. Layout Cache**
```javascript
// ❌ BAD: Destroy layout mỗi lần navigate
if (layoutPath !== oldPath) {
    destroy layout;
}

// ✅ GOOD: Reuse layout nếu giống
if (newLayoutPath !== oldLayoutPath) {
    destroy oldLayout;
}
```

### **2. Page Cache**
```javascript
// Store page view đã render
this.cachedPageViews.set(viewStoreKey, viewInstance);

// Reuse nếu navigate lại
if (cachedPageView) {
    return cachedView.html;
}
```

### **3. Event Cleanup**
```javascript
// Avoid memory leaks
clearOldRendering() → clearOrphanedEventData();

// Clear only when needed
unmountView() → removeEvents();
```

### **4. Scroll Position**
```javascript
// Remember old position
this.PAGE_VIEW?.__.scrollToOldPosition();

// Or go to top for new page
this.scrollToTop();
```

---

## 🐛 Potential Issues & Solutions

### **Issue 1: Layout cache mất khi refresh**
**Solution:** Store `CURRENT_SUPER_VIEW_PATH` persistent

### **Issue 2: Memory leak từ event listeners**
**Solution:** `clearOrphanedEventData()` + `removeEvents()`

### **Issue 3: Data stale trong @await**
**Solution:** Cache key includes `urlPath` → Cache per route

### **Issue 4: SSR hydration mismatch**
**Solution:** `virtualRender()` setup relationships before scan

---

## 📝 Summary Table

| Hàm | Mục đích | Input | Output | Khi gọi |
|-----|----------|-------|--------|---------|
| **mountView** | Main mount logic | viewName, params | HTML inserted | Navigation |
| **loadView** | Render view (CSR) | name, data, urlPath | {html, superView} | mountView PHASE 2 |
| **scanView** | Scan SSR HTML | name | {html, views} | mountViewScan |
| **renderOrScanView** | Render/scan with async | view, data, mode | HTML or None | loadView, scanView |
| **clearOldRendering** | Reset state | - | - | Before render |
| **unmountView** | Cleanup view | view | boolean | On destroy |

---

## 🎓 Learning Points

1. **Cache optimization:** Layout reuse nếu path giống
2. **Lifecycle management:** unmounted → render → mounted
3. **Super view hierarchy:** Scan từ page up to root
4. **Async data handling:** @await vs @fetch directive
5. **Memory management:** Clear orphaned events, remove listeners
6. **CSR vs SSR:** Different rendering vs setup paths
7. **Event delegation:** Scan DOM and attach handlers
8. **Scroll position:** Restore position on back/forward

