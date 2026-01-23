# Layout Cache Logic Analysis

## 📋 Tóm tắt lôgic hiện tại

Bạn đã implement cơ chế **cache layout** để tái sử dụng super view (layout) khi view tiếp theo extends cùng một layout. Điều này tránh render lại layout không cần thiết.

**Nguyên tắc cơ bản:**
- Nếu `CURRENT_SUPER_VIEW_PATH === new_superViewPath` → Reuse layout (không render lại)
- Nếu khác → Render layout mới

---

## ⚠️ Vấn đề phát hiện

### **Vấn đề 1: Destroy logic không an toàn với cache layout**

#### Nơi xảy ra: `mountView()` (line 725-780)

```javascript
// HIỆN TẠI (có vấn đề)
if (currentSuperView && currentSuperView instanceof ViewEngine) {
    currentSuperView.__._lifecycleManager.stop();
    currentSuperView.__._lifecycleManager.destroyOriginalView();
}

if (this.PAGE_VIEW && this.PAGE_VIEW instanceof ViewEngine) {
    if (this.PAGE_VIEW !== currentSuperView) {
        this.PAGE_VIEW.__._lifecycleManager.destroy();
    }
}
```

**Lỗi:**
- Bạn gọi `stop()` + `destroyOriginalView()` cho layout cũ
- Nhưng **bạn không kiểm tra xem layout mới có giống layout cũ không**
- Nếu layout giống → Bạn vừa destroy layout đang sắp reuse!

**Kịch bản xảy ra:**
1. Load view A extends Layout 1
   - `CURRENT_SUPER_VIEW_PATH = "layouts.main"`
   - `CURRENT_SUPER_VIEW = layout_instance_1`

2. Load view B extends Layout 1 (cùng layout)
   - `loadView()` nhận ra `needInsert = false` (layout trùng)
   - Không render layout lại
   - Nhưng `mountView()` **vẫn destroy layout cũ** trước khi load!
   - → Layout bị destroy, event listeners bị xoá
   - → Rồi reuse layout đã bị destroy ❌

---

### **Vấn đề 2: Logic so sánh `ultraView.path` không đủ**

#### Nơi xảy ra: `mountView()` (line 768)

```javascript
if(viewResult.ultraView.path === SUPER_VIEW_PATH){
    // Render layout mới
    viewResult.ultraView.__._lifecycleManager.mountOriginalView();
    viewResult.ultraView.__._lifecycleManager.start();
} else {
    // Reuse layout cũ
    viewResult.ultraView.__._lifecycleManager.mounted();
}
```

**Vấn đề:**
- `SUPER_VIEW_PATH` được capture vào **line 733** trước khi load
- Nhưng layout có thể đã bị destroy tại **line 735-743**
- Sau đó load view mới → `viewResult` là layout mới được tạo
- So sánh path sẽ là true, nhưng **bạn đang so sánh object khác nhau!**

---

### **Vấn đề 3: clearOldRendering() xoá ALL_VIEW_STACK quá sớm**

#### Nơi xảy ra: `loadView()` (line 374) và `scanView()` (line 531)

```javascript
// HIỆN TẠI
this.ALL_VIEW_STACK = [];
this.SUPER_VIEW_STACK = [];
this.PAGE_VIEW = null;
```

**Vấn đề:**
- Bạn xoá stack **TRƯỚC KHI** kiểm tra layout cache
- `needInsert` logic (line 475) dựa vào `CURRENT_SUPER_VIEW_PATH`
- Nhưng stack đã bị xoá trước đó

**Luồng:**
1. `clearOldRendering()` → `this.ALL_VIEW_STACK = []`
2. Vòng lặp build stack → `this.ALL_VIEW_STACK.unshift(view)`
3. So sánh `CURRENT_SUPER_VIEW_PATH` để cache

→ Stack trống lúc đầu vòng lặp, làm `needInsert` logic bị sai

---

## ✅ Giải pháp

### **Fix 1: Kiểm tra layout cache TRƯỚC khi destroy**

