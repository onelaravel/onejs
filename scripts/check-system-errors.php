<?php

/**
 * Script Kiểm Tra Lỗi Hệ Thống
 * 
 * Script này kiểm tra các lỗi phổ biến trong hệ thống:
 * - Namespace không đúng
 * - Đường dẫn thư mục không đúng
 * - Class không tồn tại
 * - Syntax errors
 */

class SystemErrorChecker
{
    private array $errors = [];
    private array $warnings = [];
    private int $filesChecked = 0;

    public function check(): void
    {
        echo "🔍 Bắt đầu kiểm tra hệ thống...\n\n";

        $this->checkNamespaces();
        $this->checkDirectoryPaths();
        $this->checkClassExists();
        $this->checkSyntax();

        $this->printReport();
    }

    private function checkNamespaces(): void
    {
        echo "📦 Kiểm tra namespace...\n";
        
        $directories = ['app', 'src'];
        $oldNamespaces = ['Shared\\', 'Core\\', 'Modules\\', 'Contexts\\', 'Support\\', 'Infrastructure\\'];
        
        foreach ($directories as $dir) {
            if (!is_dir($dir)) {
                continue;
            }

            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $file) {
                if (!$file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }

                $this->filesChecked++;
                $content = file_get_contents($file->getPathname());
                
                foreach ($oldNamespaces as $oldNs) {
                    // Kiểm tra namespace declaration
                    if (preg_match('/^namespace\s+' . preg_quote($oldNs, '/') . '/m', $content)) {
                        $this->errors[] = "❌ Namespace cũ trong: {$file->getPathname()}";
                    }
                    
                    // Kiểm tra use statements (nhưng không phải One\...)
                    if (preg_match('/^use\s+' . preg_quote($oldNs, '/') . '(?!One)/m', $content)) {
                        $this->warnings[] = "⚠️  Use statement cũ trong: {$file->getPathname()}";
                    }
                }
            }
        }
    }

    private function checkDirectoryPaths(): void
    {
        echo "📁 Kiểm tra đường dẫn thư mục...\n";
        
        $paths = [
            'src/support' => 'src/Support',
            'src/modules' => 'src/Modules',
            'src/core' => 'src/App',
            'src/shared' => 'src/Shared',
            'src/contexts' => 'src/Contexts',
            'src/infrastructure' => 'src/Infrastructure',
        ];

        foreach ($paths as $old => $new) {
            if (is_dir($old) && !is_dir($new)) {
                $this->warnings[] = "⚠️  Thư mục cũ còn tồn tại: {$old} (nên là: {$new})";
            }
        }

        // Kiểm tra trong code
        $files = ['app/Providers/AppServiceProvider.php'];
        foreach ($files as $file) {
            if (!file_exists($file)) {
                continue;
            }
            
            $content = file_get_contents($file);
            foreach ($paths as $old => $new) {
                if (strpos($content, $old) !== false) {
                    $this->errors[] = "❌ Đường dẫn cũ trong: {$file} (tìm thấy: {$old})";
                }
            }
        }
    }

    private function checkClassExists(): void
    {
        echo "🔎 Kiểm tra class tồn tại...\n";
        
        // Load autoload nếu có
        $autoloadPath = __DIR__ . '/../vendor/autoload.php';
        if (file_exists($autoloadPath)) {
            require_once $autoloadPath;
        }
        
        $criticalClasses = [
            'One\\App\\System',
            'One\\App\\Context',
            'One\\Shared\\BaseController',
            'One\\Support\\ValidationRules',
            'One\\Infrastructure\\Database\\DatabaseService',
        ];

        foreach ($criticalClasses as $class) {
            if (!class_exists($class) && !interface_exists($class)) {
                // Kiểm tra xem file có tồn tại không
                $relativePath = str_replace('One\\', 'src/', $class);
                $relativePath = str_replace('\\', '/', $relativePath) . '.php';
                $fullPath = __DIR__ . '/../' . $relativePath;
                
                if (!file_exists($fullPath)) {
                    $this->errors[] = "❌ Class không tồn tại: {$class} (file: {$relativePath})";
                } else {
                    $this->warnings[] = "⚠️  Class tồn tại nhưng chưa được autoload: {$class}";
                }
            }
        }
    }

    private function checkSyntax(): void
    {
        echo "🔤 Kiểm tra syntax...\n";
        
        $directories = ['app', 'src'];
        
        foreach ($directories as $dir) {
            if (!is_dir($dir)) {
                continue;
            }

            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $file) {
                if (!$file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }

                $output = [];
                $return = 0;
                exec("php -l {$file->getPathname()} 2>&1", $output, $return);
                
                if ($return !== 0) {
                    $this->errors[] = "❌ Syntax error trong: {$file->getPathname()}\n   " . implode("\n   ", $output);
                }
            }
        }
    }

    private function printReport(): void
    {
        echo "\n" . str_repeat("=", 60) . "\n";
        echo "📊 BÁO CÁO KIỂM TRA\n";
        echo str_repeat("=", 60) . "\n\n";
        
        echo "📈 Thống kê:\n";
        echo "   - Số file đã kiểm tra: {$this->filesChecked}\n";
        echo "   - Số lỗi: " . count($this->errors) . "\n";
        echo "   - Số cảnh báo: " . count($this->warnings) . "\n\n";

        if (!empty($this->errors)) {
            echo "❌ LỖI:\n";
            foreach ($this->errors as $error) {
                echo "   {$error}\n";
            }
            echo "\n";
        }

        if (!empty($this->warnings)) {
            echo "⚠️  CẢNH BÁO:\n";
            foreach ($this->warnings as $warning) {
                echo "   {$warning}\n";
            }
            echo "\n";
        }

        if (empty($this->errors) && empty($this->warnings)) {
            echo "✅ Không có lỗi nào được phát hiện!\n";
        } else {
            echo "💡 Tổng kết: " . (empty($this->errors) ? "✅ Không có lỗi nghiêm trọng" : "❌ Có lỗi cần sửa") . "\n";
        }
    }
}

// Chạy kiểm tra
if (php_sapi_name() === 'cli') {
    $checker = new SystemErrorChecker();
    $checker->check();
} else {
    echo "Script này chỉ chạy được từ command line.\n";
}

