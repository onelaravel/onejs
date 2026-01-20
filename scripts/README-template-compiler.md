# Template Compiler

Python compiler để chuyển đổi Blade `@template` và `@useTemplate` thành JavaScript.

## 🎯 Tính năng

- ✅ Chuyển đổi `@template` thành JavaScript function
- ✅ Chuyển đổi `@useTemplate` thành `this.renderTemplate()`
- ✅ Hỗ trợ `@params`, `@subscribe`, `@props`
- ✅ Xóa `@template` blocks khỏi view sau khi compile
- ✅ Tự động detect array type (indexed/associative)
- ✅ Context fallback mechanism
- ✅ Watch mode để tự động compile

## 🚀 Sử dụng

### 1. Compile một lần
```bash
python3 scripts/compile-templates.py
```

### 2. Watch mode (tự động compile khi có thay đổi)
```bash
python3 scripts/watch-templates.py
```

### 3. Compile file cụ thể
```bash
python3 scripts/compiler/template_compiler.py input.js output.js
```

## 📝 Cú pháp Blade

### Template Definition
```blade
@template('profile', @params($userState, $isEditModalOpen), @subscribe($userState, $isEditModalOpen))
    <div class="profile">
        <h1>{{ $userState['name'] }}</h1>
        <p>{{ $userState['email'] }}</p>
        @if($isEditModalOpen)
            <div class="modal">Edit Mode</div>
        @endif
    </div>
@endtemplate
```

### Template Usage
```blade
@useTemplate('profile', [$userState, $isEditModalOpen])
@useTemplate('sidebar', ['items' => $items])
@useTemplate('header')
```

## 🔄 Kết quả compile

### Template Engine Setup
```javascript
const templateEngine = new TemplateEngine(App, View, self, subscribe);
templateEngine.setTemplates({
    "profile": function(context, data) {
        let {userState, isEditModalOpen} = context;
        const userState = Array.isArray(data) ? data[0] : (data.userState || null);
        const isEditModalOpen = Array.isArray(data) ? data[1] : (data.isEditModalOpen || null);
        // Subscribe to: userState, isEditModalOpen
        return `<div class="profile">
            <h1>${userState?.name || 'Unknown'}</h1>
            <p>${userState?.email || 'No email'}</p>
            <p>Role: ${userState?.role || 'User'}</p>
            <p>Modal open: ${isEditModalOpen ? 'Yes' : 'No'}</p>
        </div>`;
    }
});
self.setTemplateEngine(templateEngine);
```

### Template Usage
```javascript
this.renderTemplate('profile', [userState, isEditModalOpen])
this.renderTemplate('sidebar', ['items' => items])
this.renderTemplate('header')
```

## 🛠️ Cấu trúc file

```
scripts/
├── compiler/
│   └── template_compiler.py    # Main compiler
├── compile-templates.py        # One-time compile script
├── watch-templates.py          # Watch mode script
└── README-template-compiler.md # Documentation
```

## 📋 Requirements

- Python 3.6+
- No external dependencies

## 🔧 Cấu hình

### Input/Output Directories
- **Input**: `resources/js/app/views/`
- **Output**: `public/build/views/`

### Supported File Types
- `.js` files only

## 🐛 Troubleshooting

### Lỗi thường gặp

1. **Template không được compile**
   - Kiểm tra cú pháp Blade
   - Đảm bảo `@template` và `@endtemplate` đúng

2. **Variable không hiển thị**
   - Kiểm tra `@params` declaration
   - Đảm bảo variable được pass vào `@useTemplate`

3. **Array type detection sai**
   - Compiler tự động detect array type
   - Kiểm tra data format khi pass vào template

### Debug

Để debug, kiểm tra file output trong `public/build/views/`:
```bash
cat public/build/views/YourView.js
```

## 📚 Examples

Xem file `resources/js/app/views/ExampleView.js` để tham khảo cú pháp và cách sử dụng.