```javascript
mountView(viewName, params = {}, route = null) {
    try {
        // ============================================================
        // STEP 1: Load view trước để biết layout mới là gì
        // ============================================================
        const viewResult = this.loadView(viewName, params, route?.$urlPath || '');
        if (viewResult.error) {
            console.error('View rendering error:', viewResult.error);
            return;
        }

        // ============================================================
        // STEP 2: Check cache layout - nếu giống thì KHÔNG destroy
        // ============================================================
        const newSuperViewPath = viewResult.superView?.path;
        const isSameLayout = newSuperViewPath === this.CURRENT_SUPER_VIEW_PATH;

        // Chỉ destroy nếu layout KHÁC
        if (!isSameLayout) {
            let currentSuperView = this.CURRENT_SUPER_VIEW;
            if (currentSuperView && currentSuperView instanceof ViewEngine) {
                currentSuperView.__._lifecycleManager.stop();
                currentSuperView.__._lifecycleManager.destroyOriginalView();
            }

            if (this.PAGE_VIEW && this.PAGE_VIEW instanceof ViewEngine) {
                if (this.PAGE_VIEW !== currentSuperView) {
                    this.PAGE_VIEW.__._lifecycleManager.destroy();
                }
            }
        }

        // ============================================================
        // STEP 3: Render và mount như bình thường
        // ============================================================
        if (viewResult.needInsert && viewResult.html) {
            const container = this.container || document.querySelector('#app-root') || document.querySelector('#app') || document.body;
            if (container) {
                OneDOM.setHTML(container, viewResult.html);
            }
        }

        if (this.emitChangedSections) {
            this.emitChangedSections();
        }

        if (viewResult.ultraView && viewResult.ultraView instanceof ViewEngine) {
            if (!isSameLayout) {
                // Layout mới → full mount
                viewResult.ultraView.__._lifecycleManager.mountOriginalView();
                viewResult.ultraView.__._lifecycleManager.start();
            } else {
                // Layout cũ (cached) → chỉ mount page view
                viewResult.ultraView.__._lifecycleManager.mounted();
            }
        }

        this.CURRENT_SUPER_VIEW_MOUNTED = true;
        this.scrollToTop();

    } catch (error) {
        console.error('Error rendering view:', error);
    }
}
```

### **Fix 2: Tối ưu clearOldRendering() để giữ lại cache info**

```javascript
clearOldRendering() {
    const currentRenderTime = this.renderTimes;

    // ================================================================
    // 1. Cleanup old render queues (giữ lại last 3)
    // ================================================================
    if (currentRenderTime > 3) {
        const oldRenderTime = currentRenderTime - 3;
        if (this.VIEW_MOUNTED_QUEUE[oldRenderTime]) {
            const oldViews = this.VIEW_MOUNTED_QUEUE[oldRenderTime];
            if (Array.isArray(oldViews)) {
                oldViews.forEach(view => {
                    if (view && typeof view === 'object') {
                        this.unmountView(view);
                    }
                });
            }
            delete this.VIEW_MOUNTED_QUEUE[oldRenderTime];
        }
    }

    // ================================================================
    // 2. Trim view cache - LỮU Ý: Không destroy layout đang cache
    // ================================================================
    const MAX_CACHED_VIEWS = 50;
    const cachedKeys = Object.keys(this.cachedViews);
    
    if (cachedKeys.length > MAX_CACHED_VIEWS) {
        const toRemove = cachedKeys.slice(0, cachedKeys.length - MAX_CACHED_VIEWS);
        toRemove.forEach(key => {
            const view = this.cachedViews[key];
            // ⚠️ KHÔNG destroy layout hiện tại đang được cache!
            if (view && view !== this.CURRENT_SUPER_VIEW) {
                this.unmountView(view);
                delete this.cachedViews[key];
            }
        });
    }

    // ================================================================
    // 3. Clear stacks - NHƯNG GỮ LẠI cache info
    // ================================================================
    // Xoá stacks nhưng giữ CURRENT_SUPER_VIEW_PATH để check cache sau
    this.ALL_VIEW_STACK = [];
    this.SUPER_VIEW_STACK = [];
    this.PAGE_VIEW = null;
    // ✅ KHÔNG xoá: this.CURRENT_SUPER_VIEW_PATH
    // ✅ KHÔNG xoá: this.CURRENT_SUPER_VIEW

    // ... (tiếp tục cleanup khác)
}
```

