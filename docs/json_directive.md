## @json Directive - JSON Conversion

### Purpose
Convert PHP arrays to JSON and output them in templates with automatic variable tracking.

### Usage

#### 1. Simple Array (No Variables)
```blade
@json(['test' => true])
```
Compiles to:
```javascript
${JSON.stringify({"test":true})}
```

#### 2. Array with String Values
```blade
@json(['name' => 'John', 'age' => 30])
```
Compiles to:
```javascript
${JSON.stringify({"name":"John","age":30})}
```

#### 3. Array with State Variables
```blade
@json(['test' => $state])
```
Compiles to:
```javascript
${this.__output(['state'], () => JSON.stringify({"test":state}))}
```

The `this.__output()` wrapper ensures proper reactive tracking. When `$state` changes, the JSON will be re-computed and re-rendered.

#### 4. Multiple Variables
```blade
@json(['user' => $user, 'status' => $status, 'data' => ['nested' => $value]])
```
Compiles to:
```javascript
${this.__output(['user','status','value'], () => JSON.stringify({"user":user,"status":status,"data":{"nested":value}}))}
```

### Supported Data Types

The directive supports all JSON-compatible types:
- **Booleans**: `true`, `false`
- **Null**: `null`
- **Numbers**: `123`, `45.67`
- **Strings**: `'text'` (converted to `"text"`)
- **Arrays**: `['item1', 'item2']`
- **Nested Arrays**: `['data' => ['nested' => true]]`
- **Variables**: `$variableName`

### Example in Template

```blade
<script>
  const data = @json([
    'user' => $currentUser,
    'permissions' => $permissions,
    'settings' => [
      'theme' => 'dark',
      'notifications' => $enableNotifications
    ]
  ]);
</script>
```

Compiles to:
```javascript
<script>
  const data = ${this.__output(['currentUser','permissions','enableNotifications'], () => JSON.stringify({"user":currentUser,"permissions":permissions,"settings":{"theme":"dark","notifications":enableNotifications}}))};
</script>
```

### Implementation Details

The directive is implemented in `/scripts/compiler/directive_processors.py`:
- Automatically detects all `$variables` in the array
- Converts PHP array syntax to JSON structure
- Preserves boolean/null values correctly
- Uses `__output()` wrapper only when variables are present (for reactivity)
- Direct `JSON.stringify()` for static arrays (better performance)

### Notes

- Variables are automatically tracked for reactivity
- The order of variables in the array doesn't affect tracking
- Nested arrays are supported
- String values must use quotes: `'value'` not `value`