### **Fix 3: Kiểm tra layout cache TRƯỚC khi clear stacks**

```javascript
loadView(name, data = {}, urlPath = '') {
    // ============================================================
    // STEP 1: Check xem có layout cache không TRƯỚC clear
    // ============================================================
    const willCheckCache = this.templates[name] && this.CURRENT_SUPER_VIEW_PATH;
    
    if (this.templates[name]) {
        // ⚠️ Tạm lưu cache info trước clear
        const cachedLayoutPath = this.CURRENT_SUPER_VIEW_PATH;
        const cachedLayout = this.CURRENT_SUPER_VIEW;
        
        this.clearOldRendering();
        
        // ✅ Restore cache info sau clear
        this.CURRENT_SUPER_VIEW_PATH = cachedLayoutPath;
        this.CURRENT_SUPER_VIEW = cachedLayout;
    }
    
    this.renderTimes++;
    // ... rest của logic
}
```

---

## 📊 Luồng mới (Fixed)

### Scenario: Reuse layout cache

**View A (layout1) → View B (layout1):**

```
1. mountView("pageB")
   ├─ loadView("pageB")
   │  ├─ clearOldRendering() - clear stacks, keep cache info
   │  ├─ Build ALL_VIEW_STACK: [pageB, layout1]
   │  ├─ Check: needInsert = false (layout1 == CURRENT_SUPER_VIEW_PATH) ✅
   │  └─ Return: html="", ultraView=layout1, needInsert=false
   │
   ├─ Check: isSameLayout = (layout1.path == CURRENT_SUPER_VIEW_PATH) ✅ TRUE
   │
   ├─ Skip destroy (vì layout giống) ✅
   │
   └─ Mount: viewResult.ultraView.mounted() - chỉ mount pageB ✅
```

### Scenario: New layout

**View A (layout1) → View C (layout2):**

```
1. mountView("pageC")
   ├─ loadView("pageC")
   │  ├─ clearOldRendering() - clear stacks
   │  ├─ Build ALL_VIEW_STACK: [pageC, layout2]
   │  ├─ Check: needInsert = true (layout2 != layout1) ✅
   │  └─ Return: html=rendered_html, ultraView=layout2, needInsert=true
   │
   ├─ Check: isSameLayout = (layout2.path == layout1.path) ❌ FALSE
   │
   ├─ Destroy old layout1 ✅
   │
   ├─ setHTML container with new html ✅
   │
   └─ Mount: viewResult.ultraView.mountOriginalView() + start() ✅
```

---

## 🎯 Tóm tắt các vấn đề tìm thấy

| Vấn đề | Lỗi | Fix |
|--------|-----|-----|
| **Destroy quá sớm** | Destroy layout trước khi biết layout mới là gì | Kiểm tra cache TRƯỚC destroy |
| **Stack mất cache info** | clearOldRendering() xoá stack quá sớm | Lưu + restore cache info |
| **needInsert logic sai** | Xoá stack trước khi check cache | Giữ CURRENT_SUPER_VIEW_PATH |
| **Không check reuse** | Không so sánh layout cũ + mới | Thêm `isSameLayout` flag |

---

## 🔍 Kiểm tra thêm

Sau khi fix, hãy verify:

1. **Load 2 view cùng layout:** Layout không bị destroy ✅
2. **Load 2 view khác layout:** Layout cũ được destroy, layout mới được mount ✅
3. **Event listeners:** Không bị mất khi reuse layout ✅
4. **CSS/Scripts:** Không bị inject lại khi reuse layout ✅
5. **Memory:** Cache không leak (stacks được clear đúng lúc) ✅
